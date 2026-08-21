/**
 * Formato dos dados guardados.
 *
 * Não há banco relacional: o cadastro inteiro é um documento JSON. Com 52
 * pessoas e 66 vínculos isso cabe folgado em memória. Esta arquitetura NÃO
 * serve para milhares de registros — se um dia chegar lá, é hora de um banco
 * de verdade.
 */

export type Papel = 'admin' | 'gestor' | 'leitura';

export type Clima = 'excelente' | 'saudavel' | 'atencao' | 'critico';

export type Empresa = {
  id: string;
  nome: string;
  cor: string;
};

export type Usuario = {
  id: string;
  /** Sempre em minúsculas — normalizado na escrita. */
  email: string;
  senhaHash: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  /** Vazio para admin (vê tudo). Para gestor/leitura, restringe às empresas listadas. */
  empresaIds: string[];
  /** Reservado para MFA/TOTP — biblioteca local, sem API externa. */
  mfaSecret?: string | null;
  trocarSenha: boolean;
  ultimoLoginEm?: string | null;
  criadoEm: string;
};

/** Vínculo pessoa × empresa: é o que permite alguém atuar em mais de uma empresa. */
export type Vinculo = {
  id: string;
  empresaId: string;
  cargo: string;
  /** Em centavos: evita erro de arredondamento de ponto flutuante em dinheiro. */
  valorFixoCentavos: number;
  ativo: boolean;
};

export type Colaborador = {
  id: string;
  nome: string;
  /** ISO YYYY-MM-DD, ou null quando não informado. */
  nascimento: string | null;
  dataContratacao: string | null;
  vinculos: Vinculo[];
  /** Desligamento é soft delete: prazos trabalhistas exigem preservar o histórico. */
  ativo: boolean;
  desligadoEm: string | null;
  contrato: {
    /** Caminho no armazenamento privado. Nunca uma URL pública. */
    caminho: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    sha256: string;
    enviadoPor: string;
    enviadoEm: string;
  } | null;
  avaliacoes: {
    mes: string;
    classificacao: Clima;
    nota: number;
    avaliadorId: string;
    criadoEm: string;
  }[];
  criadoEm: string;
  atualizadoEm: string;
};

/** O documento único que guarda todo o cadastro. */
export type BaseDados = {
  versao: 1;
  empresas: Empresa[];
  usuarios: Usuario[];
  colaboradores: Colaborador[];
};

export const BASE_VAZIA: BaseDados = {
  versao: 1,
  empresas: [],
  usuarios: [],
  colaboradores: [],
};

export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}
