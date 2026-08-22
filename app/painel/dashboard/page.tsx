import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeVerColaboradores } from '@/lib/auth/guard';
import { indicadores } from '@/lib/queries/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CLIMA: Record<string, { label: string; cor: string }> = {
  excelente: { label: 'Excelente', cor: 'var(--clima-excelente)' },
  saudavel: { label: 'Saudável', cor: 'var(--clima-saudavel)' },
  atencao: { label: 'Atenção', cor: 'var(--clima-atencao)' },
  critico: { label: 'Crítico', cor: 'var(--clima-critico)' },
};

export default async function Dashboard() {
  const usuario = await exigirSessao();
  // Indicadores sao de colaboradores: fora do alcance do papel comercial.
  if (!podeVerColaboradores(usuario)) redirect('/painel/comercial');
  const d = await indicadores(usuario);

  const maxTempo = Math.max(...d.tempoDeCasa.map((f) => f.total), 1);
  const totalClima = d.clima.reduce((a, c) => a + c.total, 0);

  return (
    <>
      <header className="cabecalho">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <span className="marca text-[.95rem]">Grupo <span>Scale</span></span>
          <Link href="/painel" className="btn btn-secundario btn-mini">← Painel</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Indicadores</h1>
        <p className="mt-1 text-sm text-[var(--ink-3)]">
          {d.totalPessoas} {d.totalPessoas === 1 ? 'pessoa' : 'pessoas'} no seu acesso
        </p>

        {/* ---------- Aniversariantes ---------- */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Aniversariantes de {d.mesAtual}
          </h2>

          {d.aniversariantes.length === 0 ? (
            <div className="cartao px-6 py-10 text-center">
              <p className="font-medium text-[var(--ink)]">Nenhum aniversário este mês</p>
              {d.semNascimento > 0 && (
                <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-3)]">
                  {d.semNascimento} {d.semNascimento === 1 ? 'pessoa está' : 'pessoas estão'} sem
                  data de nascimento cadastrada. Preencha pelo botão <em>editar</em> no
                  painel para que apareçam aqui.
                </p>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.aniversariantes.map((a, i) => (
                <li key={`${a.nome}-${a.tipo}-${i}`}
                  className="cartao flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-sm font-semibold"
                      style={{ background: 'var(--accent-wash)', color: 'var(--accent-ink)' }}>
                      {String(a.dia).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="block font-medium text-[var(--ink)]">{a.nome}</span>
                      <span className="block text-xs text-[var(--ink-3)]">{a.empresa}</span>
                    </span>
                  </span>
                  <span className="chip-suave"
                    style={{
                      color: a.tipo === 'nascimento' ? 'var(--accent)' : 'var(--clima-saudavel)',
                      borderColor: `color-mix(in srgb, ${a.tipo === 'nascimento' ? 'var(--accent)' : 'var(--clima-saudavel)'} 45%, transparent)`,
                      background: `color-mix(in srgb, ${a.tipo === 'nascimento' ? 'var(--accent)' : 'var(--clima-saudavel)'} 12%, transparent)`,
                    }}>
                    {a.tipo === 'nascimento'
                      ? `aniversário · ${a.anos} anos`
                      : `${a.anos} ${a.anos === 1 ? 'ano' : 'anos'} de casa`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Tempo de casa ---------- */}
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Tempo de casa</h2>
          {d.semAdmissao > 0 && (
            <p className="mb-3 text-sm text-[var(--warn)]">
              {d.semAdmissao} de {d.totalPessoas} sem data de admissão — fora deste gráfico.
            </p>
          )}

          {d.totalPessoas - d.semAdmissao === 0 ? (
            <div className="cartao px-6 py-10 text-center">
              <p className="font-medium text-[var(--ink)]">Sem dados ainda</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-3)]">
                A data de admissão não veio na planilha original. Preencha no
                cadastro de cada pessoa para este gráfico ganhar vida.
              </p>
            </div>
          ) : (
            <div className="cartao p-5">
              <div className="mb-5 flex flex-wrap gap-6">
                <span>
                  <span className="stat-valor block">
                    {d.tempoMedioAnos!.toFixed(1)}
                  </span>
                  <span className="stat-rotulo">anos em média</span>
                </span>
                {d.maisAntigo && (
                  <span>
                    <span className="stat-valor block">{d.maisAntigo.nome.split(' ')[0]}</span>
                    <span className="stat-rotulo">mais antigo · {d.maisAntigo.anos} anos</span>
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {d.tempoDeCasa.map((f) => (
                  <div key={f.faixa} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-[var(--ink-2)]">{f.faixa}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-[3px] bg-[var(--surface-2)]">
                      <div className="h-full rounded-[3px] transition-all"
                        style={{
                          width: `${Math.max((f.total / maxTempo) * 100, f.total > 0 ? 4 : 0)}%`,
                          background: 'var(--accent)',
                        }} />
                    </div>
                    <span className="num w-8 shrink-0 text-right text-sm font-semibold text-[var(--ink)]">
                      {f.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------- Clima ---------- */}
        <section className="mt-10 mb-4">
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Clima cultural</h2>
          {d.semAvaliacao > 0 && (
            <p className="mb-3 text-sm text-[var(--ink-3)]">
              {d.semAvaliacao} de {d.totalPessoas} ainda sem avaliação registrada.
            </p>
          )}

          {totalClima === 0 ? (
            <div className="cartao px-6 py-10 text-center">
              <p className="font-medium text-[var(--ink)]">Nenhuma avaliação registrada</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-3)]">
                Use o botão <em>avaliar</em> no painel para registrar o clima de
                cada pessoa. O gráfico considera sempre a avaliação mais recente.
              </p>
            </div>
          ) : (
            <div className="cartao p-5">
              {d.notaMedia !== null && (
                <div className="mb-5">
                  <span className="stat-valor block">{d.notaMedia.toFixed(1)}</span>
                  <span className="stat-rotulo">nota média · {totalClima} avaliados</span>
                </div>
              )}

              {/* Barra proporcional: mostra a distribuição em uma linha só */}
              <div className="mb-4 flex h-7 w-full overflow-hidden rounded-[3px]">
                {d.clima.filter((c) => c.total > 0).map((c) => (
                  <div key={c.classificacao}
                    title={`${CLIMA[c.classificacao].label}: ${c.total}`}
                    style={{
                      width: `${(c.total / totalClima) * 100}%`,
                      background: CLIMA[c.classificacao].cor,
                    }} />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {d.clima.map((c) => (
                  <div key={c.classificacao} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-[2px]"
                      style={{ background: CLIMA[c.classificacao].cor }} />
                    <span className="text-xs text-[var(--ink-2)]">
                      {CLIMA[c.classificacao].label}
                    </span>
                    <span className="num ml-auto text-sm font-semibold text-[var(--ink)]">
                      {c.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
