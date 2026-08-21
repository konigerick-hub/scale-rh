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

const campo = 'campo';
const rotulo = 'campo-rotulo';

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
          className="btn btn-primario"
        >
          {aberto ? 'Cancelar' : '+ Novo usuário'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={criar} className="cartao mb-6 bg-[var(--surface-2)] p-5">
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
              <p className="mt-1 text-xs text-[var(--ink-3)]">{PAPEL_DESC[papel]}</p>
            </div>
            <div>
              <label className={rotulo} htmlFor="u-senha">Senha inicial</label>
              <input id="u-senha" type="text" className={campo} value={senha}
                onChange={(e) => setSenha(e.target.value)} required
                placeholder="mín. 12 caracteres, maiúscula e número" />
              <p className="mt-1 text-xs text-[var(--ink-3)]">
                Será exigida a troca no primeiro acesso.
              </p>
            </div>
          </div>

          {papel !== 'admin' && (
            <div className="mt-4">
              <span className={rotulo}>Empresas que esta pessoa poderá ver</span>
              <div className="flex flex-wrap gap-3">
                {empresas.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
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

          {erro && <p role="alert" className="aviso-erro mt-4">{erro}</p>}

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={pendente}
              className="btn btn-primario">
              {pendente ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        </form>
      )}

      {erro && !aberto && (
        <p role="alert" className="aviso-erro mb-4">{erro}</p>
      )}

      <div className="tabela-envolucro tabela-rolagem">
        <table className="dados">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Papel</th>
              <th>Empresas</th>
              <th>Último acesso</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.ativo ? '' : 'opacity-50'}>
                <td data-rotulo="Pessoa">
                  <div className="font-medium text-[var(--ink)]">{u.nome}</div>
                  <div className="text-xs text-[var(--ink-3)]">{u.email}</div>
                </td>
                <td data-rotulo="Papel">{u.papel}</td>
                <td data-rotulo="Empresas" className="text-xs">
                  {u.papel === 'admin'
                    ? 'todas'
                    : u.empresaIds.length
                      ? u.empresaIds.map(nomeEmpresa).join(', ')
                      : 'nenhuma'}
                </td>
                <td data-rotulo="Último acesso" className="text-xs text-[var(--ink-3)]">
                  {u.ultimoLoginEm
                    ? new Date(u.ultimoLoginEm).toLocaleString('pt-BR')
                    : 'nunca entrou'}
                </td>
                <td data-rotulo="Ação" className="text-right">
                  {u.id === eu ? (
                    <span className="text-xs text-[var(--ink-3)]">você</span>
                  ) : (
                    <button
                      onClick={() => alternar(u)}
                      disabled={pendente}
                      className="btn btn-secundario btn-mini"
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
