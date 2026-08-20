import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tentativasLogin } from '@/lib/db/schema';

/**
 * Rate limit de login com estado no Postgres.
 *
 * Contador em memória não funciona em serverless: cada invocação pode ser um
 * processo novo, então o contador zeraria e o limite nunca seria atingido.
 * O banco é o único estado compartilhado entre as instâncias.
 */

const JANELA_MINUTOS = 15;
const MAX_POR_EMAIL = 5;
const MAX_POR_IP = 20; // mais folgado: um escritório inteiro sai pelo mesmo IP

export type Bloqueio = { bloqueado: true; esperarSegundos: number } | { bloqueado: false };

async function falhasRecentes(chave: string): Promise<number> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
  const [linha] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tentativasLogin)
    .where(
      and(
        eq(tentativasLogin.chave, chave),
        eq(tentativasLogin.sucesso, false),
        gte(tentativasLogin.ts, desde),
      ),
    );
  return linha?.total ?? 0;
}

export async function verificarBloqueio(email: string, ip: string): Promise<Bloqueio> {
  const [porEmail, porIp] = await Promise.all([
    falhasRecentes(`email:${email}`),
    falhasRecentes(`ip:${ip}`),
  ]);

  if (porEmail >= MAX_POR_EMAIL || porIp >= MAX_POR_IP) {
    return { bloqueado: true, esperarSegundos: JANELA_MINUTOS * 60 };
  }
  return { bloqueado: false };
}

export async function registrarTentativa(
  email: string,
  ip: string,
  sucesso: boolean,
): Promise<void> {
  await db.insert(tentativasLogin).values([
    { chave: `email:${email}`, sucesso },
    { chave: `ip:${ip}`, sucesso },
  ]);
}

/** Limpa registros fora da janela. Chamado no login para não precisar de cron. */
export async function limparTentativasAntigas(): Promise<void> {
  const corte = new Date(Date.now() - 24 * 60 * 60_000);
  await db.delete(tentativasLogin).where(sql`${tentativasLogin.ts} < ${corte}`);
}
