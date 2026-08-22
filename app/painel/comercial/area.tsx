'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { gerarContratoComercial } from '@/lib/actions/comercial';
import ModelosComerciais, { type ModeloComercialEdicao } from './modelos';

type Empresa = { id: string; nome: string; temDados: boolean };
type Marcador = { chave: string; descricao: string; grupo: string };
type Historico = {
  id: string;
  cliente: string;
  valor: number;
  modeloNome: string;
  empresaNome: string;
  geradoPorNome: string;
  geradoEm: string;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CLIENTE_VAZIO = {
  razaoSocial: '', documento: '', endereco: '', representante: '',
  representanteCpf: '', email: '', telefone: '', objeto: '',
  valor: '', formaPagamento: '', vigencia: '',
};

export default function AreaComercial({
  empresas,
  modelos,
  historico,
  podeEditarModelos,
  marcadores,
  verTodos,
}: {
  empresas: Empresa[];
  modelos: ModeloComercialEdicao[];
  historico: Historico[];
  podeEditarModelos: boolean;
  marcadores: Marcador[];
  verTodos: boolean;
}) {
  const [aba, setAba] = useState<'gerar' | 'historico' | 'modelos'>('gerar');
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? '');
  const [modeloId, setModeloId] = useState('');
  const [cliente, setCliente] = useState(CLIENTE_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<{ id: string; cliente: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const modelosDaEmpresa = useMemo(
    () => modelos.filter((m) => m.empresaId === empresaId),
    [modelos, empresaId],
  );

  const empresa = empresas.find((e) => e.id === empresaId);
  const mudar = (campos: Partial<typeof CLIENTE_VAZIO>) =>
    setCliente((c) => ({ ...c, ...campos }));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setGerado(null);
    const escolhido = modeloId || modelosDaEmpresa[0]?.id;
    if (!escolhido) {
      setErro('Escolha um modelo de contrato.');
      return;
    }
    iniciar(async () => {
      const r = await gerarContratoComercial(escolhido, {
        ...cliente,
        valor: Number(cliente.valor || 0),
      });
      if (r.ok) {
        setGerado({ id: r.id, cliente: cliente.razaoSocial });
        setCliente(CLIENTE_VAZIO);
      } else setErro(r.erro);
    });
  }

  const abas: [typeof aba, string][] = [
    ['gerar', 'Gerar contrato'],
    ['historico', verTodos ? 'Emitidos' : 'Meus contratos'],
    ...(podeEditarModelos ? ([['modelos', 'Modelos']] as [typeof aba, string][]) : []),
  ];

  return (
    <>
      <nav className="mb-6 mt-6 flex gap-1 border-b border-[var(--line)]">
        {abas.map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)}
            className="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition"
            style={{
              borderColor: aba === id ? 'var(--accent)' : 'transparent',
              color: aba === id ? 'var(--ink)' : 'var(--ink-3)',
            }}>
            {label}
          </button>
        ))}
      </nav>

      {aba === 'gerar' && (
        <>
          {gerado && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--accent-wash)] px-4 py-3">
              <span className="text-sm text-[var(--ink)]">
                Contrato de <strong>{gerado.cliente}</strong> gerado.
              </span>
              <a href={`/api/comercial/${gerado.id}`} download className="btn btn-primario btn-mini">
                Baixar PDF
              </a>
            </div>
          )}

          {modelosDaEmpresa.length === 0 ? (
            <div className="cartao px-6 py-12 text-center">
              <p className="font-medium text-[var(--ink)]">
                Nenhum modelo para esta empresa
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-3)]">
                {podeEditarModelos
                  ? 'Crie o modelo na aba Modelos para começar a emitir contratos.'
                  : 'Peça a um administrador para cadastrar o modelo de contrato desta empresa.'}
              </p>
              {empresas.length > 1 && (
                <select className="campo mx-auto mt-4 w-auto" value={empresaId}
                  onChange={(e) => { setEmpresaId(e.target.value); setModeloId(''); }}>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              )}
            </div>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-5">
              <div className="cartao p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="campo-rotulo" htmlFor="c-emp">Empresa contratada</label>
                    <select id="c-emp" className="campo" value={empresaId}
                      onChange={(e) => { setEmpresaId(e.target.value); setModeloId(''); }}>
                      {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="campo-rotulo" htmlFor="c-mod">Modelo</label>
                    <select id="c-mod" className="campo"
                      value={modeloId || modelosDaEmpresa[0]?.id}
                      onChange={(e) => setModeloId(e.target.value)}>
                      {modelosDaEmpresa.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {empresa && !empresa.temDados && (
                  <p className="mt-3 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[var(--warn-wash)] px-3 py-2 text-sm text-[var(--warn)]">
                    {empresa.nome} está sem CNPJ ou razão social cadastrados — esses
                    campos sairão em branco no contrato.
                    {podeEditarModelos && (
                      <> <Link href="/painel/modelos" className="underline">Preencher agora</Link>.</>
                    )}
                  </p>
                )}
              </div>

              <fieldset className="cartao flex flex-col gap-3 p-5">
                <legend className="campo-rotulo px-1">Cliente</legend>

                <div>
                  <label className="campo-rotulo" htmlFor="c-rs">Nome ou razão social</label>
                  <input id="c-rs" className="campo" required maxLength={160}
                    value={cliente.razaoSocial}
                    onChange={(e) => mudar({ razaoSocial: e.target.value })} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="campo-rotulo" htmlFor="c-doc">CNPJ ou CPF</label>
                    <input id="c-doc" className="campo" maxLength={24}
                      value={cliente.documento}
                      onChange={(e) => mudar({ documento: e.target.value })} />
                  </div>
                  <div>
                    <label className="campo-rotulo" htmlFor="c-tel">Telefone</label>
                    <input id="c-tel" className="campo" maxLength={30}
                      value={cliente.telefone}
                      onChange={(e) => mudar({ telefone: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="campo-rotulo" htmlFor="c-end">Endereço</label>
                  <input id="c-end" className="campo" maxLength={300}
                    value={cliente.endereco}
                    onChange={(e) => mudar({ endereco: e.target.value })} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="campo-rotulo" htmlFor="c-rep">Quem assina</label>
                    <input id="c-rep" className="campo" maxLength={120}
                      value={cliente.representante}
                      onChange={(e) => mudar({ representante: e.target.value })} />
                  </div>
                  <div>
                    <label className="campo-rotulo" htmlFor="c-rcpf">CPF de quem assina</label>
                    <input id="c-rcpf" className="campo" maxLength={24}
                      value={cliente.representanteCpf}
                      onChange={(e) => mudar({ representanteCpf: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="campo-rotulo" htmlFor="c-mail">E-mail</label>
                  <input id="c-mail" type="email" className="campo" maxLength={160}
                    value={cliente.email}
                    onChange={(e) => mudar({ email: e.target.value })} />
                </div>
              </fieldset>

              <fieldset className="cartao flex flex-col gap-3 p-5">
                <legend className="campo-rotulo px-1">Negócio</legend>

                <div>
                  <label className="campo-rotulo" htmlFor="c-obj">O que está sendo contratado</label>
                  <textarea id="c-obj" className="campo" rows={3} required maxLength={1000}
                    placeholder="Ex: gestão de tráfego pago e criação de campanhas"
                    value={cliente.objeto}
                    onChange={(e) => mudar({ objeto: e.target.value })} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="campo-rotulo" htmlFor="c-val">Valor (R$)</label>
                    <input id="c-val" type="number" min="0" step="0.01" className="campo"
                      required placeholder="0,00"
                      value={cliente.valor}
                      onChange={(e) => mudar({ valor: e.target.value })} />
                  </div>
                  <div>
                    <label className="campo-rotulo" htmlFor="c-pag">Forma de pagamento</label>
                    <input id="c-pag" className="campo" maxLength={200}
                      placeholder="Ex: mensal, todo dia 10"
                      value={cliente.formaPagamento}
                      onChange={(e) => mudar({ formaPagamento: e.target.value })} />
                  </div>
                  <div>
                    <label className="campo-rotulo" htmlFor="c-vig">Vigência</label>
                    <input id="c-vig" className="campo" maxLength={200}
                      placeholder="Ex: 12 meses"
                      value={cliente.vigencia}
                      onChange={(e) => mudar({ vigencia: e.target.value })} />
                  </div>
                </div>
              </fieldset>

              {erro && <p role="alert" className="aviso-erro">{erro}</p>}

              <div className="flex justify-end">
                <button type="submit" disabled={pendente} className="btn btn-primario">
                  {pendente ? 'Gerando…' : 'Gerar contrato'}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {aba === 'historico' && (
        historico.length === 0 ? (
          <div className="cartao px-6 py-12 text-center">
            <p className="font-medium text-[var(--ink)]">Nenhum contrato emitido ainda</p>
            <p className="mt-1.5 text-sm text-[var(--ink-3)]">
              Os contratos que você gerar aparecem aqui e podem ser baixados de novo.
            </p>
          </div>
        ) : (
          <div className="tabela-envolucro">
            <div className="tabela-rolagem">
              <table className="dados">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Empresa &amp; modelo</th>
                    <th className="text-right">Valor</th>
                    {verTodos && <th>Emitido por</th>}
                    <th>Data</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id}>
                      <td data-rotulo="Cliente" className="font-medium text-[var(--ink)]">
                        {h.cliente}
                      </td>
                      <td data-rotulo="Empresa">
                        <span className="block text-[var(--ink-2)]">{h.empresaNome}</span>
                        <span className="block text-xs text-[var(--ink-3)]">{h.modeloNome}</span>
                      </td>
                      <td data-rotulo="Valor" className="num md:text-right">
                        {brl.format(h.valor)}
                      </td>
                      {verTodos && (
                        <td data-rotulo="Emitido por" className="text-xs">{h.geradoPorNome}</td>
                      )}
                      <td data-rotulo="Data" className="text-xs text-[var(--ink-3)]">
                        {new Date(h.geradoEm).toLocaleString('pt-BR')}
                      </td>
                      <td data-rotulo="Ação" className="text-right">
                        <a href={`/api/comercial/${h.id}`} download
                          className="btn btn-secundario btn-mini">baixar</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {aba === 'modelos' && podeEditarModelos && (
        <ModelosComerciais empresas={empresas} modelos={modelos} marcadores={marcadores} />
      )}
    </>
  );
}
