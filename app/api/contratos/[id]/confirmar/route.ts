import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sessaoAtual, podeVerContrato } from '@/lib/auth/guard';
import { lerInicio, metadados, remover } from '@/lib/store/blob';
import {
  registrarContrato,
  pareceMesmoPdf,
  MAX_PDF_BYTES,
  TIPO_PDF,
} from '@/lib/contratos';

export const runtime = 'nodejs';

/*
 * O caminho é validado por formato, não só por prefixo.
 *
 * `startsWith('contratos/<id>/')` sozinho aceita `contratos/<id>/../../dados/base.json`,
 * que no modo de disco local o `path.join` normaliza para o arquivo do cadastro
 * — e o tratamento de erro desta rota apaga o caminho recusado, o que
 * destruiria a base inteira. A expressão abaixo só admite os caracteres que
 * `caminhoContrato()` gera, então `..` nunca passa.
 */
const schema = z.object({
  caminho: z
    .string()
    .min(1)
    .max(500)
    .regex(
      /^contratos\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\.pdf$/,
      'Caminho inválido.',
    ),
  nomeArquivo: z.string().min(1).max(200),
});

/**
 * Confirma um envio feito direto do navegador para o armazenamento.
 *
 * O cliente diz "gravei em tal caminho". Isso não é confiável, então aqui o
 * servidor confere por conta própria: caminho dentro da pasta do colaborador,
 * tamanho dentro do limite, tipo correto e assinatura de PDF de verdade.
 * Se algo não bate, o arquivo é apagado em vez de ficar órfão.
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
  const corpo = schema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const { caminho, nomeArquivo } = corpo.data;

  // O caminho precisa estar dentro da pasta DESTE colaborador — senão daria
  // para registrar, no colaborador A, um arquivo enviado para o colaborador B.
  if (!caminho.startsWith(`contratos/${id}/`)) {
    return NextResponse.json({ erro: 'Caminho não permitido.' }, { status: 400 });
  }

  const meta = await metadados(caminho);
  if (!meta) {
    return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 });
  }

  const invalidar = async (erro: string, status: number) => {
    await remover(caminho).catch(() => {});
    return NextResponse.json({ erro }, { status });
  };

  if (meta.tamanho > MAX_PDF_BYTES) {
    return invalidar(`O limite é ${MAX_PDF_BYTES / 1024 / 1024} MB.`, 413);
  }
  if (meta.tamanho === 0) {
    return invalidar('O arquivo está vazio.', 400);
  }
  if (!meta.contentType.startsWith(TIPO_PDF)) {
    return invalidar('O arquivo não é um PDF.', 400);
  }

  // Assinatura do arquivo: content-type é declarado por quem envia e pode mentir.
  const inicio = await lerInicio(caminho, 5);
  if (!inicio || !pareceMesmoPdf(inicio)) {
    return invalidar('O arquivo não é um PDF válido.', 400);
  }

  const registro = await registrarContrato({
    usuario,
    colaboradorId: id,
    caminho,
    nomeArquivo,
    tamanhoBytes: meta.tamanho,
    // O conteúdo não trafega pelo servidor neste caminho, então não há hash
    // do arquivo inteiro. Fica registrado que a origem foi envio direto.
    sha256: 'envio-direto',
  });

  if (!registro.ok) return invalidar(registro.erro, 404);

  return NextResponse.json({ ok: true, tamanho: meta.tamanho });
}
