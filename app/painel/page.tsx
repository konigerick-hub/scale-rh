import Link from 'next/link';
import {
  exigirSessao,
  podeVerContrato,
  podeEditar,
  podeGerenciarUsuarios,
} from '@/lib/auth/guard';
import { listarPessoas, resumoFolha, empresasVisiveis } from '@/lib/queries/colaboradores';
import { modoArmazenamento } from '@/lib/store/blob';
import BotaoSair from './botao-sair';
import Tabela from './tabela';

// Dado sensível nunca deve ser pré-renderizado nem cacheado.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function Painel() {
  const usuario = await exigirSessao();
  const [pessoas, resumo, empresas] = await Promise.all([
    listarPessoas(usuario),
    resumoFolha(usuario),
    empresasVisiveis(usuario),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Contratos &amp; Cargos
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {usuario.nome} · {usuario.papel}
            {usuario.empresasPermitidas !== null &&
              ` · ${usuario.empresasPermitidas.length} empresa(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {podeGerenciarUsuarios(usuario) && (
            <Link
              href="/painel/usuarios"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Usuários
            </Link>
          )}
          <BotaoSair />
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Estatistica rotulo="Pessoas" valor={String(resumo.pessoas)} />
        <Estatistica rotulo="Vínculos" valor={String(resumo.vinculos)} />
        <Estatistica rotulo="Folha fixa" valor={brl.format(resumo.folhaTotal)} />
      </section>

      <Tabela
        pessoas={pessoas}
        empresas={empresas.map((e) => ({ id: e.id, nome: e.nome }))}
        podeEditar={podeEditar(usuario)}
        podeVerContrato={podeVerContrato(usuario)}
        envioDireto={modoArmazenamento === 'vercel-blob'}
      />
    </main>
  );
}

function Estatistica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3">
      <div className="text-xl font-semibold tabular-nums text-neutral-900">{valor}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-neutral-500">{rotulo}</div>
    </div>
  );
}
