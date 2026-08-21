import 'server-only';
import { createHash } from 'node:crypto';
import { lerTexto, escreverTexto } from '@/lib/store/blob';

/**
 * Limite de tentativas de login.
 *
 * Contador em memória não funciona: cada requisição na Vercel pode rodar num
 * processo novo, então o contador zeraria e o limite nunca seria atingido.
 * O estado precisa ser compartilhado — aqui, um arquivo por chave.
 */

const JANELA_MS = 15 * 60_000;
const MAX_POR_EMAIL = 5;
const MAX_POR_IP = 20; // mais folgado: um escritório inteiro sai pelo mesmo IP

export type Bloqueio =
  | { bloqueado: true; esperarSegundos: number }
  | { bloqueado: false };

type Registro = { falhas: number[] };

/**
 * O nome do arquivo é o hash da chave, não a chave em si.
 *
 * Dois motivos: e-mail e IP em nome de arquivo apareceriam na listagem do
 * armazenamento, entregando quais contas existem a quem tivesse acesso de
 * leitura; e um IPv6 como `::1` contém `:`, que é inválido em nome de arquivo
 * no Windows. O hash resolve os dois de uma vez.
 */
function chaveArquivo(bruta: string): string {
  const h = createHash('sha256').update(bruta).digest('hex').slice(0, 32);
  return `tentativas/${h}.json`;
}

async function lerFalhasRecentes(bruta: string): Promise<number[]> {
  const lido = await lerTexto(chaveArquivo(bruta));
  if (!lido) return [];
  try {
    const reg = JSON.parse(lido.conteudo) as Registro;
    const corte = Date.now() - JANELA_MS;
    return (reg.falhas ?? []).filter((t) => t > corte);
  } catch {
    return [];
  }
}

export async function verificarBloqueio(email: string, ip: string): Promise<Bloqueio> {
  const [porEmail, porIp] = await Promise.all([
    lerFalhasRecentes(`email:${email}`),
    lerFalhasRecentes(`ip:${ip}`),
  ]);

  if (porEmail.length >= MAX_POR_EMAIL || porIp.length >= MAX_POR_IP) {
    const maisAntiga = Math.min(
      ...(porEmail.length >= MAX_POR_EMAIL ? porEmail : porIp),
    );
    const esperar = Math.ceil((maisAntiga + JANELA_MS - Date.now()) / 1000);
    return { bloqueado: true, esperarSegundos: Math.max(esperar, 1) };
  }
  return { bloqueado: false };
}

async function registrarUma(bruta: string, sucesso: boolean): Promise<void> {
  const chave = chaveArquivo(bruta);

  if (sucesso) {
    // Login correto limpa o histórico: quem lembrou a senha não deve continuar
    // acumulando penalidade das tentativas anteriores.
    await escreverTexto(chave, JSON.stringify({ falhas: [] } satisfies Registro));
    return;
  }

  const corte = Date.now() - JANELA_MS;
  const lido = await lerTexto(chave);
  let falhas: number[] = [];
  if (lido) {
    try {
      falhas = ((JSON.parse(lido.conteudo) as Registro).falhas ?? []).filter((t) => t > corte);
    } catch {
      falhas = [];
    }
  }
  falhas.push(Date.now());

  await escreverTexto(chave, JSON.stringify({ falhas } satisfies Registro));
}

export async function registrarTentativa(
  email: string,
  ip: string,
  sucesso: boolean,
): Promise<void> {
  await Promise.all([
    registrarUma(`email:${email}`, sucesso),
    registrarUma(`ip:${ip}`, sucesso),
  ]);
}
