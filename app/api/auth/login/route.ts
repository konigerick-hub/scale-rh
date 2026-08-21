import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { carregarBase, alterarBase } from '@/lib/store/dados';
import { verificarSenha, gastarTempoConstante } from '@/lib/auth/password';
import { criarToken, COOKIE_SESSAO, opcoesCookie } from '@/lib/auth/session';
import { verificarBloqueio, registrarTentativa } from '@/lib/auth/rate-limit';
import { auditar, Acao } from '@/lib/auth/audit';

// Argon2 é módulo nativo: precisa de Node runtime, não roda no Edge.
export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email().max(255),
  senha: z.string().min(1).max(200),
});

/** Mensagem única — dizer "e-mail não existe" entrega quais contas existem. */
const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'desconhecido';

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json({ erro: CREDENCIAL_INVALIDA }, { status: 401 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { senha } = parsed.data;

  // 1) Limite de tentativas antes de qualquer trabalho caro
  const bloqueio = await verificarBloqueio(email, ip);
  if (bloqueio.bloqueado) {
    await auditar({ acao: Acao.LOGIN_BLOQUEADO, usuarioEmail: email });
    return NextResponse.json(
      { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(bloqueio.esperarSegundos) } },
    );
  }

  // 2) Buscar usuário
  const { base } = await carregarBase();
  const usuario = base.usuarios.find((u) => u.email === email);

  // 3) Verificar senha — gastando tempo comparável exista o usuário ou não
  let ok = false;
  if (usuario && usuario.ativo) {
    ok = await verificarSenha(usuario.senhaHash, senha);
  } else {
    await gastarTempoConstante();
  }

  await registrarTentativa(email, ip, ok);

  if (!ok || !usuario) {
    await auditar({ acao: Acao.LOGIN_FALHA, usuarioEmail: email });
    return NextResponse.json({ erro: CREDENCIAL_INVALIDA }, { status: 401 });
  }

  // 4) Sessão
  const token = await criarToken({
    usuarioId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
  });

  await alterarBase((b) => {
    const u = b.usuarios.find((x) => x.id === usuario.id);
    if (u) u.ultimoLoginEm = new Date().toISOString();
  });

  await auditar({
    acao: Acao.LOGIN_OK,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
  });

  const res = NextResponse.json({ ok: true, trocarSenha: usuario.trocarSenha });
  res.cookies.set(COOKIE_SESSAO, token, opcoesCookie);
  return res;
}
