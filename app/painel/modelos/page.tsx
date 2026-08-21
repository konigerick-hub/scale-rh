import Link from 'next/link';
import { exigirPapel } from '@/lib/auth/guard';
import { carregarBase } from '@/lib/store/dados';
import { MARCADORES } from '@/lib/store/tipos';
import GerenciarModelos from './gerenciar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PaginaModelos() {
  await exigirPapel('admin');
  const { base } = await carregarBase();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6">
      <header className="mb-7">
        <Link href="/painel" className="text-sm text-[var(--ink-3)] hover:text-[var(--ink)]">
          ← Voltar ao painel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Modelos de contrato</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-3)]">
          Escreva o contrato uma vez, com marcadores no lugar dos dados. Ao gerar
          para alguém, cada marcador vira o dado real daquela pessoa.
        </p>
      </header>

      <GerenciarModelos
        marcadores={MARCADORES}
        modelos={(base.modelos ?? []).map((m) => ({
          id: m.id,
          nome: m.nome,
          conteudo: m.conteudo,
          atualizadoEm: m.atualizadoEm,
        }))}
      />
    </main>
  );
}
