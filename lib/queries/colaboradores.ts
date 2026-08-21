import 'server-only';
import { carregarBase } from '@/lib/store/dados';
import { centavosParaReais } from '@/lib/store/tipos';
import type { UsuarioAutenticado } from '@/lib/auth/guard';

/**
 * O escopo por empresa é aplicado AQUI, ao montar o resultado — nunca na tela.
 *
 * Filtrar no componente significaria que o dado de uma empresa que o gestor não
 * pode ver já teria sido serializado e enviado ao navegador; bastaria um erro de
 * renderização para expô-lo. Filtrando aqui, ele nunca sai desta função.
 */

export type LinhaColaborador = {
  colaboradorId: string;
  nome: string;
  nascimento: string | null;
  dataContratacao: string | null;
  vinculoId: string;
  cargo: string;
  valorFixo: number;
  empresaId: string;
  empresaNome: string;
  empresaCor: string;
  temContrato: boolean;
};

export async function listarColaboradores(
  usuario: UsuarioAutenticado,
): Promise<LinhaColaborador[]> {
  const { base } = await carregarBase();
  const empresaPorId = new Map(base.empresas.map((e) => [e.id, e]));

  // Admin (null) vê tudo. Gestor sem empresa vinculada vê lista vazia — nunca
  // a lista completa: um vínculo faltando não pode virar acesso irrestrito.
  const permitidas = usuario.empresasPermitidas;

  const linhas: LinhaColaborador[] = [];

  for (const c of base.colaboradores) {
    if (!c.ativo) continue;

    for (const v of c.vinculos) {
      if (!v.ativo) continue;
      if (permitidas !== null && !permitidas.includes(v.empresaId)) continue;

      const empresa = empresaPorId.get(v.empresaId);
      if (!empresa) continue;

      linhas.push({
        colaboradorId: c.id,
        nome: c.nome,
        nascimento: c.nascimento,
        dataContratacao: c.dataContratacao,
        vinculoId: v.id,
        cargo: v.cargo,
        valorFixo: centavosParaReais(v.valorFixoCentavos),
        empresaId: empresa.id,
        empresaNome: empresa.nome,
        empresaCor: empresa.cor,
        temContrato: c.contrato !== null,
      });
    }
  }

  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function resumoFolha(usuario: UsuarioAutenticado) {
  const linhas = await listarColaboradores(usuario);
  return {
    pessoas: new Set(linhas.map((l) => l.colaboradorId)).size,
    vinculos: linhas.length,
    folhaTotal: linhas.reduce((acc, l) => acc + l.valorFixo, 0),
  };
}

/** Empresas que este usuário pode ver — usado em filtros e formulários. */
export async function empresasVisiveis(usuario: UsuarioAutenticado) {
  const { base } = await carregarBase();
  if (usuario.empresasPermitidas === null) return base.empresas;
  return base.empresas.filter((e) => usuario.empresasPermitidas!.includes(e.id));
}
