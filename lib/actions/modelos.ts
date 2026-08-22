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
  // Os campos personalizados também contam como válidos.
  const { base: atual } = await carregarBase();
  const validos = [
    ...MARCADORES.map((m) => m.chave),
    ...(atual.camposPersonalizados ?? []).map((c) => c.chave),
  ];
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
  meiRazaoSocial: z.string().trim().max(160),
  meiCnpj: z.string().trim().max(20),
  meiEndereco: z.string().trim().max(300),
  cpf: z.string().trim().max(20),
  rg: z.string().trim().max(30),
  nacionalidade: z.string().trim().max(60),
  estadoCivil: z.string().trim().max(40),
  endereco: z.string().trim().max(300),
  telefone: z.string().trim().max(30),
  email: z.string().trim().max(160),
  extras: z.record(z.string(), z.string().max(300)).optional(),
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

  // Conferência de tamanho, não de validade: aceitar o cadastro incompleto e
  // completar depois é mais útil que bloquear. Mas 10 dígitos num CPF é erro
  // de digitação, e sairia impresso no contrato.
  const cpfLimpo = soDigitos(d.cpf);
  if (cpfLimpo.length > 0 && cpfLimpo.length !== 11) {
    return { ok: false, erro: 'CPF deve ter 11 dígitos.' };
  }
  const cnpjLimpo = soDigitos(d.meiCnpj);
  if (cnpjLimpo.length > 0 && cnpjLimpo.length !== 14) {
    return { ok: false, erro: 'CNPJ do MEI deve ter 14 dígitos.' };
  }

  const ouNulo = (v: string) => v.trim() || null;
  let erro: string | null = null;

  await alterarBase((b) => {
    const c = b.colaboradores.find((x) => x.id === colaboradorId);
    if (!c) {
      erro = 'Colaborador não encontrado.';
      return;
    }
    // Só guarda extras cuja chave ainda existe — se você apagar um campo
    // personalizado, o valor órfão não fica pesando no cadastro para sempre.
    const chavesValidas = new Set((b.camposPersonalizados ?? []).map((x) => x.chave));
    const extras: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.extras ?? {})) {
      if (chavesValidas.has(k) && v.trim()) extras[k] = v.trim();
    }

    c.documentos = {
      ...DOCUMENTOS_VAZIOS,
      meiRazaoSocial: ouNulo(d.meiRazaoSocial),
      meiCnpj: ouNulo(d.meiCnpj),
      meiEndereco: ouNulo(d.meiEndereco),
      cpf: ouNulo(d.cpf),
      rg: ouNulo(d.rg),
      nacionalidade: ouNulo(d.nacionalidade),
      estadoCivil: ouNulo(d.estadoCivil),
      endereco: ouNulo(d.endereco),
      telefone: ouNulo(d.telefone),
      email: ouNulo(d.email),
      extras,
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
    // Nunca registrar o CPF ou CNPJ em si no log — só que foram alterados.
    metadata: {
      camposPreenchidos: Object.values(d).filter(
        (v) => typeof v === 'string' && v.trim(),
      ).length,
    },
  });

  revalidatePath('/painel');
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Dados da empresa contratante
 * ------------------------------------------------------------------ */

const empresaSchema = z.object({
  razaoSocial: z.string().trim().max(160),
  cnpj: z.string().trim().max(20),
  endereco: z.string().trim().max(300),
  representante: z.string().trim().max(120),
  representanteCpf: z.string().trim().max(20),
});

export type EntradaEmpresa = z.input<typeof empresaSchema>;

export async function salvarDadosEmpresa(
  empresaId: string,
  entrada: EntradaEmpresa,
): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeVerContrato(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const parsed = empresaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const d = parsed.data;

  const cnpj = soDigitos(d.cnpj);
  if (cnpj.length > 0 && cnpj.length !== 14) {
    return { ok: false, erro: 'CNPJ deve ter 14 dígitos.' };
  }
  const cpf = soDigitos(d.representanteCpf);
  if (cpf.length > 0 && cpf.length !== 11) {
    return { ok: false, erro: 'CPF do representante deve ter 11 dígitos.' };
  }

  const ouNulo = (v: string) => v.trim() || null;
  let erro: string | null = null;

  await alterarBase((b) => {
    const e = b.empresas.find((x) => x.id === empresaId);
    if (!e) {
      erro = 'Empresa não encontrada.';
      return;
    }
    e.razaoSocial = ouNulo(d.razaoSocial);
    e.cnpj = ouNulo(d.cnpj);
    e.endereco = ouNulo(d.endereco);
    e.representante = ouNulo(d.representante);
    e.representanteCpf = ouNulo(d.representanteCpf);
  });

  if (erro) return { ok: false, erro };

  await auditar({
    acao: Acao.EMPRESA_EDITAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'empresa',
    entidadeId: empresaId,
    metadata: { razaoSocial: d.razaoSocial },
  });

  revalidatePath('/painel/modelos');
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Campos personalizados
 * ------------------------------------------------------------------ */

const campoSchema = z.object({
  rotulo: z.string().trim().min(2, 'Dê um nome ao campo.').max(60),
});

export async function criarCampoPersonalizado(
  entrada: z.input<typeof campoSchema>,
): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeVerContrato(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const parsed = campoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  // A chave vira o marcador `{{chave}}`, então precisa ser só letras — daí
  // derivar do rótulo em vez de pedir para você digitar duas coisas.
  const chave = parsed.data.rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join('');

  if (chave.length < 2) {
    return { ok: false, erro: 'Use ao menos duas letras no nome do campo.' };
  }

  const reservados = MARCADORES.map((m) => m.chave);
  if (reservados.includes(chave)) {
    return { ok: false, erro: `"${chave}" já é um marcador do sistema. Escolha outro nome.` };
  }

  let erro: string | null = null;
  await alterarBase((b) => {
    if (!b.camposPersonalizados) b.camposPersonalizados = [];
    if (b.camposPersonalizados.some((c) => c.chave === chave)) {
      erro = 'Já existe um campo com esse nome.';
      return;
    }
    b.camposPersonalizados.push({ chave, rotulo: parsed.data.rotulo });
  });

  if (erro) return { ok: false, erro };
  revalidatePath('/painel/modelos');
  revalidatePath('/painel');
  return { ok: true };
}

export async function removerCampoPersonalizado(chave: string): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeVerContrato(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const { base } = await carregarBase();
  // Um modelo que usa este marcador passaria a imprimi-lo cru no contrato.
  const emUso = (base.modelos ?? []).filter((m) =>
    new RegExp(`\\{\\{\\s*${chave}\\s*\\}\\}`).test(m.conteudo),
  );
  if (emUso.length > 0) {
    return {
      ok: false,
      erro: `Este campo é usado no modelo "${emUso[0].nome}". Remova o marcador de lá primeiro.`,
    };
  }

  await alterarBase((b) => {
    b.camposPersonalizados = (b.camposPersonalizados ?? []).filter((c) => c.chave !== chave);
  });

  revalidatePath('/painel/modelos');
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
