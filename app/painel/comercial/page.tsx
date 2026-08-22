import Link from 'next/link';
import {
  exigirSessao,
  podeVerColaboradores,
  podeEditarModelosComerciais,
} from '@/lib/auth/guard';
import { carregarBase } from '@/lib/store/dados';
import { MARCADORES_COMERCIAIS } from '@/lib/store/tipos';
import BotaoSair from '../botao-sair';
import Conta from '../conta';
import AreaComercial from './area';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PaginaComercial() {
  const usuario = await exigirSessao();
  const { base } = await carregarBase();

  // Vendedor só emite pela empresa a que está vinculado; admin, por todas.
  const empresasPermitidas =
    usuario.empresasPermitidas === null
      ? base.empresas
      : base.empresas.filter((e) => usuario.empresasPermitidas!.includes(e.id));

  const modelos = (base.modelosComerciais ?? [])
    .filter((m) => empresasPermitidas.some((e) => e.id === m.empresaId))
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      empresaId: m.empresaId,
      conteudo: m.conteudo,
    }));

  return (
    <>
      <header className="cabecalho">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="marca text-[.95rem]">Grupo <span>Scale</span></span>
            <span className="hidden text-sm text-[var(--ink-3)] sm:inline">
              Contratos comerciais
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-[var(--ink-3)] sm:inline">
              {usuario.nome}
              <span className="mx-1.5 opacity-40">·</span>
              <span className="text-[var(--accent)]">{usuario.papel}</span>
            </span>
            {/* Só quem tem acesso à área de colaboradores vê o caminho de volta. */}
            {podeVerColaboradores(usuario) && (
              <Link href="/painel" className="btn btn-secundario btn-mini">
                Colaboradores
              </Link>
            )}
            <Conta precisaTrocar={usuario.trocarSenha} />
            <BotaoSair />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Contratos comerciais</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-3)]">
          Escolha a empresa e o modelo, preencha os dados do cliente e baixe o
          contrato em PDF, pronto para assinatura.
        </p>

        <AreaComercial
          empresas={empresasPermitidas.map((e) => ({
            id: e.id,
            nome: e.nome,
            temDados: Boolean(e.cnpj?.trim() && e.razaoSocial?.trim()),
          }))}
          modelos={modelos}
          podeEditarModelos={podeEditarModelosComerciais(usuario)}
          marcadores={MARCADORES_COMERCIAIS}
        />
      </main>
    </>
  );
}
