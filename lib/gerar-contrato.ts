import 'server-only';
import PDFDocument from 'pdfkit';
import type { Colaborador, Empresa, Vinculo } from '@/lib/store/tipos';

/**
 * Geração do contrato em PDF a partir de um modelo de texto.
 *
 * O modelo é texto puro com marcadores `{{nome}}`, `{{cpf}}` etc. Os valores
 * são substituídos e o resultado vira um PDF A4 pronto para imprimir e assinar.
 *
 * Usa as fontes padrão do PDF (Helvetica), que cobrem Latin-1 — suficiente para
 * português. Sem arquivo de fonte embutido, o PDF fica leve e não há
 * dependência de asset em disco, o que importa no ambiente serverless.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function dataBR(iso: string | null | undefined): string {
  if (!iso) return '____/____/______';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function porExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Campo não preenchido vira uma linha para completar à mão, em vez de sumir.
 * Um contrato com "undefined" no lugar do CPF é pior que um com lacuna visível.
 */
function ouLacuna(v: string | null | undefined, tamanho = 20): string {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : '_'.repeat(tamanho);
}

export function preencherModelo(
  conteudo: string,
  colaborador: Colaborador,
  vinculo: Vinculo,
  empresa: Empresa,
): string {
  const doc = colaborador.documentos;
  const valores: Record<string, string> = {
    nome: ouLacuna(colaborador.nome, 30),
    cpf: ouLacuna(doc?.cpf, 14),
    rg: ouLacuna(doc?.rg, 12),
    nacionalidade: ouLacuna(doc?.nacionalidade, 15),
    estadoCivil: ouLacuna(doc?.estadoCivil, 15),
    endereco: ouLacuna(doc?.endereco, 40),
    empresa: empresa.nome,
    cargo: ouLacuna(vinculo.cargo, 20),
    salario: brl.format(vinculo.valorFixoCentavos / 100),
    dataAdmissao: dataBR(colaborador.dataContratacao),
    nascimento: dataBR(colaborador.nascimento),
    hoje: porExtenso(new Date()),
  };

  // Aceita {{nome}} e {{ nome }}, e deixa intacto um marcador desconhecido —
  // assim um erro de digitação aparece no PDF em vez de virar texto vazio.
  return conteudo.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (bruto, chave) =>
    chave in valores ? valores[chave] : bruto,
  );
}

/** Marcadores usados no modelo que não existem — para avisar antes de gerar. */
export function marcadoresDesconhecidos(conteudo: string, validos: string[]): string[] {
  const achados = [...conteudo.matchAll(/\{\{\s*([a-zA-Z]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(achados.filter((c) => !validos.includes(c)))];
}

export function gerarPdf(titulo: string, corpo: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 64, bottom: 64, left: 64, right: 64 },
      info: { Title: titulo },
    });

    const pedacos: Buffer[] = [];
    doc.on('data', (p: Buffer) => pedacos.push(p));
    doc.on('end', () => resolve(Buffer.concat(pedacos)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(14).text(titulo, { align: 'center' });
    doc.moveDown(1.5);

    // Parágrafos separados por linha em branco; linha isolada continua junto.
    doc.font('Helvetica').fontSize(11);
    for (const paragrafo of corpo.split(/\n\s*\n/)) {
      const texto = paragrafo.replace(/\n/g, ' ').trim();
      if (!texto) continue;
      doc.text(texto, { align: 'justify', lineGap: 2 });
      doc.moveDown(0.8);
    }

    // Bloco de assinatura: o contrato existe para ser assinado à mão.
    doc.moveDown(2);
    const larguraLinha = 220;
    const y = doc.y;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + larguraLinha, y).stroke();
    doc.fontSize(9).text('Colaborador', doc.page.margins.left, y + 4, { width: larguraLinha, align: 'center' });

    const xEmpresa = doc.page.width - doc.page.margins.right - larguraLinha;
    doc.moveTo(xEmpresa, y).lineTo(xEmpresa + larguraLinha, y).stroke();
    doc.fontSize(9).text('Empresa', xEmpresa, y + 4, { width: larguraLinha, align: 'center' });

    doc.end();
  });
}
