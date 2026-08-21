'use client';

import { useMemo, useState } from 'react';
import type { PessoaAgrupada } from '@/lib/queries/colaboradores';
import ColaboradorForm, { type EmpresaOpcao, type ColaboradorEdicao } from './colaborador-form';
import AvaliacaoForm from './avaliacao-form';
import Contrato from './contrato';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CLIMA_COR: Record<string, string> = {
  excelente: '#2F6F52',
  saudavel: '#2F6F9E',
  atencao: '#B8862B',
  critico: '#9C4A3C',
};
const CLIMA_LABEL: Record<string, string> = {
  excelente: 'Excelente',
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
};

type Props = {
  pessoas: PessoaAgrupada[];
  empresas: EmpresaOpcao[];
  podeEditar: boolean;
  podeVerContrato: boolean;
  envioDireto: boolean;
};

export default function Tabela({
  pessoas,
  empresas,
  podeEditar,
  podeVerContrato,
  envioDireto,
}: Props) {
  const [busca, setBusca] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [editando, setEditando] = useState<ColaboradorEdicao | null>(null);
  const [criando, setCriando] = useState(false);
  const [avaliando, setAvaliando] = useState<{ id: string; nome: string } | null>(null);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pessoas
      .filter((p) =>
        !t ||
        p.nome.toLowerCase().includes(t) ||
        p.vinculos.some((v) => v.cargo.toLowerCase().includes(t)),
      )
      .filter((p) => !filtroEmpresa || p.vinculos.some((v) => v.empresaId === filtroEmpresa));
  }, [pessoas, busca, filtroEmpresa]);

  function abrirEdicao(p: PessoaAgrupada) {
    setEditando({
      id: p.id,
      nome: p.nome,
      nascimento: p.nascimento,
      dataContratacao: p.dataContratacao,
      vinculos: p.vinculos.map((v) => ({
        empresaId: v.empresaId,
        cargo: v.cargo,
        valor: v.valor,
      })),
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou cargo…"
          aria-label="Buscar"
          className="min-w-52 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
        />
        {empresas.length > 1 && (
          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            aria-label="Filtrar por empresa"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        )}
        {podeEditar && (
          <button
            onClick={() => setCriando(true)}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Novo colaborador
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Nenhum colaborador encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Empresa · cargo</th>
                <th className="px-4 py-3 text-right font-medium">Remuneração</th>
                <th className="px-4 py-3 font-medium">Clima</th>
                {podeVerContrato && <th className="px-4 py-3 font-medium">Contrato</th>}
                {podeEditar && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtradas.map((p) => {
                const total = p.vinculos.reduce((a, v) => a + v.valor, 0);
                return (
                  <tr key={p.id} className="align-top hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{p.nome}</div>
                      {p.dataContratacao && (
                        <div className="text-xs text-neutral-500">
                          desde {p.dataContratacao.split('-').reverse().join('/')}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {p.vinculos.map((v) => (
                          <div key={v.empresaId} className="flex items-center gap-2">
                            <span
                              className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              style={{ backgroundColor: v.empresaCor }}
                            >
                              {v.empresaNome}
                            </span>
                            <span className="text-xs text-neutral-600">{v.cargo}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex flex-col gap-1">
                        {p.vinculos.map((v) => (
                          <span key={v.empresaId} className="text-neutral-900">
                            {brl.format(v.valor)}
                          </span>
                        ))}
                        {p.vinculos.length > 1 && (
                          <span className="border-t border-neutral-200 pt-1 text-xs font-medium text-neutral-500">
                            {brl.format(total)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {p.ultimaAvaliacao ? (
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: CLIMA_COR[p.ultimaAvaliacao.classificacao] }}
                          title={`Referente a ${p.ultimaAvaliacao.mes}`}
                        >
                          {CLIMA_LABEL[p.ultimaAvaliacao.classificacao]} · {p.ultimaAvaliacao.nota}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">sem registro</span>
                      )}
                    </td>

                    {podeVerContrato && (
                      <td className="px-4 py-3">
                        <Contrato
                          colaboradorId={p.id}
                          colaboradorNome={p.nome}
                          temContrato={p.temContrato}
                          envioDireto={envioDireto}
                        />
                      </td>
                    )}

                    {podeEditar && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setAvaliando({ id: p.id, nome: p.nome })}
                            className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-white"
                          >
                            avaliar
                          </button>
                          <button
                            onClick={() => abrirEdicao(p)}
                            className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-white"
                          >
                            editar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(criando || editando) && (
        <ColaboradorForm
          empresas={empresas}
          inicial={editando}
          aoFechar={() => { setCriando(false); setEditando(null); }}
        />
      )}

      {avaliando && (
        <AvaliacaoForm
          colaboradorId={avaliando.id}
          colaboradorNome={avaliando.nome}
          aoFechar={() => setAvaliando(null)}
        />
      )}
    </>
  );
}
