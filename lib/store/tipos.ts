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

/**
 * Modelo de contrato: texto com marcadores que sao trocados pelos dados da
 * pessoa na hora de gerar o PDF. Os marcadores disponiveis estao em
 * MARCADORES, abaixo.
 */
export type ModeloContrato = {
  id: string;
  nome: string;
  conteudo: string;
  criadoEm: string;
  atualizadoEm: string;
};

/** Marcadores aceitos no texto do modelo, e o que cada um vira. */
export const MARCADORES: { chave: string; descricao: string }[] = [
  { chave: 'nome', descricao: 'Nome do colaborador' },
  { chave: 'cpf', descricao: 'CPF' },
  { chave: 'rg', descricao: 'RG' },
  { chave: 'nacionalidade', descricao: 'Nacionalidade' },
  { chave: 'estadoCivil', descricao: 'Estado civil' },
  { chave: 'endereco', descricao: 'Endereco completo' },
  { chave: 'empresa', descricao: 'Empresa do vinculo' },
  { chave: 'cargo', descricao: 'Cargo no vinculo' },
  { chave: 'salario', descricao: 'Remuneracao formatada, ex: R$ 2.500,00' },
  { chave: 'dataAdmissao', descricao: 'Data de admissao, ex: 01/03/2026' },
  { chave: 'nascimento', descricao: 'Data de nascimento' },
  { chave: 'hoje', descricao: 'Data de hoje por extenso' },
];

/** Dados pessoais usados para preencher o contrato. Sensiveis: so admin ve. */
export type Documentos = {
  cpf: string | null;
  rg: string | null;
  nacionalidade: string | null;
  estadoCivil: string | null;
  endereco: string | null;
};

export const DOCUMENTOS_VAZIOS: Documentos = {
  cpf: null, rg: null, nacionalidade: null, estadoCivil: null, endereco: null,
};

/** Arquivo de apoio enviado junto do cadastro (copia de RG, comprovante etc). */
export type Anexo = {
  id: string;
  caminho: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  enviadoPor: string;
  enviadoEm: string;
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
  /** Dados pessoais para o contrato. Ausente em registros antigos. */
  documentos?: Documentos;
  /** Documentos de apoio (RG, comprovante de endereco...). */
  anexos?: Anexo[];
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
  /** Ausente em bases criadas antes desta funcionalidade. */
  modelos?: ModeloContrato[];
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
