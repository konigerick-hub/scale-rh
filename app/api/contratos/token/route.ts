import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { sessaoAtual, podeVerContrato } from '@/lib/auth/guard';
import { MAX_PDF_BYTES, TIPO_PDF } from '@/lib/contratos';

export const runtime = 'nodejs';

/**
 * Emite o token que autoriza o navegador a enviar o arquivo direto ao
 * armazenamento, sem passar pela função (que recusaria mais de ~4,5 MB).
 *
 * Sem a checagem de sessão dentro de `onBeforeGenerateToken`, esta rota seria
 * um endpoint aberto de upload para qualquer pessoa na internet.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const resposta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const usuario = await sessaoAtual();
        if (!usuario) throw new Error('Não autenticado.');
        if (!podeVerContrato(usuario)) throw new Error('Sem permissão.');

        // O caminho é decidido pelo servidor e conferido aqui: sem isso, o
        // cliente poderia escrever em qualquer lugar do armazenamento.
        if (!pathname.startsWith('contratos/')) {
          throw new Error('Caminho não permitido.');
        }

        return {
          allowedContentTypes: [TIPO_PDF],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ usuarioId: usuario.id }),
        };
      },

      // O registro no cadastro é feito pela rota /confirmar, chamada pelo
      // próprio navegador. O webhook onUploadCompleted não alcança localhost,
      // então depender dele quebraria o fluxo em desenvolvimento.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(resposta);
  } catch (erro) {
    return NextResponse.json({ erro: (erro as Error).message }, { status: 400 });
  }
}
