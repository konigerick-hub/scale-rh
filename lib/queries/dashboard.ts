import 'server-only';
import { listarPessoas } from './colaboradores';
import type { UsuarioAutenticado } from '@/lib/auth/guard';

/**
 * Números do painel de indicadores.
 *
 * Tudo respeita o escopo por empresa, porque parte de `listarPessoas`. Um
 * gestor vê os indicadores só da empresa dele.
 *
 * Nascimento e admissão são opcionais no cadastro, então cada bloco informa
 * quantas pessoas ficaram de fora por falta do dado — em vez de mostrar um
 * gráfico vazio que parece defeito.
 */

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export type FaixaTempo = { faixa: string; total: number };
export type Aniversariante = {
  nome: string;
  dia: number;
  empresa: string;
  tipo: 'nascimento' | 'empresa';
  anos: number | null;
};
export type ContagemClima = { classificacao: string; total: number };

export type Indicadores = {
  totalPessoas: number;
  semNascimento: number;
  semAdmissao: number;

  tempoDeCasa: FaixaTempo[];
  tempoMedioAnos: number | null;
  maisAntigo: { nome: string; anos: number } | null;

  clima: ContagemClima[];
  semAvaliacao: number;
  notaMedia: number | null;

  mesAtual: string;
  aniversariantes: Aniversariante[];
};

function anosDesde(iso: string): number {
  const hoje = new Date();
  const [a, m, d] = iso.split('-').map(Number);
  const inicio = new Date(a, m - 1, d);
  let anos = hoje.getFullYear() - inicio.getFullYear();
  const aindaNao =
    hoje.getMonth() < inicio.getMonth() ||
    (hoje.getMonth() === inicio.getMonth() && hoje.getDate() < inicio.getDate());
  if (aindaNao) anos--;
  return Math.max(anos, 0);
}

function mesDia(iso: string): { mes: number; dia: number } {
  const [, m, d] = iso.split('-').map(Number);
  return { mes: m, dia: d };
}

export async function indicadores(usuario: UsuarioAutenticado): Promise<Indicadores> {
  const pessoas = await listarPessoas(usuario);
  const hoje = new Date();
  const mesCorrente = hoje.getMonth() + 1;

  /* ---- Tempo de casa ---- */
  const comAdmissao = pessoas.filter((p) => p.dataContratacao);
  const faixas: Record<string, number> = {
    'menos de 1 ano': 0,
    '1 a 2 anos': 0,
    '2 a 5 anos': 0,
    '5 anos ou mais': 0,
  };
  let somaAnos = 0;
  let maisAntigo: { nome: string; anos: number } | null = null;

  for (const p of comAdmissao) {
    const anos = anosDesde(p.dataContratacao!);
    somaAnos += anos;
    if (anos < 1) faixas['menos de 1 ano']++;
    else if (anos < 2) faixas['1 a 2 anos']++;
    else if (anos < 5) faixas['2 a 5 anos']++;
    else faixas['5 anos ou mais']++;
    if (!maisAntigo || anos > maisAntigo.anos) maisAntigo = { nome: p.nome, anos };
  }

  /* ---- Clima ---- */
  const contagem: Record<string, number> = {
    excelente: 0, saudavel: 0, atencao: 0, critico: 0,
  };
  let somaNotas = 0;
  let comAvaliacao = 0;
  for (const p of pessoas) {
    if (!p.ultimaAvaliacao) continue;
    comAvaliacao++;
    somaNotas += p.ultimaAvaliacao.nota;
    if (p.ultimaAvaliacao.classificacao in contagem) {
      contagem[p.ultimaAvaliacao.classificacao]++;
    }
  }

  /* ---- Aniversariantes do mês: nascimento e de empresa ---- */
  const aniversariantes: Aniversariante[] = [];
  for (const p of pessoas) {
    const empresa = p.vinculos[0]?.empresaNome ?? '—';

    if (p.nascimento) {
      const { mes, dia } = mesDia(p.nascimento);
      if (mes === mesCorrente) {
        aniversariantes.push({
          nome: p.nome, dia, empresa, tipo: 'nascimento',
          anos: anosDesde(p.nascimento) + (dia >= hoje.getDate() ? 1 : 0),
        });
      }
    }

    if (p.dataContratacao) {
      const { mes, dia } = mesDia(p.dataContratacao);
      if (mes === mesCorrente) {
        const anos = anosDesde(p.dataContratacao) + (dia >= hoje.getDate() ? 1 : 0);
        // Quem entrou neste mês ainda não tem aniversário de empresa a comemorar.
        if (anos > 0) {
          aniversariantes.push({ nome: p.nome, dia, empresa, tipo: 'empresa', anos });
        }
      }
    }
  }
  aniversariantes.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    totalPessoas: pessoas.length,
    semNascimento: pessoas.filter((p) => !p.nascimento).length,
    semAdmissao: pessoas.length - comAdmissao.length,

    tempoDeCasa: Object.entries(faixas).map(([faixa, total]) => ({ faixa, total })),
    tempoMedioAnos: comAdmissao.length ? somaAnos / comAdmissao.length : null,
    maisAntigo,

    clima: Object.entries(contagem).map(([classificacao, total]) => ({ classificacao, total })),
    semAvaliacao: pessoas.length - comAvaliacao,
    notaMedia: comAvaliacao ? somaNotas / comAvaliacao : null,

    mesAtual: MESES[hoje.getMonth()],
    aniversariantes,
  };
}
