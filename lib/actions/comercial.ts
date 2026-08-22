'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { alterarBase, carregarBase } from '@/lib/store/dados';
import { MARCADORES_COMERCIAIS } from '@/lib/store/tipos';
import {
  exigirSessao,
  podeEditarModelosComerciais,
  podeVerTodosComerciais,
} from '@/lib/auth/guard';
import { auditar, Acao } from '@/lib/auth/audit';
import { marcadoresDesconhecidos } from '@/lib/gerar-contrato';

export type Resultado = { ok: true } | { ok: false; erro: string };
export type ResultadoGerado = { ok: true; id: string } | { ok: false; erro: string };

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

/* ------------------------------------------------------------------ *
 * Geração (qualquer conta)
 * ------------------------------------------------------------------ */

const clienteSchema = z.object({
  razaoSocial: z.string().trim().min(2, 'Informe o nome ou razão social do cliente.').max(160),
  documento: z.string().trim().max(24),
  endereco: z.string().trim().max(300),
  representante: z.string().trim().max(120),
  representanteCpf: z.string().trim().max(24),
  email: z.string().trim().max(160),
  telefone: z.string().trim().max(30),
  objeto: z.string().trim().min(2, 'Descreva o que está sendo contratado.').max(1000),
  valor: z.number().min(0, 'O valor não pode ser negativo.').max(100_000_000),
  formaPagamento: z.string().trim().max(200),
  vigencia: z.string().trim().max(200),
  extras: z.record(z.string(), z.string().max(300)).optional(),
});

export type EntradaCliente = z.input<typeof clienteSchema>;

/**
 * Registra o contrato gerado e devolve o id para o download.
 *
 * O PDF não é guardado: é remontado a partir destes dados. Assim o histórico
 * fica leve e a via pode ser reemitida igual, quantas vezes precisar.
 */
export async function gerarContratoComercial(
  modeloId: string,
  entrada: EntradaCliente,
): Promise<ResultadoGerado> {
  const usuario = await exigirSessao();

  const parsed = clienteSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const d = parsed.data;

  const { base } = await carregarBase();
  const modelo = base.modelosComerciais?.find((m) => m.id === modeloId);
  if (!modelo) return { ok: false, erro: 'Modelo não encontrado.' };

  // Um vendedor só emite pela empresa a que está vinculado. Admin emite por todas.
  if (
    usuario.empresasPermitidas !== null &&
    !usuario.empresasPermitidas.includes(modelo.empresaId)
  ) {
    return { ok: false, erro: 'Você não tem acesso à empresa deste modelo.' };
  }

  const empresa = base.empresas.find((e) => e.id === modelo.empresaId);
  if (!empresa) return { ok: false, erro: 'Empresa do modelo não encontrada.' };

  const id = randomUUID();
  const agora = new Date().toISOString();

  await alterarBase((b) => {
    if (!b.contratosComerciais) b.contratosComerciais = [];
    b.contratosComerciais.push({
      id,
      empresaId: modelo.empresaId,
      modeloId: modelo.id,
      // Guardar o nome agora: o modelo pode ser renomeado ou apagado depois,
      // e o histórico precisa continuar dizendo o que foi emitido.
      modeloNome: modelo.nome,
      cliente: {
        razaoSocial: d.razaoSocial,
        documento: d.documento,
        endereco: d.endereco,
        representante: d.representante,
        representanteCpf: d.representanteCpf,
        email: d.email,
        telefone: d.telefone,
        objeto: d.objeto,
        valorCentavos: Math.round(d.valor * 100),
        formaPagamento: d.formaPagamento,
        vigencia: d.vigencia,
        extras: d.extras ?? {},
      },
      geradoPor: usuario.id,
      geradoPorNome: usuario.nome,
      geradoEm: agora,
    });
  });

  await auditar({
    acao: Acao.COMERCIAL_GERAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'contratoComercial',
    entidadeId: id,
    metadata: { cliente: d.razaoSocial, empresa: empresa.nome, modelo: modelo.nome },
  });

  revalidatePath('/painel/comercial');
  return { ok: true, id };
}

/** Histórico: vendedor vê o que ele emitiu; admin vê tudo. */
export async function listarContratosComerciais() {
  const usuario = await exigirSessao();
  const { base } = await carregarBase();
  const todos = base.contratosComerciais ?? [];

  const visiveis = podeVerTodosComerciais(usuario)
    ? todos
    : todos.filter((c) => c.geradoPor === usuario.id);

  return visiveis
    .slice()
    .sort((a, b) => b.geradoEm.localeCompare(a.geradoEm))
    .map((c) => ({
      id: c.id,
      cliente: c.cliente.razaoSocial,
      valor: c.cliente.valorCentavos / 100,
      modeloNome: c.modeloNome,
      empresaNome: base.empresas.find((e) => e.id === c.empresaId)?.nome ?? '—',
      geradoPorNome: c.geradoPorNome,
      geradoEm: c.geradoEm,
    }));
}
