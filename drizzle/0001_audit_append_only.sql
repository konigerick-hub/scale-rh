-- Auditoria à prova de adulteração.
--
-- Sem isto, quem comprometer a aplicação (ou um admin mal-intencionado) apaga
-- o próprio rastro e a auditoria vira decoração. O banco passa a recusar
-- UPDATE e DELETE em audit_log, mesmo vindo da aplicação.
--
-- PRÉ-REQUISITO: a aplicação precisa conectar com um usuário SEM privilégio de
-- superusuário e que NÃO seja dono da tabela — dono e superusuário ignoram GRANT.
-- Crie o usuário da aplicação antes de rodar esta migração:
--
--   CREATE ROLE scale_app LOGIN PASSWORD 'senha-forte-aqui';
--
-- e use a connection string de scale_app na DATABASE_URL da aplicação.
-- As migrações continuam rodando com o usuário dono do banco.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scale_app') THEN

    GRANT USAGE ON SCHEMA public TO scale_app;

    GRANT SELECT, INSERT, UPDATE, DELETE ON
      empresas, usuarios, usuario_empresas, colaboradores,
      vinculos, contratos, avaliacoes_clima, tentativas_login
    TO scale_app;

    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scale_app;

    -- Auditoria: escreve e lê, nunca altera nem remove.
    GRANT SELECT, INSERT ON audit_log TO scale_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM scale_app;

    RAISE NOTICE 'Privilegios aplicados ao usuario scale_app.';
  ELSE
    RAISE NOTICE 'Usuario scale_app nao existe - GRANTs ignorados. Crie o usuario e rode novamente.';
  END IF;
END
$$;

-- Defesa extra: mesmo o dono da tabela é barrado por trigger.
-- (Superusuário ainda passa — por isso a aplicação nunca deve usar superusuário.)
CREATE OR REPLACE FUNCTION audit_log_somente_insercao()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log e append-only: % nao e permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_bloqueia_alteracao ON audit_log;
CREATE TRIGGER audit_log_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_somente_insercao();
