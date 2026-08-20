import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  numeric,
  integer,
  bigserial,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

/** admin: vê tudo · gestor: só as empresas vinculadas · leitura: consulta sem editar */
export const papelEnum = pgEnum('papel', ['admin', 'gestor', 'leitura']);

export const climaEnum = pgEnum('clima', [
  'excelente',
  'saudavel',
  'atencao',
  'critico',
]);

/* ------------------------------------------------------------------ *
 * Empresas do grupo
 * ------------------------------------------------------------------ */

export const empresas = pgTable('empresas', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull().unique(),
  cor: text('cor').notNull().default('#12141A'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * Usuários do sistema (quem faz login) — não confundir com colaboradores
 * ------------------------------------------------------------------ */

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    senhaHash: text('senha_hash').notNull(),
    nome: text('nome').notNull(),
    papel: papelEnum('papel').notNull().default('leitura'),
    ativo: boolean('ativo').notNull().default(true),

    /** Reservado para MFA/TOTP — biblioteca local, sem API externa. Nulo = MFA desligado. */
    mfaSecret: text('mfa_secret'),

    /** Força troca de senha no próximo login (usado no primeiro acesso). */
    trocarSenha: boolean('trocar_senha').notNull().default(false),

    ultimoLoginEm: timestamp('ultimo_login_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // E-mail é case-insensitive: normalizamos para minúsculas antes de gravar,
    // e o índice único garante que não entre duplicata por diferença de caixa.
    uniqueIndex('usuarios_email_uk').on(t.email),
  ],
);

/** Escopo do gestor: quais empresas ele enxerga. Admin ignora esta tabela. */
export const usuarioEmpresas = pgTable(
  'usuario_empresas',
  {
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresas.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.empresaId] })],
);

/* ------------------------------------------------------------------ *
 * Colaboradores — a PESSOA, uma linha só
 * ------------------------------------------------------------------ */

export const colaboradores = pgTable(
  'colaboradores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nome: text('nome').notNull(),
    nascimento: date('nascimento'),
    dataContratacao: date('data_contratacao'),

    /**
     * Desligamento é soft delete: prazos trabalhistas exigem guardar o histórico.
     * O acesso a inativos fica restrito, mas o dado não some.
     */
    ativo: boolean('ativo').notNull().default(true),
    desligadoEm: date('desligado_em'),

    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('colaboradores_nome_idx').on(t.nome)],
);

/**
 * Vínculo pessoa × empresa. É o que resolve o caso do Victor Paredes, do Luiz,
 * da Natalia e dos outros que atuam em mais de uma empresa com valores diferentes:
 * uma pessoa em `colaboradores`, N linhas aqui.
 */
export const vinculos = pgTable(
  'vinculos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    colaboradorId: uuid('colaborador_id')
      .notNull()
      .references(() => colaboradores.id, { onDelete: 'cascade' }),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresas.id, { onDelete: 'restrict' }),

    cargo: text('cargo').notNull().default('-'),

    /** numeric evita o erro de arredondamento de float em valor monetário. */
    valorFixo: numeric('valor_fixo', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),

    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('vinculos_colaborador_empresa_uk').on(t.colaboradorId, t.empresaId),
    index('vinculos_empresa_idx').on(t.empresaId),
  ],
);

/* ------------------------------------------------------------------ *
 * Contratos assinados — o ativo mais sensível do sistema
 * ------------------------------------------------------------------ */

export const contratos = pgTable(
  'contratos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    colaboradorId: uuid('colaborador_id')
      .notNull()
      .references(() => colaboradores.id, { onDelete: 'cascade' }),

    /** Chave no storage privado. O arquivo NUNCA fica em bucket público. */
    storageKey: text('storage_key').notNull(),
    nomeArquivo: text('nome_arquivo').notNull(),
    tamanhoBytes: integer('tamanho_bytes').notNull(),

    /** Detecta adulteração e permite deduplicar reenvio do mesmo arquivo. */
    sha256: text('sha256').notNull(),

    enviadoPor: uuid('enviado_por').references(() => usuarios.id, {
      onDelete: 'set null',
    }),
    enviadoEm: timestamp('enviado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contratos_colaborador_idx').on(t.colaboradorId)],
);

/* ------------------------------------------------------------------ *
 * Avaliação de clima cultural
 * ------------------------------------------------------------------ */

export const avaliacoesClima = pgTable(
  'avaliacoes_clima',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    colaboradorId: uuid('colaborador_id')
      .notNull()
      .references(() => colaboradores.id, { onDelete: 'cascade' }),

    /** Mês de referência no formato YYYY-MM. */
    mes: text('mes').notNull(),
    classificacao: climaEnum('classificacao').notNull(),
    nota: numeric('nota', { precision: 3, scale: 1 }).notNull(),

    avaliadorId: uuid('avaliador_id').references(() => usuarios.id, {
      onDelete: 'set null',
    }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('avaliacoes_colaborador_mes_uk').on(t.colaboradorId, t.mes),
  ],
);

/* ------------------------------------------------------------------ *
 * Auditoria — append-only (o GRANT que impede UPDATE/DELETE está na migração)
 * ------------------------------------------------------------------ */

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),

    /** Nulo em tentativa de login falha, quando ainda não há usuário autenticado. */
    usuarioId: uuid('usuario_id').references(() => usuarios.id, {
      onDelete: 'set null',
    }),
    /** Guardado à parte porque o usuário pode ser removido depois. */
    usuarioEmail: text('usuario_email'),

    acao: text('acao').notNull(),
    entidade: text('entidade'),
    entidadeId: text('entidade_id'),

    ip: text('ip'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
  },
  (t) => [
    index('audit_log_ts_idx').on(t.ts),
    index('audit_log_usuario_idx').on(t.usuarioId),
    index('audit_log_acao_idx').on(t.acao),
  ],
);

/* ------------------------------------------------------------------ *
 * Tentativas de login — rate limit sem Redis
 *
 * Memória local não serve em serverless: cada invocação é um processo novo,
 * então o contador zeraria a cada request. O Postgres é o estado compartilhado.
 * ------------------------------------------------------------------ */

export const tentativasLogin = pgTable(
  'tentativas_login',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** E-mail tentado (minúsculo) ou o IP de origem — limitamos os dois. */
    chave: text('chave').notNull(),
    sucesso: boolean('sucesso').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tentativas_chave_ts_idx').on(t.chave, t.ts)],
);
