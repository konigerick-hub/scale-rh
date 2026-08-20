import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { usuarios, usuarioEmpresas } from '@/lib/db/schema';
import { COOKIE_SESSAO, lerToken, type Papel } from './session';

/**
 * Autorização do lado do servidor.
 *
 * O middleware só confere a assinatura do JWT — é uma triagem barata, não a
 * autorização de verdade. TODA leitura de dado passa por aqui, que revalida o
 * usuário no banco a cada requisição. É isso que faz a desativação de um
 * usuário ter efeito imediato, sem precisar esperar o token expirar.
 *
 * `server-only` garante erro de build se este arquivo for importado por engano
 * em componente de cliente.
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

  // O token diz quem a pessoa era quando fez login. O banco diz quem ela é agora.
  const [usuario] = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nome: usuarios.nome,
      papel: usuarios.papel,
      ativo: usuarios.ativo,
    })
    .from(usuarios)
    .where(eq(usuarios.id, sessao.usuarioId))
    .limit(1);

  if (!usuario || !usuario.ativo) return null;

  const empresasPermitidas =
    usuario.papel === 'admin'
      ? null
      : (
          await db
            .select({ empresaId: usuarioEmpresas.empresaId })
            .from(usuarioEmpresas)
            .where(eq(usuarioEmpresas.usuarioId, usuario.id))
        ).map((l) => l.empresaId);

  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    empresasPermitidas,
  };
}

/** Use no topo de toda página protegida. Redireciona se não houver sessão válida. */
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
