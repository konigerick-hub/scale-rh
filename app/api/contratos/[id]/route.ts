import { NextResponse, type NextRequest } from 'next/server';
import { sessaoAtual, podeVerContrato } from '@/lib/auth/guard';
import { lerContratoParaEntrega, TIPO_PDF } from '@/lib/contratos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Entrega do contrato assinado.
 *
 * O arquivo nunca tem URL pública: ele só existe através desta rota, que
 * verifica a sessão e o papel antes de ler qualquer byte.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await sessaoAtual();
  if (!usuario) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  if (!podeVerContrato(usuario)) {
    // 404 em vez de 403: um 403 confirmaria que existe contrato para esse
    // colaborador, o que já é informação que este usuário não deveria ter.
    return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  }

  const { id } = await params;
  const res = await lerContratoParaEntrega(usuario, id);
  if (!res.ok) {
    return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  }

  // Nome sanitizado: aspas ou quebras de linha no nome do arquivo permitiriam
  // injetar cabeçalhos na resposta.
  const nomeSeguro = res.nomeArquivo.replace(/[^\w.\-() ]/g, '_');

  return new NextResponse(new Uint8Array(res.dados), {
    headers: {
      'Content-Type': TIPO_PDF,
      'Content-Disposition': `inline; filename="${nomeSeguro}"`,
      'Content-Length': String(res.dados.length),
      // Documento sensível: não pode ficar em cache de CDN nem de navegador.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
