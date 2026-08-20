'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const dados = await res.json();

      if (!res.ok) {
        setErro(dados.erro ?? 'Não foi possível entrar.');
        return;
      }

      // Só aceita destino interno — `proximo` vem da URL e não é confiável.
      const proximo = params.get('proximo');
      const destino = proximo?.startsWith('/') && !proximo.startsWith('//') ? proximo : '/painel';
      router.push(destino);
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="w-full max-w-sm space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Grupo Scale
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Painel de colaboradores — acesso restrito
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div>
          <label htmlFor="senha" className="block text-xs font-medium uppercase tracking-wide text-neutral-600">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>

      <p className="text-center text-xs text-neutral-400">
        Acessos são registrados para fins de auditoria.
      </p>
    </form>
  );
}

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
