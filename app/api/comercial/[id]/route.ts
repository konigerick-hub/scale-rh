import { NextResponse, type NextRequest } from 'next/server';
import { sessaoAtual, podeVerTodosComerciais } from '@/lib/auth/guard';
import { carregarBase } from '@/lib/store/dados';
import { preencherModeloComercial, gerarPdf } from '@/lib/gerar-contrato';
import { auditar, Acao } from '@/lib/auth/audit';
import { TIPO_PDF } from '@/lib/contratos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Baixa o contrato comercial em PDF.
 *
 * O arquivo é remontado a partir dos dados guardados, então a mesma via pode
 * ser reemitida quantas vezes precisar. Um vendedor só baixa o que ele mesmo
 * emitiu; admin baixa qualquer um.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await sessaoAtual();
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

  const { id } = await params;
  const { base } = await carregarBase();
  const registro = base.contratosComerciais?.find((c) => c.id === id);
  if (!registro) return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });

  // 404 em vez de 403: um 403 confirmaria que o contrato existe.
  if (!podeVerTodosComerciais(usuario) && registro.geradoPor !== usuario.id) {
    return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  }

  const modelo = base.modelosComerciais?.find((m) => m.id === registro.modeloId);
  const empresa = base.empresas.find((e) => e.id === registro.empresaId);
  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 });
  if (!modelo) {
    return NextResponse.json(
      { erro: 'O modelo usado neste contrato foi removido. Não é possível reemitir.' },
      { status: 410 },
    );
  }

  const corpo = preencherModeloComercial(
    modelo.conteudo,
    registro.cliente,
    empresa,
    registro.geradoPorNome,
  );
  const pdf = await gerarPdf(modelo.nome, corpo);

  await auditar({
    acao: Acao.COMERCIAL_BAIXAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'contratoComercial',
    entidadeId: id,
    metadata: { cliente: registro.cliente.razaoSocial, empresa: empresa.nome },
  });

  const nomeSeguro = `contrato-${registro.cliente.razaoSocial}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '-')
    .toLowerCase()
    .slice(0, 60);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': TIPO_PDF,
      'Content-Disposition': `attachment; filename="${nomeSeguro}.pdf"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
