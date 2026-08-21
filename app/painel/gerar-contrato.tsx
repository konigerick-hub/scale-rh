'use client';

import { useState } from 'react';
import Link from 'next/link';

export type ModeloOpcao = { id: string; nome: string };
export type VinculoOpcao = { id: string; empresaNome: string; cargo: string };

/**
 * Gera o contrato preenchido para imprimir e colher assinatura.
 *
 * O PDF gerado é uma minuta: não vira o contrato assinado do colaborador. O
 * documento assinado entra depois pelo botão "enviar PDF", que é outro fluxo.
 */
export default function GerarContrato({
  colaboradorId,
  colaboradorNome,
  modelos,
  vinculos,
  aoFechar,
}: {
  colaboradorId: string;
  colaboradorNome: string;
  modelos: ModeloOpcao[];
  vinculos: VinculoOpcao[];
  aoFechar: () => void;
}) {
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? '');
  const [vinculoId, setVinculoId] = useState(vinculos[0]?.id ?? '');

  const semModelo = modelos.length === 0;
  const url = `/api/contratos/${colaboradorId}/gerar?modelo=${modeloId}&vinculo=${vinculoId}`;

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="modal max-w-sm">
        <h2 className="text-lg font-semibold tracking-tight">Gerar contrato</h2>
        <p className="mb-5 mt-0.5 text-sm text-[var(--ink-3)]">{colaboradorNome}</p>

        {semModelo ? (
          <>
            <p className="text-sm text-[var(--ink-2)]">
              Você ainda não tem nenhum modelo de contrato. Crie um para poder
              gerar o documento preenchido.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={aoFechar} className="btn btn-secundario">Fechar</button>
              <Link href="/painel/modelos" className="btn btn-primario">Criar modelo</Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div>
                <label className="campo-rotulo" htmlFor="g-modelo">Modelo</label>
                <select id="g-modelo" className="campo" value={modeloId}
                  onChange={(e) => setModeloId(e.target.value)}>
                  {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="campo-rotulo" htmlFor="g-vinculo">Empresa do contrato</label>
                <select id="g-vinculo" className="campo" value={vinculoId}
                  onChange={(e) => setVinculoId(e.target.value)}>
                  {vinculos.map((v) => (
                    <option key={v.id} value={v.id}>{v.empresaNome} — {v.cargo}</option>
                  ))}
                </select>
                {vinculos.length > 1 && (
                  <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                    Esta pessoa tem mais de um vínculo. O contrato usa o cargo e o
                    salário da empresa escolhida.
                  </p>
                )}
              </div>
            </div>

            <p className="mt-4 text-xs text-[var(--ink-3)]">
              O arquivo baixado é uma minuta para imprimir e assinar. Depois de
              assinado, envie pelo botão de contrato na tabela.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={aoFechar} className="btn btn-secundario">Cancelar</button>
              <a href={url} download onClick={aoFechar} className="btn btn-primario">
                Baixar contrato
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
