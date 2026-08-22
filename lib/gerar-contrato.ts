import 'server-only';
import PDFDocument from 'pdfkit';
import type { Colaborador, DadosCliente, Empresa, Vinculo } from '@/lib/store/tipos';

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

/* ---- Valor por extenso: contratos costumam exigir a forma escrita ---- */

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto >= 10 && resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
  else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d > 0) partes.push(DEZENAS[d]);
    if (u > 0) partes.push(UNIDADES[u]);
  }
  return partes.join(' e ');
}

export function reaisPorExtenso(centavos: number): string {
  const reais = Math.floor(centavos / 100);
  const cents = centavos % 100;
  const partes: string[] = [];

  if (reais === 0) partes.push('zero reais');
  else {
    const milhares = Math.floor(reais / 1000);
    const resto = reais % 1000;
    const blocos: string[] = [];
    if (milhares === 1) blocos.push('mil');
    else if (milhares > 1) blocos.push(`${ate999(milhares)} mil`);
    if (resto > 0) blocos.push(ate999(resto));
    // "mil e quinhentos" soa certo; "mil e duzentos e cinquenta" não —
    // o "e" só entra quando o resto é menor que cem ou múltiplo de cem.
    const juntar = milhares > 0 && resto > 0 && (resto < 100 || resto % 100 === 0) ? ' e ' : ' ';
    const texto = blocos.join(juntar);
    partes.push(`${texto} ${reais === 1 ? 'real' : 'reais'}`);
  }

  if (cents > 0) {
    partes.push(`${ate999(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`);
  }
  return partes.join(' e ');
}

export function preencherModelo(
  conteudo: string,
  colaborador: Colaborador,
  vinculo: Vinculo,
  empresa: Empresa,
): string {
  const doc = colaborador.documentos;
  const valores: Record<string, string> = {
    // Contratada — o MEI
    meiRazaoSocial: ouLacuna(doc?.meiRazaoSocial, 30),
    meiCnpj: ouLacuna(doc?.meiCnpj, 18),
    meiEndereco: ouLacuna(doc?.meiEndereco, 40),

    // Titular do MEI
    nome: ouLacuna(colaborador.nome, 30),
    cpf: ouLacuna(doc?.cpf, 14),
    rg: ouLacuna(doc?.rg, 12),
    nacionalidade: ouLacuna(doc?.nacionalidade, 15),
    estadoCivil: ouLacuna(doc?.estadoCivil, 15),
    endereco: ouLacuna(doc?.endereco, 40),
    telefone: ouLacuna(doc?.telefone, 16),
    email: ouLacuna(doc?.email, 24),
    nascimento: dataBR(colaborador.nascimento),

    // Contratante — empresa do grupo
    empresa: empresa.nome,
    empresaRazaoSocial: ouLacuna(empresa.razaoSocial ?? empresa.nome, 30),
    empresaCnpj: ouLacuna(empresa.cnpj, 18),
    empresaEndereco: ouLacuna(empresa.endereco, 40),
    empresaRepresentante: ouLacuna(empresa.representante, 30),
    empresaRepresentanteCpf: ouLacuna(empresa.representanteCpf, 14),

    // Objeto do contrato
    servico: ouLacuna(vinculo.cargo, 20),
    valorMensal: brl.format(vinculo.valorFixoCentavos / 100),
    valorExtenso: reaisPorExtenso(vinculo.valorFixoCentavos),
    inicio: dataBR(colaborador.dataContratacao),
    hoje: porExtenso(new Date()),
  };

  // Campos personalizados entram junto, sem prioridade sobre os fixos.
  for (const [chave, valor] of Object.entries(doc?.extras ?? {})) {
    if (!(chave in valores)) valores[chave] = ouLacuna(valor, 20);
  }

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

/** Preenche o modelo comercial com os dados do cliente e da empresa. */
export function preencherModeloComercial(
  conteudo: string,
  cliente: DadosCliente,
  empresa: Empresa,
  vendedor: string,
): string {
  const valores: Record<string, string> = {
    clienteRazaoSocial: ouLacuna(cliente.razaoSocial, 30),
    clienteDocumento: ouLacuna(cliente.documento, 18),
    clienteEndereco: ouLacuna(cliente.endereco, 40),
    clienteRepresentante: ouLacuna(cliente.representante, 30),
    clienteRepresentanteCpf: ouLacuna(cliente.representanteCpf, 14),
    clienteEmail: ouLacuna(cliente.email, 24),
    clienteTelefone: ouLacuna(cliente.telefone, 16),

    objeto: ouLacuna(cliente.objeto, 40),
    valor: brl.format(cliente.valorCentavos / 100),
    valorExtenso: reaisPorExtenso(cliente.valorCentavos),
    formaPagamento: ouLacuna(cliente.formaPagamento, 30),
    vigencia: ouLacuna(cliente.vigencia, 20),

    empresa: empresa.nome,
    empresaRazaoSocial: ouLacuna(empresa.razaoSocial ?? empresa.nome, 30),
    empresaCnpj: ouLacuna(empresa.cnpj, 18),
    empresaEndereco: ouLacuna(empresa.endereco, 40),
    empresaRepresentante: ouLacuna(empresa.representante, 30),
    empresaRepresentanteCpf: ouLacuna(empresa.representanteCpf, 14),

    vendedor: ouLacuna(vendedor, 25),
    hoje: porExtenso(new Date()),
  };

  for (const [chave, valor] of Object.entries(cliente.extras ?? {})) {
    if (!(chave in valores)) valores[chave] = ouLacuna(valor, 20);
  }

  return conteudo.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (bruto, chave) =>
    chave in valores ? valores[chave] : bruto,
  );
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
