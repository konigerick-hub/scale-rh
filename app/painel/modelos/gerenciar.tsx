'use client';

import { useState, useTransition } from 'react';
import { salvarModelo, removerModelo } from '@/lib/actions/modelos';

type Modelo = { id: string; nome: string; conteudo: string; atualizadoEm: string };
type Marcador = { chave: string; descricao: string; grupo: string };

const EXEMPLO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{empresaRazaoSocial}}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{empresaCnpj}}, com sede em {{empresaEndereco}}, neste ato representada por {{empresaRepresentante}}, inscrito(a) no CPF sob o nº {{empresaRepresentanteCpf}}.

CONTRATADA: {{meiRazaoSocial}}, microempreendedor individual inscrito no CNPJ sob o nº {{meiCnpj}}, com sede em {{meiEndereco}}, neste ato representada por seu titular {{nome}}, {{nacionalidade}}, {{estadoCivil}}, portador(a) do RG nº {{rg}} e inscrito(a) no CPF sob o nº {{cpf}}, residente e domiciliado(a) em {{endereco}}.

As partes acima qualificadas celebram o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes.

CLÁUSULA 1ª — DO OBJETO
A CONTRATADA prestará à CONTRATANTE serviços de {{servico}}, com início em {{inicio}}.

CLÁUSULA 2ª — DA AUTONOMIA
Os serviços serão prestados com autonomia técnica, sem subordinação, pessoalidade ou habitualidade, não se estabelecendo vínculo empregatício entre as partes, nos termos do art. 442-B da CLT. A CONTRATADA é responsável por seus próprios tributos e obrigações acessórias.

CLÁUSULA 3ª — DO VALOR E DO PAGAMENTO
Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA a quantia mensal de {{valorMensal}} ({{valorExtenso}}), mediante apresentação da respectiva nota fiscal.

CLÁUSULA 4ª — DA VIGÊNCIA E DA RESCISÃO
O presente contrato vigora por prazo indeterminado, podendo ser rescindido por qualquer das partes, imotivadamente, mediante comunicação prévia de 30 (trinta) dias.

CLÁUSULA 5ª — DA CONFIDENCIALIDADE
A CONTRATADA obriga-se a manter sigilo sobre todas as informações a que tiver acesso em razão deste contrato, durante sua vigência e após seu término.

E por estarem assim justas e contratadas, as partes assinam o presente instrumento.

{{hoje}}`;

export default function GerenciarModelos({
  modelos,
  marcadores,
}: {
  modelos: Modelo[];
  marcadores: Marcador[];
}) {
  const [editando, setEditando] = useState<Modelo | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const aberto = criando || editando !== null;

  function abrirNovo() {
    setEditando(null);
    setNome('');
    setConteudo(EXEMPLO);
    setErro(null);
    setCriando(true);
  }

  function abrirEdicao(m: Modelo) {
    setCriando(false);
    setEditando(m);
    setNome(m.nome);
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
      const r = await salvarModelo(editando?.id ?? null, { nome, conteudo });
      if (r.ok) fechar();
      else setErro(r.erro);
    });
  }

  function excluir(m: Modelo) {
    if (!confirm(`Excluir o modelo "${m.nome}"? Contratos já gerados não são afetados.`)) return;
    iniciar(async () => {
      const r = await removerModelo(m.id);
      if (!r.ok) setErro(r.erro);
    });
  }

  /** Insere o marcador no fim do texto — evita depender da posição do cursor. */
  function inserir(chave: string) {
    setConteudo((c) => `${c}{{${chave}}}`);
  }

  if (aberto) {
    return (
      <form onSubmit={enviar} className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div className="flex flex-col gap-4">
          <div>
            <label className="campo-rotulo" htmlFor="m-nome">Nome do modelo</label>
            <input id="m-nome" className="campo" required maxLength={120}
              placeholder="Ex: Contrato de prestação de serviços"
              value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div>
            <label className="campo-rotulo" htmlFor="m-texto">Texto do contrato</label>
            <textarea id="m-texto" className="campo font-[family-name:var(--font-mono)] text-xs"
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
          <p className="mb-3 text-xs text-[var(--ink-3)]">
            Clique para inserir no fim do texto.
          </p>
          <div className="flex flex-col gap-3">
            {[...new Set(marcadores.map((m) => m.grupo))].map((grupo) => (
              <div key={grupo}>
                <p className="mb-1 text-[.65rem] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  {grupo}
                </p>
                {marcadores
                  .filter((m) => m.grupo === grupo)
                  .map((m) => (
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
        <div className="cartao px-6 py-14 text-center">
          <p className="font-medium text-[var(--ink)]">Nenhum modelo ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--ink-3)]">
            Crie o primeiro modelo para conseguir gerar contratos preenchidos.
            Já deixamos um exemplo pronto para você ajustar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {modelos.map((m) => (
            <article key={m.id} className="cartao flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h2 className="font-medium text-[var(--ink)]">{m.nome}</h2>
                <p className="mt-0.5 truncate text-xs text-[var(--ink-3)]">
                  {m.conteudo.slice(0, 90)}…
                </p>
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
