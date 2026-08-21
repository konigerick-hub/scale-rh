import { NextResponse, type NextRequest } from 'next/server';
import { sessaoAtual, podeVerContrato } from '@/lib/auth/guard';
import { escreverBinario } from '@/lib/store/blob';
import {
  caminhoContrato,
  registrarContrato,
  validarPdf,
  MAX_PDF_BYTES,
  TIPO_PDF,
} from '@/lib/contratos';

export const runtime = 'nodejs';

/**
 * Envio direto: o arquivo passa por esta rota.
 *
 * ATENÇÃO — funções da Vercel recusam corpo de requisição acima de ~4,5 MB.
 * Este caminho serve para desenvolvimento local e para arquivos pequenos; o
 * envio de arquivos grandes em produção usa `/api/contratos/token`, em que o
 * navegador fala direto com o armazenamento.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await sessaoAtual();
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  if (!podeVerContrato(usuario)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const { id } = await params;

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get('arquivo');
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 });
  }

  if (arquivo.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { erro: `O limite é ${MAX_PDF_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const dados = Buffer.from(await arquivo.arrayBuffer());
  const validacao = validarPdf(dados);
  if (!validacao.ok) {
    return NextResponse.json({ erro: validacao.erro }, { status: 400 });
  }

  const caminho = caminhoContrato(id);
  await escreverBinario(caminho, dados, TIPO_PDF);

  const registro = await registrarContrato({
    usuario,
    colaboradorId: id,
    caminho,
    nomeArquivo: arquivo.name,
    tamanhoBytes: validacao.tamanho,
    sha256: validacao.sha256,
  });

  if (!registro.ok) {
    return NextResponse.json({ erro: registro.erro }, { status: 404 });
  }

  return NextResponse.json({ ok: true, tamanho: validacao.tamanho });
}
