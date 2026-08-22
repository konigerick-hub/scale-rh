'use client';

import { useState, useTransition } from 'react';
import { salvarModeloComercial, removerModeloComercial } from '@/lib/actions/comercial';

export type ModeloComercialEdicao = {
  id: string;
  nome: string;
  empresaId: string;
  conteudo: string;
};

type Empresa = { id: string; nome: string };
type Marcador = { chave: string; descricao: string; grupo: string };

const EXEMPLO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATADA: {{empresaRazaoSocial}}, inscrita no CNPJ sob o nº {{empresaCnpj}}, com sede em {{empresaEndereco}}, neste ato representada por {{empresaRepresentante}}, CPF {{empresaRepresentanteCpf}}.

CONTRATANTE: {{clienteRazaoSocial}}, inscrita sob o nº {{clienteDocumento}}, com endereço em {{clienteEndereco}}, neste ato representada por {{clienteRepresentante}}, CPF {{clienteRepresentanteCpf}}, contato {{clienteEmail}} / {{clienteTelefone}}.

CLÁUSULA 1ª — DO OBJETO
A CONTRATADA prestará à CONTRATANTE os seguintes serviços: {{objeto}}.

CLÁUSULA 2ª — DO VALOR E DO PAGAMENTO
Pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor de {{valor}} ({{valorExtenso}}), na seguinte forma: {{formaPagamento}}.

CLÁUSULA 3ª — DA VIGÊNCIA
O presente contrato terá vigência de {{vigencia}}, contada da data de assinatura, podendo ser rescindido por qualquer das partes mediante comunicação prévia de 30 (trinta) dias.

CLÁUSULA 4ª — DAS OBRIGAÇÕES DA CONTRATADA
Executar os serviços com diligência e nos prazos acordados, mantendo a CONTRATANTE informada sobre o andamento dos trabalhos.

CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATANTE
Fornecer as informações e os acessos necessários à execução dos serviços e efetuar os pagamentos nas datas convencionadas.

CLÁUSULA 6ª — DA CONFIDENCIALIDADE
As partes obrigam-se a manter sigilo sobre as informações a que tiverem acesso em razão deste contrato.

CLÁUSULA 7ª — DO FORO
Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias.

E por estarem justas e contratadas, as partes assinam o presente instrumento.

{{hoje}}`;

export default function ModelosComerciais({
  empresas,
  modelos,
  marcadores,
}: {
  empresas: Empresa[];
  modelos: ModeloComercialEdicao[];
  marcadores: Marcador[];
}) {
  const [editando, setEditando] = useState<ModeloComercialEdicao | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? '');
  const [conteudo, setConteudo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const aberto = criando || editando !== null;

  function abrirNovo() {
    setEditando(null);
    setNome('');
    setEmpresaId(empresas[0]?.id ?? '');
    setConteudo(EXEMPLO);
    setErro(null);
    setCriando(true);
  }

  function abrirEdicao(m: ModeloComercialEdicao) {
    setCriando(false);
    setEditando(m);
    setNome(m.nome);
    setEmpresaId(m.empresaId);
    setConteudo(m.conteudo);
    setErro(null);
  }

  function fechar() {
    setCriando(false);
    setEditando(null);
    setErro(null);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await salvarModeloComercial(editando?.id ?? null, { nome, empresaId, conteudo });
      if (r.ok) fechar();
      else setErro(r.erro);
    });
  }

  function excluir(m: ModeloComercialEdicao) {
    if (!confirm(`Excluir o modelo "${m.nome}"?\n\nContratos já emitidos com ele deixam de poder ser baixados de novo, porque o PDF é remontado a partir do modelo.`)) return;
    iniciar(async () => {
      const r = await removerModeloComercial(m.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  const inserir = (chave: string) => setConteudo((c) => `${c}{{${chave}}}`);
  const nomeEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nome ?? '—';

  if (aberto) {
    return (
      <form onSubmit={enviar} className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="campo-rotulo" htmlFor="mc-nome">Nome do modelo</label>
              <input id="mc-nome" className="campo" required maxLength={120}
                placeholder="Ex: Contrato de gestão de tráfego"
                value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <label className="campo-rotulo" htmlFor="mc-emp">Empresa</label>
              <select id="mc-emp" className="campo" value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="campo-rotulo" htmlFor="mc-texto">Texto do contrato</label>
            <textarea id="mc-texto" className="campo font-[family-name:var(--font-mono)] text-xs"
              rows={22} required value={conteudo}
              onChange={(e) => setConteudo(e.target.value)} />
            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
              Deixe uma linha em branco entre parágrafos. O bloco de assinatura é
              adicionado automaticamente no fim.
            </p>
          </div>

          {erro && <p role="alert" className="aviso-erro">{erro}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={fechar} className="btn btn-secundario">Cancelar</button>
            <button type="submit" disabled={pendente} className="btn btn-primario">
              {pendente ? 'Salvando…' : 'Salvar modelo'}
            </button>
          </div>
        </div>

        <aside className="cartao h-fit max-h-[80vh] overflow-y-auto p-4">
          <p className="campo-rotulo">Marcadores</p>
          <p className="mb-3 text-xs text-[var(--ink-3)]">Clique para inserir no fim do texto.</p>
          <div className="flex flex-col gap-3">
            {[...new Set(marcadores.map((m) => m.grupo))].map((grupo) => (
              <div key={grupo}>
                <p className="mb-1 text-[.65rem] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  {grupo}
                </p>
                {marcadores.filter((m) => m.grupo === grupo).map((m) => (
                  <button key={m.chave} type="button" onClick={() => inserir(m.chave)}
                    title={m.descricao}
                    className="flex w-full flex-col items-start rounded-[var(--radius-sm)] px-2 py-1 text-left hover:bg-[var(--surface-hover)]">
                    <code className="text-xs">{`{{${m.chave}}}`}</code>
                    <span className="text-[.68rem] text-[var(--ink-3)]">{m.descricao}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </form>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button onClick={abrirNovo} className="btn btn-primario">+ Novo modelo</button>
      </div>

      {erro && <p role="alert" className="aviso-erro mb-4">{erro}</p>}

      {modelos.length === 0 ? (
        <div className="cartao px-6 py-12 text-center">
          <p className="font-medium text-[var(--ink)]">Nenhum modelo comercial ainda</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--ink-3)]">
            Cada empresa tem os seus. Já deixamos um contrato de prestação de
            serviços pronto para você ajustar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {modelos.map((m) => (
            <article key={m.id} className="cartao flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="font-medium text-[var(--ink)]">{m.nome}</h3>
                <p className="mt-0.5 text-xs text-[var(--ink-3)]">{nomeEmpresa(m.empresaId)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => abrirEdicao(m)} className="btn btn-secundario btn-mini">editar</button>
                <button onClick={() => excluir(m)} disabled={pendente} className="btn btn-perigo btn-mini">excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
