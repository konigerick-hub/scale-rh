import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sessaoAtual } from '@/lib/auth/guard';
import { carregarBase } from '@/lib/store/dados';
import { preencherModeloComercial, gerarPdf } from '@/lib/gerar-contrato';
import { auditar, Acao } from '@/lib/auth/audit';
import { TIPO_PDF } from '@/lib/contratos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gera o contrato comercial e devolve o PDF na hora.
 *
 * NADA é gravado no cadastro. A decisão é deliberada: são ~120 contratos por
 * mês, e como o documento de dados é lido e reescrito inteiro a cada gravação,
 * guardar o histórico faria o arquivo passar de 1 MB em um ano e de 3 MB em
 * três — deixando lento até o login, que só precisa anotar o último acesso.
 *
 * O rastro fica na auditoria: quem gerou, para qual cliente, por qual empresa
 * e quando. Cada evento é um arquivo próprio e pequeno, que não passa pelo
 * documento principal.
 *
 * Consequência a saber: não há como rebaixar a mesma via depois. Perdeu o
 * arquivo, gera de novo pelo formulário.
 */

const schema = z.object({
  modeloId: z.string().uuid(),
  razaoSocial: z.string().trim().min(2, 'Informe o nome ou razão social do cliente.').max(160),
  documento: z.string().trim().max(24),
  endereco: z.string().trim().max(300),
  representante: z.string().trim().max(120),
  representanteCpf: z.string().trim().max(24),
  email: z.string().trim().max(160),
  telefone: z.string().trim().max(30),
  objeto: z.string().trim().min(2, 'Descreva o que está sendo contratado.').max(1000),
  valor: z.number().min(0).max(100_000_000),
  formaPagamento: z.string().trim().max(200),
  vigencia: z.string().trim().max(200),
});

export async function POST(req: NextRequest) {
  const usuario = await sessaoAtual();
  if (!usuario) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const { base } = await carregarBase();
  const modelo = base.modelosComerciais?.find((m) => m.id === d.modeloId);
  if (!modelo) return NextResponse.json({ erro: 'Modelo não encontrado.' }, { status: 404 });

  // Vendedor só emite pela empresa a que está vinculado; admin, por todas.
  if (
    usuario.empresasPermitidas !== null &&
    !usuario.empresasPermitidas.includes(modelo.empresaId)
  ) {
    return NextResponse.json({ erro: 'Sem acesso à empresa deste modelo.' }, { status: 403 });
  }

  const empresa = base.empresas.find((e) => e.id === modelo.empresaId);
  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 });

  const corpo = preencherModeloComercial(
    modelo.conteudo,
    {
      razaoSocial: d.razaoSocial,
      documento: d.documento,
      endereco: d.endereco,
      representante: d.representante,
      representanteCpf: d.representanteCpf,
      email: d.email,
      telefone: d.telefone,
      objeto: d.objeto,
      valorCentavos: Math.round(d.valor * 100),
      formaPagamento: d.formaPagamento,
      vigencia: d.vigencia,
      extras: {},
    },
    empresa,
    usuario.nome,
  );

  const pdf = await gerarPdf(modelo.nome, corpo);

  await auditar({
    acao: Acao.COMERCIAL_GERAR,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    entidade: 'contratoComercial',
    metadata: {
      cliente: d.razaoSocial,
      documento: d.documento,
      empresa: empresa.nome,
      modelo: modelo.nome,
      valor: d.valor,
    },
  });

  const nomeSeguro = `contrato-${d.razaoSocial}`
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
