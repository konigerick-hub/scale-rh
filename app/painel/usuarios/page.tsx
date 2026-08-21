import Link from 'next/link';
import { exigirPapel } from '@/lib/auth/guard';
import { carregarBase } from '@/lib/store/dados';
import GerenciarUsuarios from './gerenciar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PaginaUsuarios() {
  const usuario = await exigirPapel('admin');
  const { base } = await carregarBase();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link href="/painel" className="text-sm text-[var(--ink-3)] hover:text-[var(--ink)]">
          ← Voltar ao painel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Usuários
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-3)]">
          Cada pessoa tem sua conta. Contas compartilhadas impedem saber quem acessou o quê.
        </p>
      </header>

      <GerenciarUsuarios
        eu={usuario.id}
        empresas={base.empresas.map((e) => ({ id: e.id, nome: e.nome }))}
        usuarios={base.usuarios.map((u) => ({
          id: u.id,
          email: u.email,
          nome: u.nome,
          papel: u.papel,
          ativo: u.ativo,
          empresaIds: u.empresaIds,
          ultimoLoginEm: u.ultimoLoginEm ?? null,
        }))}
      />
    </main>
  );
}
