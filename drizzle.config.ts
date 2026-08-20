import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Toda alteração de schema vira arquivo de migração versionado — nunca
  // aplicar mudança direto em produção sem passar por migração revisada.
  strict: true,
  verbose: true,
});
