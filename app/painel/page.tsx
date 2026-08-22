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
import Conta from './conta';
import Tabela from './tabela';
import { carregarBase } from '@/lib/store/dados';

// Dado sensível nunca deve ser pré-renderizado nem cacheado.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const usuario = await exigirSessao();
  // `exigirPapel` devolve para cá com ?erro=sem-permissao; sem ler o parâmetro,
  // a pessoa era jogada de volta sem entender por quê.
  const { erro } = await searchParams;
  const [pessoas, resumo, empresas, { base }] = await Promise.all([
    listarPessoas(usuario, podeVerContrato(usuario)),
    resumoFolha(usuario),
    empresasVisiveis(usuario),
    carregarBase(),
  ]);

  const semData = pessoas.filter((p) => !p.dataContratacao).length;

  return (
    <>
      <header className="cabecalho">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="marca text-[.95rem]">
              Grupo <span>Scale</span>
            </span>
            <span className="hidden text-sm text-[var(--ink-3)] sm:inline">
              Contratos &amp; Cargos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-[var(--ink-3)] sm:inline">
              {usuario.nome}
              <span className="mx-1.5 opacity-40">·</span>
              <span className="text-[var(--accent)]">{usuario.papel}</span>
            </span>
            <Link href="/painel/dashboard" className="btn btn-secundario btn-mini">
              Indicadores
            </Link>
            {podeGerenciarUsuarios(usuario) && (
              <>
                <Link href="/painel/modelos" className="btn btn-secundario btn-mini">
                  Modelos
                </Link>
                <Link href="/painel/usuarios" className="btn btn-secundario btn-mini">
                  Usuários
                </Link>
              </>
            )}
            <Conta precisaTrocar={usuario.trocarSenha} />
            <BotaoSair />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-6">
        {erro === 'sem-permissao' && (
          <p role="alert" className="aviso-erro mb-5">
            Você não tem permissão para acessar aquela página.
          </p>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="stat">
            <span className="stat-valor">{resumo.pessoas}</span>
            <span className="stat-rotulo">Pessoas</span>
          </div>
          <div className="stat">
            <span className="stat-valor">{resumo.vinculos}</span>
            <span className="stat-rotulo">Vínculos</span>
          </div>
          <div className="stat col-span-2 sm:col-span-1">
            <span className="stat-valor">{brl.format(resumo.folhaTotal)}</span>
            <span className="stat-rotulo">Folha fixa mensal</span>
          </div>
        </section>

        {semData > 0 && podeEditar(usuario) && (
          <p className="mb-5 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[var(--warn-wash)] px-3.5 py-2.5 text-sm text-[var(--warn)]">
            <strong>{semData}</strong>{' '}
            {semData === 1 ? 'pessoa está' : 'pessoas estão'} sem data de admissão.
            Preencha pelo botão <em>editar</em> para liberar tempo de casa e aniversário de empresa.
          </p>
        )}

        <Tabela
          pessoas={pessoas}
          empresas={empresas.map((e) => ({ id: e.id, nome: e.nome }))}
          podeEditar={podeEditar(usuario)}
          podeVerContrato={podeVerContrato(usuario)}
          envioDireto={modoArmazenamento === 'vercel-blob'}
        modelos={podeVerContrato(usuario) ? (base.modelos ?? []).map((m) => ({ id: m.id, nome: m.nome })) : []}
        camposExtras={podeVerContrato(usuario) ? (base.camposPersonalizados ?? []) : []}
        />
      </main>
    </>
  );
}
