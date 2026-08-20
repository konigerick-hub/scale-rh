import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id com os parâmetros recomendados pelo OWASP (19 MiB, 2 iterações).
 * Roda só em Node runtime — módulo nativo não funciona no Edge, por isso
 * o middleware nunca importa este arquivo.
 */
const OPTS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashSenha(senha: string): Promise<string> {
  return hash(senha, OPTS);
}

export async function verificarSenha(
  senhaHash: string,
  senha: string,
): Promise<boolean> {
  try {
    return await verify(senhaHash, senha, OPTS);
  } catch {
    // Hash malformado ou corrompido não deve vazar exceção para o fluxo de login.
    return false;
  }
}

/**
 * Hash descartável usado quando o e-mail não existe. Sem isso, responder na hora
 * para e-mail inexistente e demorar ~50ms para e-mail existente revela quais
 * contas existem (enumeração de usuários) só pelo tempo de resposta.
 */
const HASH_DUMMY =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdGZha2VzYWx0ZmFrZQ$m3vFq0BwXQXqXvVYq0YQ8lWQ8kFq0BwXQXqXvVYq0YQ';

export async function gastarTempoConstante(): Promise<void> {
  await verificarSenha(HASH_DUMMY, 'senha-que-nao-importa');
}

/** Política mínima de senha. Sem isso, "123456" passa direto. */
export function validarForcaSenha(senha: string): string | null {
  if (senha.length < 12) return 'A senha precisa ter pelo menos 12 caracteres.';
  if (!/[a-z]/.test(senha)) return 'A senha precisa ter ao menos uma letra minúscula.';
  if (!/[A-Z]/.test(senha)) return 'A senha precisa ter ao menos uma letra maiúscula.';
  if (!/[0-9]/.test(senha)) return 'A senha precisa ter ao menos um número.';
  return null;
}
