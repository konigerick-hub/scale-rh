import { NextResponse, type NextRequest } from 'next/server';
import { sessaoAtual, podeVerContrato } from '@/lib/auth/guard';
import { carregarBase } from '@/lib/store/dados';
import { preencherModelo, gerarPdf } from '@/lib/gerar-contrato';
import { auditar, Acao } from '@/lib/auth/audit';
import { TIPO_PDF } from '@/lib/contratos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gera o contrato preenchido para imprimir e colher assinatura.
 *
 * Este PDF é um rascunho: NÃO é gravado no armazenamento nem vira o contrato
 * assinado do colaborador. O documento assinado entra depois pelo envio normal.
 * Manter os dois separados evita confundir minuta com contrato válido.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await sessaoAtual();
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  if (!podeVerContrato(usuario)) {
    return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  }

  const { id } = await params;
  const modeloId = req.nextUrl.searchParams.get('modelo');
  const vinculoId = req.nextUrl.searchParams.get('vinculo');
  if (!modeloId || !vinculoId) {
    return NextResponse.json({ erro: 'Escolha o modelo e a empresa.' }, { status: 400 });
  }

  const { base } = await carregarBase();
  const colaborador = base.colaboradores.find((c) => c.id === id);
  const modelo = base.modelos?.find((m) => m.id === modeloId);
  if (!colaborador || !modelo) {
    return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  }

  const vinculo = colaborador.vinculos.find((v) => v.id === vinculoId);
  const empresa = vinculo && base.empresas.find((e) => e.id === vinculo.empresaId);
  if (!vinculo || !empresa) {
    return NextResponse.json({ erro: 'Vínculo não encontrado.' }, { status: 404 });
  }

  const corpo = preencherModelo(modelo.conteudo, colaborador, vinculo, empresa);
  const pdf = await gerarPdf(modelo.nome, corpo);

  await auditar({
    acao: Acao.CONTRATO_GERAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'colaborador',
    entidadeId: id,
    metadata: { colaborador: colaborador.nome, modelo: modelo.nome, empresa: empresa.nome },
  });

  const nomeSeguro = `contrato-${colaborador.nome}-${empresa.nome}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '-')
    .toLowerCase();

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': TIPO_PDF,
      // attachment: é um documento para imprimir e levar, não para ler na tela.
      'Content-Disposition': `attachment; filename="${nomeSeguro}.pdf"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
