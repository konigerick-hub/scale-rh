import 'server-only';
import { put, head, get, del, list } from '@vercel/blob';
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

export type Lido = { conteudo: string } | null;


/* ------------------------------------------------------------------ *
 * Disco local
 * ------------------------------------------------------------------ */

function caminhoLocal(chave: string) {
  return path.join(DIR_LOCAL, chave);
}

async function lerLocal(chave: string): Promise<Lido> {
  try {
    return { conteudo: await fs.readFile(caminhoLocal(chave), 'utf8') };
  } catch {
    return null;
  }
}

async function escreverLocal(chave: string, conteudo: string) {
  const arquivo = caminhoLocal(chave);
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
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
    return { conteudo: await new Response(res.stream).text() };
  } catch {
    return null;
  }
}

/**
 * Escrita simples: a última gravação vence.
 *
 * Havia aqui uma escrita condicional por ETag para impedir que duas edições
 * simultâneas se sobrescrevessem. Ela foi removida: arquivos acima de alguns KB
 * voltam com ETag fraco, que o `If-Match` recusa, e isso derrubava todo login.
 *
 * O que se perde: se duas pessoas salvarem o MESMO colaborador no mesmo
 * instante, a segunda gravação apaga a primeira, sem aviso. Com um punhado de
 * pessoas usando, isso é raro; se o time crescer, vale reintroduzir a proteção.
 */
export async function escreverTexto(chave: string, conteudo: string): Promise<void> {
  if (!usandoBlob) return escreverLocal(chave, conteudo);

  await put(chave, conteudo, {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
    // Documento vivo: sem cache, para não servir versão antiga.
    cacheControlMaxAge: 0,
  });
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

/**
 * Lê só os primeiros bytes de um arquivo.
 *
 * Usado para conferir a assinatura de um PDF sem baixar 20 MB: o stream é
 * cancelado após a primeira porção.
 */
export async function lerInicio(chave: string, nBytes: number): Promise<Buffer | null> {
  if (!usandoBlob) {
    const bin = await lerBinario(chave);
    return bin ? bin.subarray(0, nBytes) : null;
  }
  try {
    const res = await get(chave, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;

    const leitor = res.stream.getReader();
    const { value } = await leitor.read();
    await leitor.cancel().catch(() => {});
    return value ? Buffer.from(value.subarray(0, nBytes)) : null;
  } catch {
    return null;
  }
}

/** Metadados do arquivo (tamanho, tipo) sem baixar o conteúdo. */
export async function metadados(
  chave: string,
): Promise<{ tamanho: number; contentType: string } | null> {
  if (!usandoBlob) {
    const bin = await lerBinario(chave);
    return bin ? { tamanho: bin.length, contentType: 'application/pdf' } : null;
  }
  try {
    const h = await head(chave);
    return { tamanho: h.size, contentType: h.contentType };
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
