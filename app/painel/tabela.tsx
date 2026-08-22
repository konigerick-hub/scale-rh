'use client';

import { useMemo, useState } from 'react';
import type { PessoaAgrupada } from '@/lib/queries/colaboradores';
import ColaboradorForm, { type EmpresaOpcao, type ColaboradorEdicao, type CampoExtra, DOCS_VAZIOS } from './colaborador-form';
import GerarContrato, { type ModeloOpcao } from './gerar-contrato';
import AvaliacaoForm from './avaliacao-form';
import Contrato from './contrato';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CLIMA: Record<string, { label: string; cor: string }> = {
  excelente: { label: 'Excelente', cor: 'var(--clima-excelente)' },
  saudavel: { label: 'Saudável', cor: 'var(--clima-saudavel)' },
  atencao: { label: 'Atenção', cor: 'var(--clima-atencao)' },
  critico: { label: 'Crítico', cor: 'var(--clima-critico)' },
};

/** Cor da empresa por nome, com fallback para empresas cadastradas depois. */
function corEmpresa(nome: string): string {
  if (nome.includes('Scale')) return 'var(--empresa-scale)';
  if (nome.includes('Acelera')) return 'var(--empresa-imob)';
  if (nome.includes('Ótico') || nome.includes('Otico')) return 'var(--empresa-otico)';
  return 'var(--ink-3)';
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter((x) => x.length > 2);
  return ((p[0]?.[0] ?? nome[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

type Props = {
  pessoas: PessoaAgrupada[];
  empresas: EmpresaOpcao[];
  podeEditar: boolean;
  podeVerContrato: boolean;
  envioDireto: boolean;
  modelos: ModeloOpcao[];
  camposExtras: CampoExtra[];
};

export default function Tabela({
  pessoas,
  empresas,
  podeEditar,
  podeVerContrato,
  envioDireto,
  modelos,
  camposExtras,
}: Props) {
  const [busca, setBusca] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [editando, setEditando] = useState<ColaboradorEdicao | null>(null);
  const [criando, setCriando] = useState(false);
  const [avaliando, setAvaliando] = useState<{ id: string; nome: string } | null>(null);
  const [gerando, setGerando] = useState<PessoaAgrupada | null>(null);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pessoas
      .filter(
        (p) =>
          !t ||
          p.nome.toLowerCase().includes(t) ||
          p.vinculos.some((v) => v.cargo.toLowerCase().includes(t)),
      )
      .filter((p) => !filtroEmpresa || p.vinculos.some((v) => v.empresaId === filtroEmpresa));
  }, [pessoas, busca, filtroEmpresa]);

  const filtrando = busca.trim() !== '' || filtroEmpresa !== '';

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
      documentos: p.documentos ?? DOCS_VAZIOS,
    });
  }

  const colunas = 4 + (podeVerContrato ? 1 : 0) + (podeEditar ? 1 : 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou cargo…"
            aria-label="Buscar colaborador"
            className="campo pl-9"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
          </svg>
        </div>

        {empresas.length > 1 && (
          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            aria-label="Filtrar por empresa"
            className="campo w-auto"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        )}

        {podeEditar && (
          <button onClick={() => setCriando(true)} className="btn btn-primario">
            <span aria-hidden="true">+</span> Novo colaborador
          </button>
        )}
      </div>

      {filtrando && (
        <p className="mb-3 text-sm text-[var(--ink-3)]">
          {filtradas.length === 0
            ? 'Nenhum resultado.'
            : `${filtradas.length} de ${pessoas.length} ${pessoas.length === 1 ? 'pessoa' : 'pessoas'}`}
          <button
            onClick={() => { setBusca(''); setFiltroEmpresa(''); }}
            className="ml-2 text-[var(--accent)] underline underline-offset-2"
          >
            limpar
          </button>
        </p>
      )}

      {filtradas.length === 0 ? (
        <div className="cartao px-6 py-14 text-center">
          <p className="font-medium text-[var(--ink)]">
            {filtrando ? 'Nenhum colaborador encontrado' : 'Nenhum colaborador cadastrado'}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-3)]">
            {filtrando
              ? 'Tente outro termo de busca ou limpe os filtros.'
              : 'Comece cadastrando a primeira pessoa.'}
          </p>
        </div>
      ) : (
        <div className="tabela-envolucro">
          <div className="tabela-rolagem">
            <table className="dados" style={{ minWidth: `${colunas * 8}rem` }}>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Empresa &amp; cargo</th>
                  <th className="text-right">Remuneração</th>
                  <th>Clima</th>
                  {podeVerContrato && <th>Contrato</th>}
                  {podeEditar && <th aria-label="Ações" />}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => {
                  const total = p.vinculos.reduce((a, v) => a + v.valor, 0);
                  const clima = p.ultimaAvaliacao ? CLIMA[p.ultimaAvaliacao.classificacao] : null;

                  return (
                    <tr key={p.id}>
                      <td data-rotulo="Colaborador">
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[.7rem] font-semibold"
                            style={{
                              background: 'var(--accent-wash)',
                              color: 'var(--accent-ink)',
                            }}
                          >
                            {iniciais(p.nome)}
                          </span>
                          <span>
                            <span className="block font-medium text-[var(--ink)]">{p.nome}</span>
                            <span className="block text-xs text-[var(--ink-3)]">
                              {p.dataContratacao
                                ? `desde ${p.dataContratacao.split('-').reverse().join('/')}`
                                : 'sem data de admissão'}
                            </span>
                          </span>
                        </div>
                      </td>

                      <td data-rotulo="Empresa">
                        <div className="flex flex-col items-end gap-1.5 md:items-start">
                          {p.vinculos.map((v) => (
                            <span key={v.empresaId} className="flex flex-wrap items-center gap-2">
                              <span
                                className="chip"
                                style={{ ['--chip-cor' as string]: corEmpresa(v.empresaNome) } as React.CSSProperties}
                              >
                                {v.empresaNome}
                              </span>
                              <span className="text-xs text-[var(--ink-2)]">{v.cargo}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td data-rotulo="Remuneração" className="md:text-right">
                        <div className="num flex flex-col items-end gap-1.5">
                          {p.vinculos.map((v) => (
                            <span key={v.empresaId} className="text-[var(--ink)]">
                              {brl.format(v.valor)}
                            </span>
                          ))}
                          {p.vinculos.length > 1 && (
                            <span className="border-t border-[var(--line)] pt-1 text-xs font-semibold text-[var(--ink-3)]">
                              {brl.format(total)} total
                            </span>
                          )}
                        </div>
                      </td>

                      <td data-rotulo="Clima">
                        {clima && p.ultimaAvaliacao ? (
                          <span
                            className="chip-suave"
                            style={{
                              color: clima.cor,
                              borderColor: `color-mix(in srgb, ${clima.cor} 45%, transparent)`,
                              background: `color-mix(in srgb, ${clima.cor} 12%, transparent)`,
                            }}
                            title={`Referente a ${p.ultimaAvaliacao.mes}`}
                          >
                            {clima.label} · {p.ultimaAvaliacao.nota}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--ink-3)]">sem registro</span>
                        )}
                      </td>

                      {podeVerContrato && (
                        <td data-rotulo="Contrato">
                          <div className="flex flex-col items-end gap-1 md:items-start">
                            <Contrato
                              colaboradorId={p.id}
                              colaboradorNome={p.nome}
                              temContrato={p.temContrato}
                              envioDireto={envioDireto}
                            />
                            <button
                              onClick={() => setGerando(p)}
                              className="btn btn-secundario btn-mini"
                            >
                              gerar contrato
                            </button>
                          </div>
                        </td>
                      )}

                      {podeEditar && (
                        <td data-rotulo="Ações">
                          <div className="acoes-linha flex justify-end gap-1">
                            <button
                              onClick={() => setAvaliando({ id: p.id, nome: p.nome })}
                              className="btn btn-secundario btn-mini"
                            >
                              avaliar
                            </button>
                            <button
                              onClick={() => abrirEdicao(p)}
                              className="btn btn-secundario btn-mini"
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
        </div>
      )}

      {(criando || editando) && (
        <ColaboradorForm
          empresas={empresas}
          inicial={editando}
          podeVerDocumentos={podeVerContrato}
          camposExtras={camposExtras}
          aoFechar={() => { setCriando(false); setEditando(null); }}
        />
      )}

      {gerando && (
        <GerarContrato
          colaboradorId={gerando.id}
          colaboradorNome={gerando.nome}
          modelos={modelos}
          vinculos={gerando.vinculos.map((v) => ({
            id: v.vinculoId,
            empresaNome: v.empresaNome,
            cargo: v.cargo,
          }))}
          aoFechar={() => setGerando(null)}
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
