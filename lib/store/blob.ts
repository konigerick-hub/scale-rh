import 'server-only';
import { put, head, get, del, list, BlobPreconditionFailedError } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Armazenamento com dois modos:
 *
 *  - Produção (Vercel): Vercel Blob em modo privado. O arquivo só é alcançável
 *    através deste código autenticado, nunca por URL direta.
 *  - Desenvolvimento local: arquivos em `.data/`, sem nenhuma configuração.
 *
 * O modo local existe para que dê para rodar e testar o sistema inteiro na
 * máquina antes de existir qualquer coisa na Vercel.
 */

const usandoBlob = Boolean(
  process.env.BLOB_STORE_ID ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL,
);

export const modoArmazenamento = usandoBlob ? 'vercel-blob' : 'disco-local';

const DIR_LOCAL = path.join(process.cwd(), '.data');

/** ETag identifica a versão lida, para detectar escrita concorrente. */
export type Lido = { conteudo: string; etag: string | null } | null;

/** Lançado quando outra pessoa alterou o dado entre a leitura e a escrita. */
export class ConflitoDeEscrita extends Error {
  constructor() {
    super('O registro foi alterado por outra pessoa. Recarregue e tente de novo.');
    this.name = 'ConflitoDeEscrita';
  }
}

/* ------------------------------------------------------------------ *
 * Disco local
 * ------------------------------------------------------------------ */

function caminhoLocal(chave: string) {
  return path.join(DIR_LOCAL, chave);
}

async function lerLocal(chave: string): Promise<Lido> {
  try {
    const arquivo = caminhoLocal(chave);
    const [conteudo, stat] = await Promise.all([
      fs.readFile(arquivo, 'utf8'),
      fs.stat(arquivo),
    ]);
    // mtime em nanossegundos serve de ETag: muda a cada escrita.
    return { conteudo, etag: String(stat.mtimeMs) };
  } catch {
    return null;
  }
}

async function escreverLocal(chave: string, conteudo: string, etag?: string | null) {
  const arquivo = caminhoLocal(chave);
  await fs.mkdir(path.dirname(arquivo), { recursive: true });

  if (etag !== undefined && etag !== null) {
    const atual = await lerLocal(chave);
    if (atual && atual.etag !== etag) throw new ConflitoDeEscrita();
  }
  await fs.writeFile(arquivo, conteudo, 'utf8');
}

/* ------------------------------------------------------------------ *
 * API pública — mesma assinatura nos dois modos
 * ------------------------------------------------------------------ */

export async function lerTexto(chave: string): Promise<Lido> {
  if (!usandoBlob) return lerLocal(chave);

  try {
    // useCache:false evita ler uma versão velha do cache do CDN — obrigatório
    // para dado que acabou de ser escrito.
    const res = await get(chave, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    const conteudo = await new Response(res.stream).text();
    return { conteudo, etag: res.blob.etag ?? null };
  } catch {
    return null;
  }
}

export async function escreverTexto(
  chave: string,
  conteudo: string,
  etag?: string | null,
): Promise<void> {
  if (!usandoBlob) return escreverLocal(chave, conteudo, etag);

  try {
    await put(chave, conteudo, {
      access: 'private',
      contentType: 'application/json; charset=utf-8',
      allowOverwrite: true,
      // Só grava se ninguém tiver alterado desde a leitura.
      ...(etag ? { ifMatch: etag } : {}),
      // Documento vivo: cache curto para não servir versão antiga.
      cacheControlMaxAge: 0,
    });
  } catch (erro) {
    if (erro instanceof BlobPreconditionFailedError) throw new ConflitoDeEscrita();
    throw erro;
  }
}

/**
 * Grava um arquivo que nunca será sobrescrito — usado na auditoria, onde cada
 * evento é um objeto próprio e imutável.
 */
export async function escreverImutavel(chave: string, conteudo: string): Promise<void> {
  if (!usandoBlob) return escreverLocal(chave, conteudo);
  await put(chave, conteudo, {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: false,
  });
}

export async function escreverBinario(
  chave: string,
  dados: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  if (!usandoBlob) {
    const arquivo = caminhoLocal(chave);
    await fs.mkdir(path.dirname(arquivo), { recursive: true });
    await fs.writeFile(arquivo, dados);
    return;
  }
  await put(chave, Buffer.from(dados), {
    access: 'private',
    contentType,
    allowOverwrite: true,
  });
}

export async function lerBinario(chave: string): Promise<Buffer | null> {
  if (!usandoBlob) {
    try {
      return await fs.readFile(caminhoLocal(chave));
    } catch {
      return null;
    }
  }
  try {
    const res = await get(chave, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  } catch {
    return null;
  }
}

export async function remover(chave: string): Promise<void> {
  if (!usandoBlob) {
    await fs.rm(caminhoLocal(chave), { force: true });
    return;
  }
  await del(chave);
}

export async function listarChaves(prefixo: string): Promise<string[]> {
  if (!usandoBlob) {
    const raiz = caminhoLocal(prefixo);
    try {
      const nomes = await fs.readdir(raiz, { recursive: true, withFileTypes: true });
      return nomes
        .filter((n) => n.isFile())
        .map((n) => path.posix.join(prefixo, path.relative(raiz, path.join(n.parentPath, n.name)).split(path.sep).join('/')));
    } catch {
      return [];
    }
  }
  const res = await list({ prefix: prefixo, limit: 1000 });
  return res.blobs.map((b) => b.pathname);
}

export { head };
