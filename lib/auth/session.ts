import { SignJWT, jwtVerify } from 'jose';

/**
 * Sessão em JWT assinado, guardado em cookie HttpOnly.
 *
 * Este arquivo é Edge-safe de propósito: só usa `jose`, nunca importa o banco
 * nem o argon2. É o que permite o middleware verificar a sessão sem puxar
 * driver nativo para o Edge runtime.
 */

/**
 * O prefixo `__Host-` exige o atributo Secure, que por sua vez exige HTTPS.
 * Em http://localhost o navegador rejeitaria o cookie sem avisar, então o
 * prefixo entra só em produção — onde ele de fato protege.
 */
export const COOKIE_SESSAO =
  process.env.NODE_ENV === 'production' ? '__Host-scale_sessao' : 'scale_sessao';

/** 4 horas. Curto porque o dado é sensível; o usuário refaz login no dia seguinte. */
const DURACAO_SEGUNDOS = 4 * 60 * 60;

export type Papel = 'admin' | 'gestor' | 'leitura';

export type Sessao = {
  usuarioId: string;
  email: string;
  nome: string;
  papel: Papel;
};

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'SESSION_SECRET ausente ou com menos de 32 caracteres. Gere com: openssl rand -base64 48',
    );
  }
  return new TextEncoder().encode(s);
}

export async function criarToken(sessao: Sessao): Promise<string> {
  return new SignJWT({
    email: sessao.email,
    nome: sessao.nome,
    papel: sessao.papel,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sessao.usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(segredo());
}

export async function lerToken(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return {
      usuarioId: payload.sub,
      email: String(payload.email ?? ''),
      nome: String(payload.nome ?? ''),
      papel: payload.papel as Papel,
    };
  } catch {
    // Assinatura inválida, expirado ou malformado — tudo é "não autenticado".
    return null;
  }
}

/**
 * `__Host-` obriga Secure + Path=/ e proíbe Domain, então o cookie não pode ser
 * plantado por um subdomínio comprometido. SameSite=strict corta CSRF na raiz.
 */
export const opcoesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: DURACAO_SEGUNDOS,
};
