CREATE TYPE "public"."clima" AS ENUM('excelente', 'saudavel', 'atencao', 'critico');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('admin', 'gestor', 'leitura');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" uuid,
	"usuario_email" text,
	"acao" text NOT NULL,
	"entidade" text,
	"entidade_id" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "avaliacoes_clima" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"mes" text NOT NULL,
	"classificacao" "clima" NOT NULL,
	"nota" numeric(3, 1) NOT NULL,
	"avaliador_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colaboradores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"nascimento" date,
	"data_contratacao" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"desligado_em" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"nome_arquivo" text NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"enviado_por" uuid,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cor" text DEFAULT '#12141A' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "tentativas_login" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chave" text NOT NULL,
	"sucesso" boolean NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario_empresas" (
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	CONSTRAINT "usuario_empresas_usuario_id_empresa_id_pk" PRIMARY KEY("usuario_id","empresa_id")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"nome" text NOT NULL,
	"papel" "papel" DEFAULT 'leitura' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"mfa_secret" text,
	"trocar_senha" boolean DEFAULT false NOT NULL,
	"ultimo_login_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vinculos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cargo" text DEFAULT '-' NOT NULL,
	"valor_fixo" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes_clima" ADD CONSTRAINT "avaliacoes_clima_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes_clima" ADD CONSTRAINT "avaliacoes_clima_avaliador_id_usuarios_id_fk" FOREIGN KEY ("avaliador_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_enviado_por_usuarios_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_ts_idx" ON "audit_log" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "audit_log_usuario_idx" ON "audit_log" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "audit_log_acao_idx" ON "audit_log" USING btree ("acao");--> statement-breakpoint
CREATE UNIQUE INDEX "avaliacoes_colaborador_mes_uk" ON "avaliacoes_clima" USING btree ("colaborador_id","mes");--> statement-breakpoint
CREATE INDEX "colaboradores_nome_idx" ON "colaboradores" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "contratos_colaborador_idx" ON "contratos" USING btree ("colaborador_id");--> statement-breakpoint
CREATE INDEX "tentativas_chave_ts_idx" ON "tentativas_login" USING btree ("chave","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_uk" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "vinculos_colaborador_empresa_uk" ON "vinculos" USING btree ("colaborador_id","empresa_id");--> statement-breakpoint
CREATE INDEX "vinculos_empresa_idx" ON "vinculos" USING btree ("empresa_id");