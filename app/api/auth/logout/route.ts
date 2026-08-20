import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_SESSAO, lerToken } from '@/lib/auth/session';
import { auditar, Acao } from '@/lib/auth/audit';

export const runtime = 'nodejs';

export async function POST() {
  const jar = await cookies();
  const sessao = await lerToken(jar.get(COOKIE_SESSAO)?.value);

  if (sessao) {
    await auditar({
      acao: Acao.LOGOUT,
      usuarioId: sessao.usuarioId,
      usuarioEmail: sessao.email,
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, '', { path: '/', maxAge: 0 });
  return res;
}
