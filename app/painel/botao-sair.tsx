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
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
    >
      {saindo ? 'Saindo…' : 'Sair'}
    </button>
  );
}
