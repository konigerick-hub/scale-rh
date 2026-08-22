'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ModelosComerciais, { type ModeloComercialEdicao } from './modelos';

type Empresa = { id: string; nome: string; temDados: boolean };
type Marcador = { chave: string; descricao: string; grupo: string };

const CLIENTE_VAZIO = {
  razaoSocial: '', documento: '', endereco: '', representante: '',
  representanteCpf: '', email: '', telefone: '', objeto: '',
  valor: '', formaPagamento: '', vigencia: '',
};

export default function AreaComercial({
  empresas,
  modelos,
  podeEditarModelos,
  marcadores,
}: {
  empresas: Empresa[];
  modelos: ModeloComercialEdicao[];
  podeEditarModelos: boolean;
  marcadores: Marcador[];
}) {
  const [aba, setAba] = useState<'gerar' | 'modelos'>('gerar');
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? '');
  const [modeloId, setModeloId] = useState('');
  const [cliente, setCliente] = useState(CLIENTE_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  const modelosDaEmpresa = useMemo(
    () => modelos.filter((m) => m.empresaId === empresaId),
    [modelos, empresaId],
  );

  const empresa = empresas.find((e) => e.id === empresaId);
  const mudar = (campos: Partial<typeof CLIENTE_VAZIO>) =>
    setCliente((c) => ({ ...c, ...campos }));

  /**
   * O PDF vem direto na resposta e é salvo pelo navegador.
   *
   * Nada é gravado no sistema — a única forma de reaver o arquivo é gerar de
   * novo pelo formulário. Foi decisão para não inchar o cadastro com ~120
   * contratos por mês.
   */
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setGerado(null);

    const escolhido = modeloId || modelosDaEmpresa[0]?.id;
    if (!escolhido) {
      setErro('Escolha um modelo de contrato.');
      return;
    }

    setPendente(true);
    try {
      const res = await fetch('/api/comercial/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modeloId: escolhido,
          ...cliente,
          valor: Number(cliente.valor || 0),
        }),
      });

      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        setErro(dados.erro ?? 'Não foi possível gerar o contrato.');
        return;
      }

      const arquivo = await res.blob();
      const nome =
        /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
        'contrato.pdf';

      const url = URL.createObjectURL(arquivo);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setGerado(cliente.razaoSocial);
      setCliente(CLIENTE_VAZIO);
    } catch {
      setErro('Falha de conexão ao gerar o contrato.');
    } finally {
      setPendente(false);
    }
  }

  const abas: [typeof aba, string][] = [
    ['gerar', 'Gerar contrato'],
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
            <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--accent-wash)] px-4 py-3">
              <p className="text-sm text-[var(--ink)]">
                Contrato de <strong>{gerado}</strong> baixado.
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-2)]">
                O arquivo não fica guardado no sistema. Se precisar de outra via,
                preencha o formulário de novo.
              </p>
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

      {aba === 'modelos' && podeEditarModelos && (
        <ModelosComerciais empresas={empresas} modelos={modelos} marcadores={marcadores} />
      )}
    </>
  );
}
