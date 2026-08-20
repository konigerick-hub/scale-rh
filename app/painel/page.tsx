import { exigirSessao, podeVerContrato, podeExportar } from '@/lib/auth/guard';
import { listarColaboradores, resumoFolha } from '@/lib/queries/colaboradores';
import BotaoSair from './botao-sair';

// Dado sensível nunca deve ser cacheado ou pré-renderizado estaticamente.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function Painel() {
  const usuario = await exigirSessao();
  const [linhas, resumo] = await Promise.all([
    listarColaboradores(usuario),
    resumoFolha(usuario),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Contratos &amp; Cargos
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {usuario.nome} · {usuario.papel}
            {usuario.empresasPermitidas !== null &&
              ` · acesso a ${usuario.empresasPermitidas.length} empresa(s)`}
          </p>
        </div>
        <BotaoSair />
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Estatistica rotulo="Pessoas" valor={String(resumo.pessoas)} />
        <Estatistica rotulo="Vínculos" valor={String(resumo.vinculos)} />
        <Estatistica rotulo="Folha fixa" valor={brl.format(resumo.folhaTotal)} />
      </section>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Nenhum colaborador visível para o seu nível de acesso.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 text-right font-medium">Remuneração fixa</th>
                {podeVerContrato(usuario) && (
                  <th className="px-4 py-3 font-medium">Contrato</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((l) => (
                <tr key={l.vinculoId} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{l.nome}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: l.empresaCor }}
                    >
                      {l.empresaNome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{l.cargo}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-900">
                    {brl.format(Number(l.valorFixo))}
                  </td>
                  {podeVerContrato(usuario) && (
                    <td className="px-4 py-3 text-neutral-400">—</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {podeExportar(usuario) && (
        <p className="mt-6 text-xs text-neutral-400">
          Exportações são registradas em auditoria com seu usuário, IP e horário.
        </p>
      )}
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
