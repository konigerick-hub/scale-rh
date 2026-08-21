import 'server-only';
import { lerTexto, escreverTexto, ConflitoDeEscrita } from './blob';
import { BASE_VAZIA, type BaseDados } from './tipos';

export const CHAVE_BASE = 'dados/base.json';

export { ConflitoDeEscrita };

export type BaseComVersao = { base: BaseDados; etag: string | null };

export async function carregarBase(): Promise<BaseComVersao> {
  const lido = await lerTexto(CHAVE_BASE);
  if (!lido) return { base: structuredClone(BASE_VAZIA), etag: null };

  try {
    return { base: JSON.parse(lido.conteudo) as BaseDados, etag: lido.etag };
  } catch {
    // JSON corrompido não pode ser sobrescrito silenciosamente com base vazia —
    // isso apagaria o cadastro inteiro. Falha alto para investigação.
    throw new Error(
      `Base de dados corrompida em ${CHAVE_BASE}. Restaure a partir de um backup antes de continuar.`,
    );
  }
}

/**
 * Aplica uma alteração de forma segura contra escrita concorrente.
 *
 * Lê a versão atual, aplica a mudança e só grava se ninguém tiver escrito no
 * intervalo. Se alguém escreveu, tenta de novo com o dado fresco — em vez de
 * sobrescrever e perder o trabalho da outra pessoa.
 */
export async function alterarBase<T>(
  mudanca: (base: BaseDados) => T | Promise<T>,
  tentativas = 3,
): Promise<T> {
  let ultimoErro: unknown;

  for (let i = 0; i < tentativas; i++) {
    const { base, etag } = await carregarBase();
    const resultado = await mudanca(base);

    try {
      await escreverTexto(CHAVE_BASE, JSON.stringify(base, null, 2), etag);
      return resultado;
    } catch (erro) {
      if (erro instanceof ConflitoDeEscrita) {
        ultimoErro = erro;
        continue; // recarrega e reaplica sobre a versão nova
      }
      throw erro;
    }
  }

  throw ultimoErro ?? new Error('Não foi possível salvar após várias tentativas.');
}
