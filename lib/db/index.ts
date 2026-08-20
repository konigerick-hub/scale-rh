import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada. Copie .env.example para .env.local.');
}

/**
 * Em serverless cada invocação pode criar um processo novo, e sem cache o pool
 * vazaria conexões a cada hot reload no dev. O singleton em globalThis resolve
 * os dois casos.
 */
const globalForDb = globalThis as unknown as { _pool?: Pool };

const pool =
  globalForDb._pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Poucas conexões por instância: em serverless são muitas instâncias
    // simultâneas, e é o pooler do provedor que agrega tudo.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // TLS obrigatório. `verify-full` na connection string valida também o
    // hostname do certificado — só desligue em Postgres local de desenvolvimento.
    ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true },
  });

if (process.env.NODE_ENV !== 'production') globalForDb._pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
