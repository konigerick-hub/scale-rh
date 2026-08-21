'use client';

import { useState, useTransition } from 'react';
import { criarUsuario, definirAtivo } from '@/lib/actions/usuarios';

type Empresa = { id: string; nome: string };
type Usuario = {
  id: string;
  email: string;
  nome: string;
  papel: 'admin' | 'gestor' | 'leitura';
  ativo: boolean;
  empresaIds: string[];
  ultimoLoginEm: string | null;
};

const campo =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600';
const rotulo = 'block text-xs font-medium uppercase tracking-wide text-neutral-600 mb-1';

const PAPEL_DESC: Record<string, string> = {
  admin: 'vê tudo, gerencia contas e contratos',
  gestor: 'edita, mas só as empresas marcadas',
  leitura: 'só consulta, só as empresas marcadas',
};

export default function GerenciarUsuarios({
  eu,
  empresas,
  usuarios,
}: {
  eu: string;
  empresas: Empresa[];
  usuarios: Usuario[];
}) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<'admin' | 'gestor' | 'leitura'>('leitura');
  const [empresaIds, setEmpresaIds] = useState<string[]>([]);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await criarUsuario({ email, nome, papel, empresaIds, senha });
      if (r.ok) {
        setAberto(false);
        setEmail(''); setNome(''); setPapel('leitura'); setEmpresaIds([]); setSenha('');
      } else setErro(r.erro);
    });
  }

  function alternar(u: Usuario) {
    setErro(null);
    iniciar(async () => {
      const r = await definirAtivo(u.id, !u.ativo);
      if (!r.ok) setErro(r.erro);
    });
  }

  const nomeEmpresa = (id: string) => empresas.find((e) => e.id === id)?.nome ?? '—';

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setAberto((v) => !v)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {aberto ? 'Cancelar' : '+ Novo usuário'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={criar} className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="u-nome">Nome</label>
              <input id="u-nome" className={campo} value={nome}
                onChange={(e) => setNome(e.target.value)} required maxLength={120} />
            </div>
            <div>
              <label className={rotulo} htmlFor="u-email">E-mail</label>
              <input id="u-email" type="email" className={campo} value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className={rotulo} htmlFor="u-papel">Papel</label>
              <select id="u-papel" className={campo} value={papel}
                onChange={(e) => setPapel(e.target.value as typeof papel)}>
                <option value="leitura">Leitura</option>
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="mt-1 text-xs text-neutral-500">{PAPEL_DESC[papel]}</p>
            </div>
            <div>
              <label className={rotulo} htmlFor="u-senha">Senha inicial</label>
              <input id="u-senha" type="text" className={campo} value={senha}
                onChange={(e) => setSenha(e.target.value)} required
                placeholder="mín. 12 caracteres, maiúscula e número" />
              <p className="mt-1 text-xs text-neutral-500">
                Será exigida a troca no primeiro acesso.
              </p>
            </div>
          </div>

          {papel !== 'admin' && (
            <div className="mt-4">
              <span className={rotulo}>Empresas que esta pessoa poderá ver</span>
              <div className="flex flex-wrap gap-3">
                {empresas.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={empresaIds.includes(e.id)}
                      onChange={(ev) =>
                        setEmpresaIds((v) =>
                          ev.target.checked ? [...v, e.id] : v.filter((x) => x !== e.id),
                        )
                      }
                    />
                    {e.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          {erro && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={pendente}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
              {pendente ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        </form>
      )}

      {erro && !aberto && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Empresas</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {usuarios.map((u) => (
              <tr key={u.id} className={u.ativo ? '' : 'opacity-50'}>
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-900">{u.nome}</div>
                  <div className="text-xs text-neutral-500">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-neutral-600">{u.papel}</td>
                <td className="px-4 py-3 text-xs text-neutral-600">
                  {u.papel === 'admin'
                    ? 'todas'
                    : u.empresaIds.length
                      ? u.empresaIds.map(nomeEmpresa).join(', ')
                      : 'nenhuma'}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {u.ultimoLoginEm
                    ? new Date(u.ultimoLoginEm).toLocaleString('pt-BR')
                    : 'nunca entrou'}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id === eu ? (
                    <span className="text-xs text-neutral-400">você</span>
                  ) : (
                    <button
                      onClick={() => alternar(u)}
                      disabled={pendente}
                      className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {u.ativo ? 'desativar' : 'reativar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
