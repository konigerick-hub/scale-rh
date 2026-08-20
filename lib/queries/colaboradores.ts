import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { colaboradores, vinculos, empresas } from '@/lib/db/schema';
import type { UsuarioAutenticado } from '@/lib/auth/guard';

/**
 * O escopo é aplicado AQUI, na consulta — não na tela.
 *
 * Filtrar no componente significa que o dado saiu do banco e trafegou; basta
 * um bug de renderização ou uma resposta de API para vazar. Filtrando no SQL,
 * o dado de uma empresa que o gestor não pode ver nunca chega a existir na
 * memória do processo.
 */

export type LinhaColaborador = {
  colaboradorId: string;
  nome: string;
  nascimento: string | null;
  dataContratacao: string | null;
  vinculoId: string;
  cargo: string;
  valorFixo: string;
  empresaId: string;
  empresaNome: string;
  empresaCor: string;
};

export async function listarColaboradores(
  usuario: UsuarioAutenticado,
): Promise<LinhaColaborador[]> {
  // Admin (empresasPermitidas === null) não recebe filtro de empresa.
  // Gestor sem nenhuma empresa vinculada recebe lista vazia — nunca a lista toda.
  const filtroEmpresa =
    usuario.empresasPermitidas === null
      ? undefined
      : usuario.empresasPermitidas.length === 0
        ? sql`false`
        : inArray(vinculos.empresaId, usuario.empresasPermitidas);

  return db
    .select({
      colaboradorId: colaboradores.id,
      nome: colaboradores.nome,
      nascimento: colaboradores.nascimento,
      dataContratacao: colaboradores.dataContratacao,
      vinculoId: vinculos.id,
      cargo: vinculos.cargo,
      valorFixo: vinculos.valorFixo,
      empresaId: empresas.id,
      empresaNome: empresas.nome,
      empresaCor: empresas.cor,
    })
    .from(vinculos)
    .innerJoin(colaboradores, eq(vinculos.colaboradorId, colaboradores.id))
    .innerJoin(empresas, eq(vinculos.empresaId, empresas.id))
    .where(
      and(
        eq(colaboradores.ativo, true),
        eq(vinculos.ativo, true),
        ...(filtroEmpresa ? [filtroEmpresa] : []),
      ),
    )
    .orderBy(colaboradores.nome);
}

export async function resumoFolha(usuario: UsuarioAutenticado) {
  const linhas = await listarColaboradores(usuario);
  const pessoasUnicas = new Set(linhas.map((l) => l.colaboradorId));
  const total = linhas.reduce((acc, l) => acc + Number(l.valorFixo), 0);
  return {
    pessoas: pessoasUnicas.size,
    vinculos: linhas.length,
    folhaTotal: total,
  };
}
