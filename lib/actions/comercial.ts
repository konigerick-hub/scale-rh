'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { alterarBase, carregarBase } from '@/lib/store/dados';
import { MARCADORES_COMERCIAIS } from '@/lib/store/tipos';
import { exigirSessao, podeEditarModelosComerciais } from '@/lib/auth/guard';
import { auditar, Acao } from '@/lib/auth/audit';
import { marcadoresDesconhecidos } from '@/lib/gerar-contrato';

export type Resultado = { ok: true } | { ok: false; erro: string };

/**
 * Contratos comerciais — venda para cliente.
 *
 * Área separada da de colaboradores: quem tem papel `comercial` só entra aqui.
 * Escrever modelo é de admin; gerar contrato é de qualquer conta.
 */

/* ------------------------------------------------------------------ *
 * Modelos (admin)
 * ------------------------------------------------------------------ */

const modeloSchema = z.object({
  empresaId: z.string().uuid('Escolha a empresa.'),
  nome: z.string().trim().min(2, 'Dê um nome ao modelo.').max(120),
  conteudo: z
    .string()
    .trim()
    .min(20, 'O texto do contrato está muito curto.')
    .max(60_000, 'O texto passou do limite de 60 mil caracteres.'),
});

export async function salvarModeloComercial(
  id: string | null,
  entrada: z.input<typeof modeloSchema>,
): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeEditarModelosComerciais(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const parsed = modeloSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const { base } = await carregarBase();
  if (!base.empresas.some((e) => e.id === parsed.data.empresaId)) {
    return { ok: false, erro: 'Empresa não encontrada.' };
  }

  const validos = MARCADORES_COMERCIAIS.map((m) => m.chave);
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
    if (!b.modelosComerciais) b.modelosComerciais = [];
    if (id) {
      const m = b.modelosComerciais.find((x) => x.id === id);
      if (!m) {
        erro = 'Modelo não encontrado.';
        return;
      }
      m.empresaId = parsed.data.empresaId;
      m.nome = parsed.data.nome;
      m.conteudo = parsed.data.conteudo;
      m.atualizadoEm = agora;
    } else {
      b.modelosComerciais.push({
        id: randomUUID(),
        empresaId: parsed.data.empresaId,
        nome: parsed.data.nome,
        conteudo: parsed.data.conteudo,
        criadoEm: agora,
        atualizadoEm: agora,
      });
    }
  });

  if (erro) return { ok: false, erro };

  await auditar({
    acao: Acao.MODELO_COMERCIAL_SALVAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'modeloComercial',
    entidadeId: id ?? undefined,
    metadata: { nome: parsed.data.nome },
  });

  revalidatePath('/painel/comercial');
  return { ok: true };
}

export async function removerModeloComercial(id: string): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeEditarModelosComerciais(usuario)) return { ok: false, erro: 'Sem permissão.' };

  let nome = '';
  await alterarBase((b) => {
    const m = b.modelosComerciais?.find((x) => x.id === id);
    if (m) nome = m.nome;
    b.modelosComerciais = (b.modelosComerciais ?? []).filter((x) => x.id !== id);
  });

  await auditar({
    acao: Acao.MODELO_COMERCIAL_REMOVER,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'modeloComercial',
    entidadeId: id,
    metadata: { nome },
  });

  revalidatePath('/painel/comercial');
  return { ok: true };
}
