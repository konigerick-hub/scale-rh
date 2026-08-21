'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { configurarPrimeiroAdmin } from '@/lib/actions/setup';

export default function FormularioSetup() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [importar, setImportar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await configurarPrimeiroAdmin({
        nome,
        email,
        senha,
        importarPlanilha: importar,
      });
      if (r.ok) router.push('/login');
      else setErro(r.erro);
    });
  }

  return (
    <form onSubmit={enviar} className="w-full max-w-[24rem]">
      <div className="mb-7">
        <div className="marca mb-6 text-lg">
          Grupo <span>Scale</span>
        </div>
        <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight">
          Primeira configuração
        </h1>
        <p className="mt-1.5 text-sm text-[var(--ink-3)]">
          Crie a conta de administrador. Esta tela só aparece uma vez — depois
          de criada, ela deixa de existir.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="campo-rotulo" htmlFor="s-nome">Seu nome</label>
          <input id="s-nome" className="campo" required autoFocus maxLength={120}
            value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div>
          <label className="campo-rotulo" htmlFor="s-email">E-mail</label>
          <input id="s-email" type="email" className="campo" required
            autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="campo-rotulo" htmlFor="s-senha">Senha</label>
          <input id="s-senha" type="password" className="campo" required
            autoComplete="new-password"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
          <p className="mt-1.5 text-xs text-[var(--ink-3)]">
            Mínimo 12 caracteres, com maiúscula, minúscula e número.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <input type="checkbox" className="mt-0.5" checked={importar}
            onChange={(e) => setImportar(e.target.checked)} />
          <span className="text-sm text-[var(--ink-2)]">
            Importar os dados da planilha
            <span className="mt-0.5 block text-xs text-[var(--ink-3)]">
              52 colaboradores e 66 vínculos nas três empresas. Datas de nascimento
              e admissão ficam em branco para preencher depois.
            </span>
          </span>
        </label>
      </div>

      {erro && <p role="alert" className="aviso-erro mt-4">{erro}</p>}

      <button type="submit" disabled={pendente} className="btn btn-primario mt-6 w-full">
        {pendente ? 'Configurando…' : 'Criar conta e entrar'}
      </button>
    </form>
  );
}
