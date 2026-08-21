'use client';

import { useState, useTransition } from 'react';
import { salvarColaborador, desligarColaborador } from '@/lib/actions/colaboradores';
import { salvarDocumentos } from '@/lib/actions/modelos';

export type EmpresaOpcao = { id: string; nome: string };

export type DocumentosEdicao = {
  cpf: string;
  rg: string;
  nacionalidade: string;
  estadoCivil: string;
  endereco: string;
};

export const DOCS_VAZIOS: DocumentosEdicao = {
  cpf: '', rg: '', nacionalidade: '', estadoCivil: '', endereco: '',
};

export type ColaboradorEdicao = {
  id: string;
  nome: string;
  nascimento: string | null;
  dataContratacao: string | null;
  vinculos: { empresaId: string; cargo: string; valor: number }[];
  documentos: DocumentosEdicao;
};

type Props = {
  empresas: EmpresaOpcao[];
  inicial: ColaboradorEdicao | null;
  /** Dados pessoais só aparecem para quem pode ver contrato (admin). */
  podeVerDocumentos: boolean;
  aoFechar: () => void;
};

const campo = 'campo';
const rotulo = 'campo-rotulo';

export default function ColaboradorForm({
  empresas,
  inicial,
  podeVerDocumentos,
  aoFechar,
}: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [nascimento, setNascimento] = useState(inicial?.nascimento ?? '');
  const [contratacao, setContratacao] = useState(inicial?.dataContratacao ?? '');
  const [vinculos, setVinculos] = useState(
    inicial?.vinculos.length
      ? inicial.vinculos
      : [{ empresaId: empresas[0]?.id ?? '', cargo: '', valor: 0 }],
  );
  const [docs, setDocs] = useState<DocumentosEdicao>(inicial?.documentos ?? DOCS_VAZIOS);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const mudarDoc = (campos: Partial<DocumentosEdicao>) =>
    setDocs((d) => ({ ...d, ...campos }));

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
      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      // Os documentos vão em uma ação separada porque são dados pessoais com
      // permissão própria — quem não pode vê-los nem envia esses campos.
      if (podeVerDocumentos) {
        const rd = await salvarDocumentos(r.id, docs);
        if (!rd.ok) {
          // O colaborador já foi salvo; avisar em vez de fingir que nada ocorreu.
          setErro(`Colaborador salvo, mas os documentos não: ${rd.erro}`);
          return;
        }
      }
      aoFechar();
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
      className="overlay"
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <form
        onSubmit={enviar}
        className="modal max-w-lg"
      >
        <h2 className="mb-5 text-lg font-semibold tracking-tight">
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
              <div key={i} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
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
                      className="btn btn-secundario btn-mini shrink-0">
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
                className="btn btn-secundario btn-mini self-start border-dashed">
                + outra empresa
              </button>
            )}
            <p className="text-xs text-[var(--ink-3)]">
              Quem atua em mais de uma empresa recebe um vínculo por empresa, cada um com seu valor.
            </p>
          </div>

          {podeVerDocumentos && (
            <details className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <summary className="cursor-pointer text-sm font-medium text-[var(--ink-2)]">
                Dados para o contrato
                <span className="ml-2 font-normal text-xs text-[var(--ink-3)]">
                  CPF, RG, endereço — usados ao gerar o contrato
                </span>
              </summary>

              <div className="mt-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo} htmlFor="d-cpf">CPF</label>
                    <input id="d-cpf" className={campo} maxLength={20} placeholder="000.000.000-00"
                      value={docs.cpf} onChange={(e) => mudarDoc({ cpf: e.target.value })} />
                  </div>
                  <div>
                    <label className={rotulo} htmlFor="d-rg">RG</label>
                    <input id="d-rg" className={campo} maxLength={30}
                      value={docs.rg} onChange={(e) => mudarDoc({ rg: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo} htmlFor="d-nac">Nacionalidade</label>
                    <input id="d-nac" className={campo} maxLength={60} placeholder="brasileiro(a)"
                      value={docs.nacionalidade} onChange={(e) => mudarDoc({ nacionalidade: e.target.value })} />
                  </div>
                  <div>
                    <label className={rotulo} htmlFor="d-ec">Estado civil</label>
                    <input id="d-ec" className={campo} maxLength={40} placeholder="solteiro(a)"
                      value={docs.estadoCivil} onChange={(e) => mudarDoc({ estadoCivil: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className={rotulo} htmlFor="d-end">Endereço completo</label>
                  <input id="d-end" className={campo} maxLength={300}
                    placeholder="Rua, número, bairro, cidade — UF, CEP"
                    value={docs.endereco} onChange={(e) => mudarDoc({ endereco: e.target.value })} />
                </div>

                <p className="text-xs text-[var(--ink-3)]">
                  Campo em branco vira uma linha para preencher à mão no contrato
                  impresso — nada fica com &quot;undefined&quot;.
                </p>
              </div>
            </details>
          )}
        </div>

        {erro && (
          <p role="alert" className="aviso-erro mt-4">{erro}</p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {inicial ? (
            <button type="button" onClick={desligar} disabled={salvando}
              className="btn btn-perigo">
              Desligar
            </button>
          ) : <span />}

          <div className="flex gap-2">
            <button type="button" onClick={aoFechar} disabled={salvando}
              className="btn btn-secundario">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="btn btn-primario">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
