'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { alterarBase, carregarBase } from '@/lib/store/dados';
import { DOCUMENTOS_VAZIOS, MARCADORES } from '@/lib/store/tipos';
import { exigirSessao, podeVerContrato } from '@/lib/auth/guard';
import { auditar, Acao } from '@/lib/auth/audit';
import { marcadoresDesconhecidos } from '@/lib/gerar-contrato';

export type Resultado = { ok: true } | { ok: false; erro: string };

/**
 * Modelos de contrato e dados pessoais.
 *
 * Tudo aqui é restrito a admin, pelo mesmo motivo do contrato assinado: CPF,
 * RG e endereço são dados pessoais que um gestor de tráfego não precisa ver.
 */

const modeloSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome ao modelo.').max(120),
  conteudo: z
    .string()
    .trim()
    .min(20, 'O texto do contrato está muito curto.')
    .max(60_000, 'O texto passou do limite de 60 mil caracteres.'),
});

export async function salvarModelo(
  id: string | null,
  entrada: z.input<typeof modeloSchema>,
): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeVerContrato(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const parsed = modeloSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // Marcador escrito errado passaria batido e sairia cru no contrato impresso.
  const validos = MARCADORES.map((m) => m.chave);
  const errados = marcadoresDesconhecidos(parsed.data.conteudo, validos);
  if (errados.length > 0) {
    return {
      ok: false,
      erro: `Marcador desconhecido: ${errados.map((e) => `{{${e}}}`).join(', ')}. Confira a lista ao lado.`,
    };
  }

  const agora = new Date().toISOString();
  let erro: string | null = null;

  await alterarBase((b) => {
    if (!b.modelos) b.modelos = [];
    if (id) {
      const m = b.modelos.find((x) => x.id === id);
      if (!m) {
        erro = 'Modelo não encontrado.';
        return;
      }
      m.nome = parsed.data.nome;
      m.conteudo = parsed.data.conteudo;
      m.atualizadoEm = agora;
    } else {
      b.modelos.push({
        id: randomUUID(),
        nome: parsed.data.nome,
        conteudo: parsed.data.conteudo,
        criadoEm: agora,
        atualizadoEm: agora,
      });
    }
  });

  if (erro) return { ok: false, erro };

  await auditar({
    acao: Acao.MODELO_SALVAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'modelo',
    entidadeId: id ?? undefined,
    metadata: { nome: parsed.data.nome },
  });

  revalidatePath('/painel/modelos');
  return { ok: true };
}

export async function removerModelo(id: string): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeVerContrato(usuario)) return { ok: false, erro: 'Sem permissão.' };

  let nome = '';
  await alterarBase((b) => {
    const m = b.modelos?.find((x) => x.id === id);
    if (m) nome = m.nome;
    b.modelos = (b.modelos ?? []).filter((x) => x.id !== id);
  });

  await auditar({
    acao: Acao.MODELO_REMOVER,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'modelo',
    entidadeId: id,
    metadata: { nome },
  });

  revalidatePath('/painel/modelos');
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Dados pessoais do colaborador
 * ------------------------------------------------------------------ */

const soDigitos = (v: string) => v.replace(/\D/g, '');

const documentosSchema = z.object({
  cpf: z.string().trim().max(20),
  rg: z.string().trim().max(30),
  nacionalidade: z.string().trim().max(60),
  estadoCivil: z.string().trim().max(40),
  endereco: z.string().trim().max(300),
});

export type EntradaDocumentos = z.input<typeof documentosSchema>;

export async function salvarDocumentos(
  colaboradorId: string,
  entrada: EntradaDocumentos,
): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeVerContrato(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const parsed = documentosSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const d = parsed.data;

  // CPF tem 11 dígitos. Aviso em vez de bloqueio: o cadastro pode ser feito
  // com o dado incompleto e completado depois.
  const cpfLimpo = soDigitos(d.cpf);
  if (cpfLimpo.length > 0 && cpfLimpo.length !== 11) {
    return { ok: false, erro: 'CPF deve ter 11 dígitos.' };
  }

  let erro: string | null = null;
  await alterarBase((b) => {
    const c = b.colaboradores.find((x) => x.id === colaboradorId);
    if (!c) {
      erro = 'Colaborador não encontrado.';
      return;
    }
    c.documentos = {
      ...DOCUMENTOS_VAZIOS,
      cpf: d.cpf.trim() || null,
      rg: d.rg.trim() || null,
      nacionalidade: d.nacionalidade.trim() || null,
      estadoCivil: d.estadoCivil.trim() || null,
      endereco: d.endereco.trim() || null,
    };
    c.atualizadoEm = new Date().toISOString();
  });

  if (erro) return { ok: false, erro };

  await auditar({
    acao: Acao.DOCUMENTOS_EDITAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'colaborador',
    entidadeId: colaboradorId,
    // Nunca registrar o CPF em si no log — só que foi alterado.
    metadata: { camposPreenchidos: Object.values(d).filter((v) => v.trim()).length },
  });

  revalidatePath('/painel');
  return { ok: true };
}

/** Modelos disponíveis para escolher na hora de gerar. */
export async function listarModelos() {
  const usuario = await exigirSessao();
  if (!podeVerContrato(usuario)) return [];
  const { base } = await carregarBase();
  return (base.modelos ?? []).map((m) => ({ id: m.id, nome: m.nome }));
}
