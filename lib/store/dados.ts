import 'server-only';
import { lerTexto, escreverTexto } from './blob';
import { BASE_VAZIA, type BaseDados } from './tipos';

export const CHAVE_BASE = 'dados/base.json';

export async function carregarBase(): Promise<{ base: BaseDados }> {
  const lido = await lerTexto(CHAVE_BASE);
  if (!lido) return { base: structuredClone(BASE_VAZIA) };

  try {
    return { base: JSON.parse(lido.conteudo) as BaseDados };
  } catch {
    // JSON corrompido não pode ser sobrescrito silenciosamente com base vazia —
    // isso apagaria o cadastro inteiro. Falha alto para investigação.
    throw new Error(
      `Base de dados corrompida em ${CHAVE_BASE}. Restaure a partir de um backup antes de continuar.`,
    );
  }
}

/** Lê, aplica a mudança e grava. A última gravação vence. */
export async function alterarBase<T>(
  mudanca: (base: BaseDados) => T | Promise<T>,
): Promise<T> {
  const { base } = await carregarBase();
  const resultado = await mudanca(base);
  await escreverTexto(CHAVE_BASE, JSON.stringify(base, null, 2));
  return resultado;
}
