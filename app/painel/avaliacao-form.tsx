'use client';

import { useState, useTransition } from 'react';
import { registrarAvaliacao } from '@/lib/actions/colaboradores';

// Cores vêm dos tokens para acompanhar o tema claro/escuro.
const CLIMAS = [
  { valor: 'excelente', label: 'Excelente', cor: 'var(--clima-excelente)' },
  { valor: 'saudavel', label: 'Saudável', cor: 'var(--clima-saudavel)' },
  { valor: 'atencao', label: 'Atenção', cor: 'var(--clima-atencao)' },
  { valor: 'critico', label: 'Crítico', cor: 'var(--clima-critico)' },
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
      className="overlay"
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <form onSubmit={enviar}
        className="modal max-w-sm">
        <h2 className="text-lg font-semibold tracking-tight">Avaliação de clima</h2>
        <p className="mb-5 mt-0.5 text-sm text-[var(--ink-3)]">{colaboradorNome}</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="campo-rotulo" htmlFor="a-mes">
              Mês de referência
            </label>
            <input id="a-mes" type="month" required value={mes} onChange={(e) => setMes(e.target.value)}
              className="campo" />
          </div>

          <div>
            <span className="campo-rotulo">
              Classificação
            </span>
            <div className="grid grid-cols-2 gap-2">
              {CLIMAS.map((c) => (
                <button key={c.valor} type="button" onClick={() => setClassificacao(c.valor)}
                  aria-pressed={classificacao === c.valor}
                  className="rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium transition"
                  style={
                    classificacao === c.valor
                      ? { borderColor: c.cor, backgroundColor: c.cor, color: '#fff' }
                      : { borderColor: 'var(--line)', color: c.cor }
                  }>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="campo-rotulo" htmlFor="a-nota">
              Nota (0 a 10)
            </label>
            <input id="a-nota" type="number" min="0" max="10" step="0.5" required
              value={nota} onChange={(e) => setNota(e.target.value)}
              className="campo" />
          </div>
        </div>

        {erro && <p role="alert" className="aviso-erro mt-4">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={aoFechar}
            className="btn btn-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={salvando}
            className="btn btn-primario">
            {salvando ? 'Salvando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
