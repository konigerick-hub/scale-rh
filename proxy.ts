import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESSAO, lerToken } from '@/lib/auth/session';

/**
 * Triagem barata na borda: barra quem não tem token válido antes da requisição
 * chegar na aplicação. NÃO é a autorização de verdade — quem decide o que cada
 * pessoa pode ver é `lib/auth/guard.ts`, que revalida no banco.
 *
 * Roda no Edge runtime, por isso só importa `jose` (nada de driver nativo aqui).
 */
export async function proxy(req: NextRequest) {
  const sessao = await lerToken(req.cookies.get(COOKIE_SESSAO)?.value);

  if (!sessao) {
    const url = new URL('/login', req.url);
    // Preserva o destino para voltar depois do login, mas só caminho interno —
    // aceitar URL absoluta aqui abriria redirect aberto para site de phishing.
    const destino = req.nextUrl.pathname + req.nextUrl.search;
    if (destino.startsWith('/') && !destino.startsWith('//')) {
      url.searchParams.set('proximo', destino);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protege tudo, menos login, arquivos estáticos e o endpoint de autenticação.
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
