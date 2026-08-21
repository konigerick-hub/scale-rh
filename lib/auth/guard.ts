import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { carregarBase } from '@/lib/store/dados';
import type { Papel } from '@/lib/store/tipos';
import { COOKIE_SESSAO, lerToken } from './session';

/**
 * Autorização do lado do servidor.
 *
 * O proxy só confere a assinatura do JWT — é triagem barata, não autorização.
 * TODA leitura de dado passa por aqui, que recarrega o usuário do armazenamento
 * a cada requisição. É isso que faz a desativação de alguém ter efeito imediato,
 * sem esperar o token de 4 horas expirar.
 */

export type UsuarioAutenticado = {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  /** null = acesso irrestrito (admin). Lista = só estas empresas. */
  empresasPermitidas: string[] | null;
};

export async function sessaoAtual(): Promise<UsuarioAutenticado | null> {
  const jar = await cookies();
  const sessao = await lerToken(jar.get(COOKIE_SESSAO)?.value);
  if (!sessao) return null;

  // O token diz quem a pessoa era ao entrar. O armazenamento diz quem ela é agora.
  const { base } = await carregarBase();
  const usuario = base.usuarios.find((u) => u.id === sessao.usuarioId);
  if (!usuario || !usuario.ativo) return null;

  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    empresasPermitidas: usuario.papel === 'admin' ? null : usuario.empresaIds,
  };
}

/** Use no topo de toda página protegida. */
export async function exigirSessao(): Promise<UsuarioAutenticado> {
  const usuario = await sessaoAtual();
  if (!usuario) redirect('/login');
  return usuario;
}

export async function exigirPapel(...papeis: Papel[]): Promise<UsuarioAutenticado> {
  const usuario = await exigirSessao();
  if (!papeis.includes(usuario.papel)) redirect('/painel?erro=sem-permissao');
  return usuario;
}

/* ------------------------------------------------------------------ *
 * Regras de permissão — declaradas em um lugar só
 * ------------------------------------------------------------------ */

export function podeEditar(u: UsuarioAutenticado): boolean {
  return u.papel === 'admin' || u.papel === 'gestor';
}

/**
 * Contrato assinado costuma conter CPF, RG, endereço e assinatura. Só admin vê:
 * um gestor de tráfego não tem motivo legítimo para abrir o contrato de ninguém.
 */
export function podeVerContrato(u: UsuarioAutenticado): boolean {
  return u.papel === 'admin';
}

export function podeExportar(u: UsuarioAutenticado): boolean {
  return u.papel === 'admin';
}

export function podeGerenciarUsuarios(u: UsuarioAutenticado): boolean {
  return u.papel === 'admin';
}

/** Um gestor só enxerga as empresas vinculadas a ele. */
export function podeVerEmpresa(u: UsuarioAutenticado, empresaId: string): boolean {
  return u.empresasPermitidas === null || u.empresasPermitidas.includes(empresaId);
}
