'use client';

import { useState, useTransition } from 'react';
import { registrarAvaliacao } from '@/lib/actions/colaboradores';

const CLIMAS = [
  { valor: 'excelente', label: 'Excelente', cor: '#2F6F52' },
  { valor: 'saudavel', label: 'Saudável', cor: '#2F6F9E' },
  { valor: 'atencao', label: 'Atenção', cor: '#B8862B' },
  { valor: 'critico', label: 'Crítico', cor: '#9C4A3C' },
] as const;

type Props = { colaboradorId: string; colaboradorNome: string; aoFechar: () => void };

export default function AvaliacaoForm({ colaboradorId, colaboradorNome, aoFechar }: Props) {
  const agora = new Date();
  const [mes, setMes] = useState(
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
  );
  const [classificacao, setClassificacao] = useState<string>('');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!classificacao) { setErro('Escolha uma classificação.'); return; }
    iniciar(async () => {
      const r = await registrarAvaliacao(colaboradorId, {
        mes,
        classificacao: classificacao as 'excelente' | 'saudavel' | 'atencao' | 'critico',
        nota: Number(nota),
      });
      if (r.ok) aoFechar();
      else setErro(r.erro);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <form onSubmit={enviar}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-neutral-900">Avaliação de clima</h2>
        <p className="mb-5 mt-0.5 text-sm text-neutral-500">{colaboradorNome}</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-600" htmlFor="a-mes">
              Mês de referência
            </label>
            <input id="a-mes" type="month" required value={mes} onChange={(e) => setMes(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-600">
              Classificação
            </span>
            <div className="grid grid-cols-2 gap-2">
              {CLIMAS.map((c) => (
                <button key={c.valor} type="button" onClick={() => setClassificacao(c.valor)}
                  aria-pressed={classificacao === c.valor}
                  className="rounded-md border px-3 py-2 text-sm font-medium transition"
                  style={
                    classificacao === c.valor
                      ? { borderColor: c.cor, backgroundColor: c.cor, color: '#fff' }
                      : { borderColor: '#D4D4D4', color: c.cor }
                  }>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-600" htmlFor="a-nota">
              Nota (0 a 10)
            </label>
            <input id="a-nota" type="number" min="0" max="10" step="0.5" required
              value={nota} onChange={(e) => setNota(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
          </div>
        </div>

        {erro && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={aoFechar}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
            Cancelar
          </button>
          <button type="submit" disabled={salvando}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
