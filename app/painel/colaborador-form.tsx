'use client';

import { useState, useTransition } from 'react';
import { salvarColaborador, desligarColaborador } from '@/lib/actions/colaboradores';

export type EmpresaOpcao = { id: string; nome: string };

export type ColaboradorEdicao = {
  id: string;
  nome: string;
  nascimento: string | null;
  dataContratacao: string | null;
  vinculos: { empresaId: string; cargo: string; valor: number }[];
};

type Props = {
  empresas: EmpresaOpcao[];
  inicial: ColaboradorEdicao | null;
  aoFechar: () => void;
};

const campo =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600';
const rotulo = 'block text-xs font-medium uppercase tracking-wide text-neutral-600 mb-1';

export default function ColaboradorForm({ empresas, inicial, aoFechar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [nascimento, setNascimento] = useState(inicial?.nascimento ?? '');
  const [contratacao, setContratacao] = useState(inicial?.dataContratacao ?? '');
  const [vinculos, setVinculos] = useState(
    inicial?.vinculos.length
      ? inicial.vinculos
      : [{ empresaId: empresas[0]?.id ?? '', cargo: '', valor: 0 }],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function alterarVinculo(i: number, campos: Partial<(typeof vinculos)[number]>) {
    setVinculos((v) => v.map((x, j) => (j === i ? { ...x, ...campos } : x)));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await salvarColaborador(inicial?.id ?? null, {
        nome,
        nascimento: nascimento || null,
        dataContratacao: contratacao || null,
        vinculos,
      });
      if (r.ok) aoFechar();
      else setErro(r.erro);
    });
  }

  function desligar() {
    if (!inicial) return;
    if (!confirm(`Desligar ${inicial.nome}? O histórico é preservado, mas o contrato em PDF será apagado.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await desligarColaborador(inicial.id);
      if (r.ok) aoFechar();
      else setErro(r.erro);
    });
  }

  const disponiveis = (i: number) =>
    empresas.filter(
      (e) => e.id === vinculos[i].empresaId || !vinculos.some((v) => v.empresaId === e.id),
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <form
        onSubmit={enviar}
        className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
      >
        <h2 className="mb-5 text-lg font-semibold text-neutral-900">
          {inicial ? 'Editar colaborador' : 'Novo colaborador'}
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className={rotulo} htmlFor="f-nome">Nome</label>
            <input id="f-nome" className={campo} value={nome}
              onChange={(e) => setNome(e.target.value)} required maxLength={120} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo} htmlFor="f-nasc">Nascimento</label>
              <input id="f-nasc" type="date" className={campo} value={nascimento}
                onChange={(e) => setNascimento(e.target.value)} />
            </div>
            <div>
              <label className={rotulo} htmlFor="f-adm">Admissão</label>
              <input id="f-adm" type="date" className={campo} value={contratacao}
                onChange={(e) => setContratacao(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={rotulo}>Empresas e remuneração</span>

            {vinculos.map((v, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center gap-2">
                  <select
                    className={campo}
                    value={v.empresaId}
                    onChange={(e) => alterarVinculo(i, { empresaId: e.target.value })}
                    aria-label="Empresa"
                  >
                    {disponiveis(i).map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                  {vinculos.length > 1 && (
                    <button type="button" aria-label="Remover empresa"
                      onClick={() => setVinculos((x) => x.filter((_, j) => j !== i))}
                      className="shrink-0 rounded border border-neutral-300 px-2 py-2 text-xs text-neutral-600 hover:bg-white">
                      remover
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={campo} placeholder="Cargo" value={v.cargo}
                    onChange={(e) => alterarVinculo(i, { cargo: e.target.value })}
                    required maxLength={120} aria-label="Cargo" />
                  <input className={campo} type="number" min="0" step="0.01"
                    placeholder="Valor (R$)" value={v.valor}
                    onChange={(e) => alterarVinculo(i, { valor: Number(e.target.value) })}
                    required aria-label="Remuneração fixa" />
                </div>
              </div>
            ))}

            {vinculos.length < empresas.length && (
              <button type="button"
                onClick={() => {
                  const livre = empresas.find((e) => !vinculos.some((v) => v.empresaId === e.id));
                  if (livre) setVinculos((v) => [...v, { empresaId: livre.id, cargo: '', valor: 0 }]);
                }}
                className="self-start rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
                + outra empresa
              </button>
            )}
            <p className="text-xs text-neutral-500">
              Quem atua em mais de uma empresa recebe um vínculo por empresa, cada um com seu valor.
            </p>
          </div>
        </div>

        {erro && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {inicial ? (
            <button type="button" onClick={desligar} disabled={salvando}
              className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
              Desligar
            </button>
          ) : <span />}

          <div className="flex gap-2">
            <button type="button" onClick={aoFechar} disabled={salvando}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
