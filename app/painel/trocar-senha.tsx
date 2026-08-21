'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { trocarPropriaSenha } from '@/lib/actions/usuarios';

/**
 * Troca de senha.
 *
 * Quando `obrigatoria` é true, não há como fechar: o admin escolheu a senha
 * inicial e a conhece, então enquanto ela não for trocada a auditoria atribui
 * ações a uma pessoa cuja senha outra pessoa também sabe.
 */
export default function TrocarSenha({
  obrigatoria,
  aoFechar,
}: {
  obrigatoria: boolean;
  aoFechar?: () => void;
}) {
  const router = useRouter();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova !== confirma) {
      setErro('A confirmação não confere com a nova senha.');
      return;
    }
    iniciar(async () => {
      const r = await trocarPropriaSenha({ senhaAtual: atual, senhaNova: nova });
      if (r.ok) {
        aoFechar?.();
        router.refresh();
      } else setErro(r.erro);
    });
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (!obrigatoria && e.target === e.currentTarget) aoFechar?.();
      }}
    >
      <form onSubmit={enviar} className="modal max-w-sm">
        <h2 className="text-lg font-semibold tracking-tight">
          {obrigatoria ? 'Defina sua senha' : 'Trocar senha'}
        </h2>
        <p className="mb-5 mt-1 text-sm text-[var(--ink-3)]">
          {obrigatoria
            ? 'Sua senha atual foi definida por um administrador, que a conhece. Escolha uma senha só sua para continuar.'
            : 'Escolha uma nova senha de acesso.'}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="campo-rotulo" htmlFor="s-atual">Senha atual</label>
            <input id="s-atual" type="password" className="campo" required
              autoComplete="current-password" autoFocus
              value={atual} onChange={(e) => setAtual(e.target.value)} />
          </div>
          <div>
            <label className="campo-rotulo" htmlFor="s-nova">Nova senha</label>
            <input id="s-nova" type="password" className="campo" required
              autoComplete="new-password"
              value={nova} onChange={(e) => setNova(e.target.value)} />
            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
              Mínimo 12 caracteres, com maiúscula, minúscula e número.
            </p>
          </div>
          <div>
            <label className="campo-rotulo" htmlFor="s-conf">Repita a nova senha</label>
            <input id="s-conf" type="password" className="campo" required
              autoComplete="new-password"
              value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>
        </div>

        {erro && <p role="alert" className="aviso-erro mt-4">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          {!obrigatoria && (
            <button type="button" onClick={aoFechar} className="btn btn-secundario">
              Cancelar
            </button>
          )}
          <button type="submit" disabled={pendente} className="btn btn-primario">
            {pendente ? 'Salvando…' : 'Salvar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
