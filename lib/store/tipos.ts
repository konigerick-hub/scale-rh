/**
 * Formato dos dados guardados.
 *
 * Não há banco relacional: o cadastro inteiro é um documento JSON. Com 52
 * pessoas e 66 vínculos isso cabe folgado em memória. Esta arquitetura NÃO
 * serve para milhares de registros — se um dia chegar lá, é hora de um banco
 * de verdade.
 */

/**
 * Papéis, do mais amplo ao mais restrito:
 *  - `admin`     — tudo: contas, modelos, dados pessoais, colaboradores
 *  - `gestor`    — colaboradores das empresas vinculadas + contratos comerciais
 *  - `comercial` — SÓ contratos comerciais; não enxerga a área de colaboradores
 *
 * `leitura` existiu antes e virou `comercial`. `guard.ts` converte registros
 * antigos na leitura, então nenhuma conta fica com papel inválido.
 */
export type Papel = 'admin' | 'gestor' | 'comercial';

export type Clima = 'excelente' | 'saudavel' | 'atencao' | 'critico';

export type Empresa = {
  id: string;
  /** Nome curto, usado na tela. */
  nome: string;
  cor: string;

  /*
   * Dados da CONTRATANTE. Um contrato tem duas partes: sem CNPJ, razão social
   * e quem assina pela empresa, o documento não se sustenta juridicamente.
   * Opcionais porque as empresas foram criadas antes destes campos existirem.
   */
  razaoSocial?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  representante?: string | null;
  representanteCpf?: string | null;
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

/**
 * Marcadores fixos aceitos no modelo, agrupados por origem do dado.
 *
 * O contrato é de PRESTAÇÃO DE SERVIÇOS entre duas pessoas jurídicas: uma das
 * empresas do grupo (contratante) e o MEI do prestador (contratado). Por isso
 * existem dois CNPJs, e não há PIS nem carteira de trabalho — nada aqui é
 * vínculo celetista.
 */
export const MARCADORES: { chave: string; descricao: string; grupo: string }[] = [
  // CONTRATADA — o MEI
  { chave: 'meiRazaoSocial', descricao: 'Razão social do MEI', grupo: 'Contratada (MEI)' },
  { chave: 'meiCnpj', descricao: 'CNPJ do MEI', grupo: 'Contratada (MEI)' },
  { chave: 'meiEndereco', descricao: 'Endereço da sede do MEI', grupo: 'Contratada (MEI)' },

  // A pessoa por trás do MEI
  { chave: 'nome', descricao: 'Nome completo do titular', grupo: 'Titular do MEI' },
  { chave: 'cpf', descricao: 'CPF do titular', grupo: 'Titular do MEI' },
  { chave: 'rg', descricao: 'RG do titular', grupo: 'Titular do MEI' },
  { chave: 'nacionalidade', descricao: 'Nacionalidade', grupo: 'Titular do MEI' },
  { chave: 'estadoCivil', descricao: 'Estado civil', grupo: 'Titular do MEI' },
  { chave: 'endereco', descricao: 'Endereço residencial', grupo: 'Titular do MEI' },
  { chave: 'telefone', descricao: 'Telefone', grupo: 'Titular do MEI' },
  { chave: 'email', descricao: 'E-mail', grupo: 'Titular do MEI' },
  { chave: 'nascimento', descricao: 'Data de nascimento', grupo: 'Titular do MEI' },

  // CONTRATANTE — a empresa do grupo
  { chave: 'empresa', descricao: 'Nome curto da empresa', grupo: 'Contratante' },
  { chave: 'empresaRazaoSocial', descricao: 'Razão social', grupo: 'Contratante' },
  { chave: 'empresaCnpj', descricao: 'CNPJ', grupo: 'Contratante' },
  { chave: 'empresaEndereco', descricao: 'Endereço da empresa', grupo: 'Contratante' },
  { chave: 'empresaRepresentante', descricao: 'Quem assina pela empresa', grupo: 'Contratante' },
  { chave: 'empresaRepresentanteCpf', descricao: 'CPF de quem assina', grupo: 'Contratante' },

  // Objeto do contrato
  { chave: 'servico', descricao: 'Serviço prestado (o "cargo" do cadastro)', grupo: 'Contrato' },
  { chave: 'valorMensal', descricao: 'Valor mensal, ex: R$ 2.500,00', grupo: 'Contrato' },
  { chave: 'valorExtenso', descricao: 'Valor mensal por extenso', grupo: 'Contrato' },
  { chave: 'inicio', descricao: 'Início da prestação', grupo: 'Contrato' },
  { chave: 'hoje', descricao: 'Data de hoje por extenso', grupo: 'Contrato' },
];

/**
 * Campo criado por você para o que não está na lista fixa.
 *
 * A definição é global (para o modelo poder validar o marcador), e o VALOR é
 * preenchido por colaborador. Assim `{{banco}}` funciona em qualquer modelo e
 * cada pessoa tem o seu banco.
 */
export type CampoPersonalizado = {
  /** Vira o marcador: `{{chave}}`. Só letras, sem espaço. */
  chave: string;
  rotulo: string;
};

/**
 * Dados do prestador para preencher o contrato. Sensíveis: só admin vê.
 *
 * Reúne os dados do MEI (a parte contratada) e do titular (a pessoa que assina
 * por ele) — o contrato de prestação de serviços precisa dos dois.
 */
export type Documentos = {
  // MEI (contratada)
  meiRazaoSocial: string | null;
  meiCnpj: string | null;
  meiEndereco: string | null;

  // Titular
  cpf: string | null;
  rg: string | null;
  nacionalidade: string | null;
  estadoCivil: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;

  /** Valores dos campos personalizados, indexados pela chave. */
  extras?: Record<string, string>;
};

export const DOCUMENTOS_VAZIOS: Documentos = {
  meiRazaoSocial: null, meiCnpj: null, meiEndereco: null,
  cpf: null, rg: null, nacionalidade: null, estadoCivil: null,
  endereco: null, telefone: null, email: null, extras: {},
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
  /** Campos extras que você define, para usar como marcador nos modelos. */
  camposPersonalizados?: CampoPersonalizado[];
  /** Modelos de contrato de cliente, um conjunto por empresa. */
  modelosComerciais?: ModeloComercial[];
  /** Histórico dos contratos de cliente já gerados. */
  contratosComerciais?: ContratoComercial[];
};

/* ------------------------------------------------------------------ *
 * Contratos comerciais — venda para cliente
 * ------------------------------------------------------------------ */

/** Cada modelo pertence a UMA empresa: quem vende pela Acelera usa o dela. */
export type ModeloComercial = {
  id: string;
  empresaId: string;
  nome: string;
  conteudo: string;
  criadoEm: string;
  atualizadoEm: string;
};

/** Dados do cliente preenchidos pelo vendedor no formulário. */
export type DadosCliente = {
  razaoSocial: string;
  /** CNPJ ou CPF — cliente pode ser pessoa física. */
  documento: string;
  endereco: string;
  representante: string;
  representanteCpf: string;
  email: string;
  telefone: string;
  objeto: string;
  valorCentavos: number;
  formaPagamento: string;
  vigencia: string;
  /** Valores dos campos personalizados comerciais. */
  extras?: Record<string, string>;
};

/**
 * Registro do que foi gerado.
 *
 * O PDF não é guardado — é remontado a partir destes dados quando preciso.
 * Assim o histórico fica leve e continua sendo possível reemitir a via.
 */
export type ContratoComercial = {
  id: string;
  empresaId: string;
  modeloId: string;
  /** Nome do modelo no momento da emissão: o modelo pode mudar depois. */
  modeloNome: string;
  cliente: DadosCliente;
  geradoPor: string;
  geradoPorNome: string;
  geradoEm: string;
};

/** Marcadores do contrato comercial. */
export const MARCADORES_COMERCIAIS: { chave: string; descricao: string; grupo: string }[] = [
  { chave: 'clienteRazaoSocial', descricao: 'Razão social ou nome', grupo: 'Cliente' },
  { chave: 'clienteDocumento', descricao: 'CNPJ ou CPF', grupo: 'Cliente' },
  { chave: 'clienteEndereco', descricao: 'Endereço', grupo: 'Cliente' },
  { chave: 'clienteRepresentante', descricao: 'Quem assina pelo cliente', grupo: 'Cliente' },
  { chave: 'clienteRepresentanteCpf', descricao: 'CPF de quem assina', grupo: 'Cliente' },
  { chave: 'clienteEmail', descricao: 'E-mail', grupo: 'Cliente' },
  { chave: 'clienteTelefone', descricao: 'Telefone', grupo: 'Cliente' },

  { chave: 'objeto', descricao: 'O que foi contratado', grupo: 'Negócio' },
  { chave: 'valor', descricao: 'Valor, ex: R$ 5.000,00', grupo: 'Negócio' },
  { chave: 'valorExtenso', descricao: 'Valor por extenso', grupo: 'Negócio' },
  { chave: 'formaPagamento', descricao: 'Como será pago', grupo: 'Negócio' },
  { chave: 'vigencia', descricao: 'Prazo ou vigência', grupo: 'Negócio' },

  { chave: 'empresa', descricao: 'Nome curto da empresa', grupo: 'Contratada' },
  { chave: 'empresaRazaoSocial', descricao: 'Razão social', grupo: 'Contratada' },
  { chave: 'empresaCnpj', descricao: 'CNPJ', grupo: 'Contratada' },
  { chave: 'empresaEndereco', descricao: 'Endereço', grupo: 'Contratada' },
  { chave: 'empresaRepresentante', descricao: 'Quem assina pela empresa', grupo: 'Contratada' },
  { chave: 'empresaRepresentanteCpf', descricao: 'CPF de quem assina', grupo: 'Contratada' },

  { chave: 'vendedor', descricao: 'Quem gerou o contrato', grupo: 'Emissão' },
  { chave: 'hoje', descricao: 'Data de hoje por extenso', grupo: 'Emissão' },
];

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
