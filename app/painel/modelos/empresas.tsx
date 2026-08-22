'use client';

import { useState, useTransition } from 'react';
import {
  salvarDadosEmpresa,
  criarCampoPersonalizado,
  removerCampoPersonalizado,
} from '@/lib/actions/modelos';

export type EmpresaDados = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  representante: string;
  representanteCpf: string;
};

export type Campo = { chave: string; rotulo: string };

/**
 * Dados da CONTRATANTE e campos personalizados.
 *
 * Os dados da empresa são preenchidos uma vez e valem para todos os contratos
 * dela — diferente dos dados do MEI, que são por pessoa.
 */
export default function Empresas({
  empresas,
  campos,
}: {
  empresas: EmpresaDados[];
  campos: Campo[];
}) {
  const [dados, setDados] = useState(empresas);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoCampo, setNovoCampo] = useState('');
  const [pendente, iniciar] = useTransition();

  const mudar = (id: string, campos: Partial<EmpresaDados>) =>
    setDados((d) => d.map((e) => (e.id === id ? { ...e, ...campos } : e)));

  function salvar(e: EmpresaDados) {
    setErro(null);
    setSalvo(null);
    iniciar(async () => {
      const r = await salvarDadosEmpresa(e.id, {
        razaoSocial: e.razaoSocial,
        cnpj: e.cnpj,
        endereco: e.endereco,
        representante: e.representante,
        representanteCpf: e.representanteCpf,
      });
      if (r.ok) setSalvo(e.id);
      else setErro(r.erro);
    });
  }

  function adicionarCampo(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await criarCampoPersonalizado({ rotulo: novoCampo });
      if (r.ok) setNovoCampo('');
      else setErro(r.erro);
    });
  }

  function removerCampo(chave: string) {
    setErro(null);
    iniciar(async () => {
      const r = await removerCampoPersonalizado(chave);
      if (!r.ok) setErro(r.erro);
    });
  }

  const incompleta = (e: EmpresaDados) => !e.cnpj.trim() || !e.razaoSocial.trim();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Dados das empresas</h2>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-[var(--ink-3)]">
          A empresa é a CONTRATANTE do contrato. Preencha uma vez e vale para
          todos os contratos dela. Sem CNPJ e razão social, esses campos saem
          como linhas em branco no documento.
        </p>

        {erro && <p role="alert" className="aviso-erro mb-4">{erro}</p>}

        <div className="flex flex-col gap-3">
          {dados.map((e) => (
            <details key={e.id} className="cartao p-4" open={incompleta(e)}>
              <summary className="cursor-pointer font-medium text-[var(--ink)]">
                {e.nome}
                {incompleta(e) && (
                  <span className="ml-2 text-xs font-normal text-[var(--warn)]">
                    faltam dados
                  </span>
                )}
                {salvo === e.id && (
                  <span className="ml-2 text-xs font-normal text-[var(--accent)]">salvo</span>
                )}
              </summary>

              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="campo-rotulo" htmlFor={`rs-${e.id}`}>Razão social</label>
                  <input id={`rs-${e.id}`} className="campo" maxLength={160}
                    value={e.razaoSocial}
                    onChange={(ev) => mudar(e.id, { razaoSocial: ev.target.value })} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="campo-rotulo" htmlFor={`cn-${e.id}`}>CNPJ</label>
                    <input id={`cn-${e.id}`} className="campo" maxLength={20}
                      placeholder="00.000.000/0001-00"
                      value={e.cnpj}
                      onChange={(ev) => mudar(e.id, { cnpj: ev.target.value })} />
                  </div>
                  <div>
                    <label className="campo-rotulo" htmlFor={`rp-${e.id}`}>Quem assina</label>
                    <input id={`rp-${e.id}`} className="campo" maxLength={120}
                      value={e.representante}
                      onChange={(ev) => mudar(e.id, { representante: ev.target.value })} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                  <div>
                    <label className="campo-rotulo" htmlFor={`en-${e.id}`}>Endereço da sede</label>
                    <input id={`en-${e.id}`} className="campo" maxLength={300}
                      value={e.endereco}
                      onChange={(ev) => mudar(e.id, { endereco: ev.target.value })} />
                  </div>
                  <div>
                    <label className="campo-rotulo" htmlFor={`rc-${e.id}`}>CPF de quem assina</label>
                    <input id={`rc-${e.id}`} className="campo" maxLength={20}
                      value={e.representanteCpf}
                      onChange={(ev) => mudar(e.id, { representanteCpf: ev.target.value })} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => salvar(e)} disabled={pendente}
                    className="btn btn-primario btn-mini">
                    {pendente ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Campos personalizados</h2>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-[var(--ink-3)]">
          Precisa de um dado que não está na lista de marcadores? Crie aqui. Ele
          vira um marcador para usar no modelo e um campo para preencher no
          cadastro de cada pessoa.
        </p>

        <form onSubmit={adicionarCampo} className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <label className="campo-rotulo" htmlFor="novo-campo">Nome do campo</label>
            <input id="novo-campo" className="campo" required maxLength={60}
              placeholder="Ex: Banco e conta, Chave PIX, CNAE"
              value={novoCampo} onChange={(e) => setNovoCampo(e.target.value)} />
          </div>
          <button type="submit" disabled={pendente} className="btn btn-secundario">
            Adicionar
          </button>
        </form>

        {campos.length === 0 ? (
          <p className="text-sm text-[var(--ink-3)]">Nenhum campo personalizado ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {campos.map((c) => (
              <span key={c.chave}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5">
                <span className="text-sm text-[var(--ink-2)]">{c.rotulo}</span>
                <code className="text-xs text-[var(--ink-3)]">{`{{${c.chave}}}`}</code>
                <button onClick={() => removerCampo(c.chave)} disabled={pendente}
                  aria-label={`Remover ${c.rotulo}`}
                  className="text-[var(--danger)] hover:opacity-70">×</button>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
