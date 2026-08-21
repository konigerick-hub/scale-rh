'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={sair}
      disabled={saindo}
      className="btn btn-secundario btn-mini"
    >
      {saindo ? 'Saindo…' : 'Sair'}
    </button>
  );
}
