'use client';

import { useState } from 'react';
import TrocarSenha from './trocar-senha';

/**
 * Controles da própria conta no cabeçalho.
 *
 * Se `precisaTrocar` for true, a tela abre sozinha e não fecha: a senha atual
 * foi escolhida por um administrador, que a conhece.
 */
export default function Conta({ precisaTrocar }: { precisaTrocar: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button onClick={() => setAberto(true)} className="btn btn-secundario btn-mini">
        Senha
      </button>

      {(aberto || precisaTrocar) && (
        <TrocarSenha
          obrigatoria={precisaTrocar}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
