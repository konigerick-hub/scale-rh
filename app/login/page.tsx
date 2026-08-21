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
      const destino =
        proximo?.startsWith('/') && !proximo.startsWith('//') ? proximo : '/painel';
      router.push(destino);
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="w-full max-w-[22rem]">
      <div className="mb-7">
        <div className="marca mb-6 text-lg">
          Grupo <span>Scale</span>
        </div>
        <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-[var(--ink)]">
          Contratos &amp; Cargos
        </h1>
        <p className="mt-1.5 text-sm text-[var(--ink-3)]">
          Painel de colaboradores · acesso restrito
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="campo-rotulo" htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
            className="campo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="campo-rotulo" htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            className="campo"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
      </div>

      {erro && (
        <p role="alert" aria-live="polite" className="aviso-erro mt-4">
          {erro}
        </p>
      )}

      <button type="submit" disabled={enviando} className="btn btn-primario mt-6 w-full">
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>

      <p className="mt-6 border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--ink-3)]">
        Acessos são registrados para fins de auditoria.
      </p>
    </form>
  );
}

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
