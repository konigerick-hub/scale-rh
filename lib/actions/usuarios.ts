'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { alterarBase, carregarBase } from '@/lib/store/dados';
import { hashSenha, validarForcaSenha, verificarSenha } from '@/lib/auth/password';
import { exigirSessao, podeGerenciarUsuarios } from '@/lib/auth/guard';
import { auditar, Acao } from '@/lib/auth/audit';

export type Resultado = { ok: true } | { ok: false; erro: string };

const novoUsuarioSchema = z.object({
  email: z.string().email('E-mail inválido.').max(255),
  nome: z.string().trim().min(2, 'Informe o nome.').max(120),
  papel: z.enum(['admin', 'gestor', 'comercial']),
  empresaIds: z.array(z.string().uuid()),
  senha: z.string().min(1, 'Informe a senha inicial.'),
});

export async function criarUsuario(
  entrada: z.input<typeof novoUsuarioSchema>,
): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeGerenciarUsuarios(usuario)) return { ok: false, erro: 'Sem permissão.' };

  const parsed = novoUsuarioSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const d = parsed.data;

  const fraca = validarForcaSenha(d.senha);
  if (fraca) return { ok: false, erro: fraca };

  // Gestor e leitura sem empresa nenhuma não enxergariam nada — provavelmente
  // um esquecimento no formulário, então avisamos em vez de criar conta inútil.
  if (d.papel !== 'admin' && d.empresaIds.length === 0) {
    return { ok: false, erro: 'Selecione ao menos uma empresa para este papel.' };
  }

  const email = d.email.toLowerCase().trim();
  const { base } = await carregarBase();
  if (base.usuarios.some((u) => u.email === email)) {
    return { ok: false, erro: 'Já existe um usuário com esse e-mail.' };
  }

  const senhaHash = await hashSenha(d.senha);

  await alterarBase((b) => {
    if (b.usuarios.some((u) => u.email === email)) return;
    b.usuarios.push({
      id: randomUUID(),
      email,
      senhaHash,
      nome: d.nome,
      papel: d.papel,
      ativo: true,
      empresaIds: d.papel === 'admin' ? [] : d.empresaIds,
      mfaSecret: null,
      trocarSenha: true,
      ultimoLoginEm: null,
      criadoEm: new Date().toISOString(),
    });
  });

  await auditar({
    acao: Acao.USUARIO_CRIAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'usuario',
    metadata: { email, papel: d.papel },
  });

  revalidatePath('/painel/usuarios');
  return { ok: true };
}

export async function definirAtivo(id: string, ativo: boolean): Promise<Resultado> {
  const usuario = await exigirSessao();
  if (!podeGerenciarUsuarios(usuario)) return { ok: false, erro: 'Sem permissão.' };

  // Desativar a si mesmo tranca a pessoa para fora do próprio sistema.
  if (id === usuario.id && !ativo) {
    return { ok: false, erro: 'Você não pode desativar a própria conta.' };
  }

  const { base } = await carregarBase();
  const alvo = base.usuarios.find((u) => u.id === id);
  if (!alvo) return { ok: false, erro: 'Usuário não encontrado.' };

  // Ficar sem nenhum admin ativo deixaria o sistema sem quem gerencie contas.
  if (!ativo && alvo.papel === 'admin') {
    const admins = base.usuarios.filter((u) => u.papel === 'admin' && u.ativo);
    if (admins.length <= 1) {
      return { ok: false, erro: 'É preciso manter ao menos um administrador ativo.' };
    }
  }

  await alterarBase((b) => {
    const u = b.usuarios.find((x) => x.id === id);
    if (u) u.ativo = ativo;
  });

  await auditar({
    acao: Acao.USUARIO_DESATIVAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'usuario',
    entidadeId: id,
    metadata: { email: alvo.email, ativo },
  });

  revalidatePath('/painel/usuarios');
  return { ok: true };
}

const trocaSenhaSchema = z.object({
  senhaAtual: z.string().min(1),
  senhaNova: z.string().min(1),
});

export async function trocarPropriaSenha(
  entrada: z.input<typeof trocaSenhaSchema>,
): Promise<Resultado> {
  const usuario = await exigirSessao();

  const parsed = trocaSenhaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: 'Dados inválidos.' };

  const fraca = validarForcaSenha(parsed.data.senhaNova);
  if (fraca) return { ok: false, erro: fraca };

  const { base } = await carregarBase();
  const u = base.usuarios.find((x) => x.id === usuario.id);
  if (!u) return { ok: false, erro: 'Usuário não encontrado.' };

  // Exigir a senha atual impede que uma sessão sequestrada troque a senha e
  // tome a conta de vez.
  const confere = await verificarSenha(u.senhaHash, parsed.data.senhaAtual);
  if (!confere) return { ok: false, erro: 'Senha atual incorreta.' };

  const novoHash = await hashSenha(parsed.data.senhaNova);

  await alterarBase((b) => {
    const alvo = b.usuarios.find((x) => x.id === usuario.id);
    if (alvo) {
      alvo.senhaHash = novoHash;
      alvo.trocarSenha = false;
    }
  });

  revalidatePath('/painel');
  return { ok: true };
}
