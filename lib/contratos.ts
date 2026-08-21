import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { alterarBase, carregarBase } from '@/lib/store/dados';
import { lerBinario, remover } from '@/lib/store/blob';
import { auditar, Acao } from '@/lib/auth/audit';
import type { UsuarioAutenticado } from '@/lib/auth/guard';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const TIPO_PDF = 'application/pdf';

/** Caminho no armazenamento privado. O id aleatório impede adivinhar o caminho. */
export function caminhoContrato(colaboradorId: string): string {
  return `contratos/${colaboradorId}/${randomUUID()}.pdf`;
}

/**
 * Confere a assinatura do arquivo, não a extensão nem o content-type.
 *
 * Os dois são declarados por quem envia e podem mentir. Todo PDF começa com os
 * bytes `%PDF-`; é a única checagem que o remetente não controla.
 */
export function pareceMesmoPdf(inicio: Buffer | Uint8Array): boolean {
  const b = Buffer.from(inicio.subarray(0, 5));
  return b.toString('latin1') === '%PDF-';
}

export type ResultadoValidacao =
  | { ok: true; sha256: string; tamanho: number }
  | { ok: false; erro: string };

export function validarPdf(dados: Buffer): ResultadoValidacao {
  if (dados.length === 0) return { ok: false, erro: 'O arquivo está vazio.' };
  if (dados.length > MAX_PDF_BYTES) {
    return {
      ok: false,
      erro: `O arquivo tem ${(dados.length / 1024 / 1024).toFixed(1)} MB. O limite é ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
    };
  }
  if (!pareceMesmoPdf(dados)) {
    return { ok: false, erro: 'O arquivo não é um PDF válido.' };
  }
  return {
    ok: true,
    sha256: createHash('sha256').update(dados).digest('hex'),
    tamanho: dados.length,
  };
}

/**
 * Registra o contrato no cadastro depois que o arquivo já está no armazenamento.
 *
 * Se o colaborador já tinha contrato, o arquivo antigo é apagado — senão o
 * armazenamento acumularia versões órfãs de documentos sensíveis para sempre.
 */
export async function registrarContrato(params: {
  usuario: UsuarioAutenticado;
  colaboradorId: string;
  caminho: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  sha256: string;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { usuario, colaboradorId, caminho, nomeArquivo, tamanhoBytes, sha256 } = params;

  let caminhoAntigo: string | null = null;
  let achou = false;

  await alterarBase((base) => {
    const c = base.colaboradores.find((x) => x.id === colaboradorId);
    if (!c) return;
    achou = true;
    caminhoAntigo = c.contrato?.caminho ?? null;
    c.contrato = {
      caminho,
      nomeArquivo: nomeArquivo.slice(0, 200),
      tamanhoBytes,
      sha256,
      enviadoPor: usuario.id,
      enviadoEm: new Date().toISOString(),
    };
    c.atualizadoEm = new Date().toISOString();
  });

  if (!achou) return { ok: false, erro: 'Colaborador não encontrado.' };

  if (caminhoAntigo && caminhoAntigo !== caminho) {
    await remover(caminhoAntigo).catch(() => {});
  }

  await auditar({
    acao: Acao.CONTRATO_ENVIAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'colaborador',
    entidadeId: colaboradorId,
    metadata: { nomeArquivo, tamanhoBytes, sha256 },
  });

  return { ok: true };
}

/**
 * Lê o contrato para entrega, verificando permissão e registrando o acesso.
 *
 * Ver contrato assinado é evento auditável por si só: o documento costuma ter
 * CPF, RG, endereço e assinatura.
 */
export async function lerContratoParaEntrega(
  usuario: UsuarioAutenticado,
  colaboradorId: string,
): Promise<
  { ok: true; dados: Buffer; nomeArquivo: string } | { ok: false; motivo: 'nao-encontrado' }
> {
  const { base } = await carregarBase();
  const c = base.colaboradores.find((x) => x.id === colaboradorId);
  if (!c || !c.contrato) return { ok: false, motivo: 'nao-encontrado' };

  const dados = await lerBinario(c.contrato.caminho);
  if (!dados) return { ok: false, motivo: 'nao-encontrado' };

  await auditar({
    acao: Acao.CONTRATO_VISUALIZAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'colaborador',
    entidadeId: colaboradorId,
    metadata: { colaborador: c.nome, nomeArquivo: c.contrato.nomeArquivo },
  });

  return { ok: true, dados, nomeArquivo: c.contrato.nomeArquivo };
}

export async function removerContrato(
  usuario: UsuarioAutenticado,
  colaboradorId: string,
): Promise<void> {
  let caminho: string | null = null;

  await alterarBase((base) => {
    const c = base.colaboradores.find((x) => x.id === colaboradorId);
    if (!c || !c.contrato) return;
    caminho = c.contrato.caminho;
    c.contrato = null;
    c.atualizadoEm = new Date().toISOString();
  });

  if (caminho) {
    await remover(caminho).catch(() => {});
    await auditar({
      acao: Acao.CONTRATO_REMOVER,
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      entidade: 'colaborador',
      entidadeId: colaboradorId,
    });
  }
}
