import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { hashSenha, validarForcaSenha } from '../lib/auth/password.ts';
import { reaisParaCentavos, type BaseDados, type Colaborador } from '../lib/store/tipos.ts';

/**
 * Carga inicial.
 *
 * Origem: "Planilha funcionários.xlsx". Lá, quem atua em mais de uma empresa
 * aparece repetido; aqui cada pessoa é UM registro com N vínculos.
 * 52 pessoas, 66 vínculos.
 *
 * Nascimento e data de contratação não constavam na planilha e ficam nulos.
 *
 * Rodar:  npm run seed
 */

const MS = 'Mentoria Scale';
const AI = 'Acelera Imob';
const MO = 'Mundo Ótico';

type V = { empresa: string; cargo: string; valor: number };
type P = { nome: string; vinculos: V[] };

const PESSOAS: P[] = [
  { nome: 'Homero', vinculos: [{ empresa: MS, cargo: 'SDR', valor: 2500 }] },
  { nome: 'Luiz Antônio - Tom', vinculos: [{ empresa: MS, cargo: 'SDR', valor: 2500 }] },
  { nome: 'João Henrique', vinculos: [{ empresa: MS, cargo: 'SDR', valor: 2000 }] },
  { nome: 'Joana', vinculos: [{ empresa: MS, cargo: 'FINANCEIRO', valor: 2000 }] },
  { nome: 'Leyla', vinculos: [{ empresa: MS, cargo: 'CONSULTOR DE SERVIÇOS', valor: 3500 }] },
  { nome: 'Otávio', vinculos: [{ empresa: MS, cargo: 'COO - CLOSER', valor: 4000 }] },
  { nome: 'Rui', vinculos: [{ empresa: AI, cargo: 'SDR', valor: 2200 }] },
  { nome: 'Fred', vinculos: [{ empresa: AI, cargo: 'CLOSER', valor: 3000 }] },
  {
    nome: 'Victor Paredes',
    vinculos: [
      { empresa: AI, cargo: 'Head', valor: 2500 },
      { empresa: MO, cargo: 'Head', valor: 2500 },
      { empresa: MS, cargo: 'Head', valor: 1500 },
    ],
  },
  { nome: 'Jean Lucca', vinculos: [{ empresa: MS, cargo: 'DESIGNER E EDITOR DE VÍDEO', valor: 3000 }] },
  { nome: 'João Cordeiro', vinculos: [{ empresa: AI, cargo: 'SDR', valor: 2300 }] },
  {
    nome: 'Gabriel Souza',
    vinculos: [
      { empresa: AI, cargo: 'GESTOR TRÁFEGO e ENGENHEIRO DE IA', valor: 1900 },
      { empresa: MO, cargo: 'GESTOR TRÁFEGO e ENGENHEIRO DE IA', valor: 1900 },
    ],
  },
  { nome: 'Gustavo Ferreira (Sombra)', vinculos: [{ empresa: MS, cargo: 'EDITOR DE VÍDEO', valor: 2000 }] },
  { nome: 'Pedro - Feijão', vinculos: [{ empresa: AI, cargo: 'SDR', valor: 1600 }] },
  { nome: 'Daniel Kern', vinculos: [{ empresa: MO, cargo: 'SDR', valor: 1800 }] },
  { nome: 'Davi Kern', vinculos: [{ empresa: AI, cargo: 'CONSULTOR DE SERVIÇOS', valor: 6000 }] },
  { nome: 'Hiury', vinculos: [{ empresa: MO, cargo: 'SDR', valor: 2000 }] },
  // Sem valor na planilha — entra zerado para ser preenchido depois.
  { nome: 'Growth', vinculos: [{ empresa: MS, cargo: 'EDITOR DE VÍDEO', valor: 0 }] },
  { nome: 'Gustavo LIMA Louco', vinculos: [{ empresa: MO, cargo: 'CLOSER', valor: 2500 }] },
  { nome: 'Osvaldo', vinculos: [{ empresa: AI, cargo: 'CLOSER', valor: 3000 }] },
  { nome: 'Lucas Joaquim', vinculos: [{ empresa: MO, cargo: 'CLOSER', valor: 3000 }] },
  { nome: 'Vinão', vinculos: [{ empresa: MS, cargo: 'CONSULTOR DE SERVIÇOS', valor: 3000 }] },
  { nome: 'MIguel', vinculos: [{ empresa: AI, cargo: 'GESTOR PROJETOS', valor: 2200 }] },
  { nome: 'Guilherme Souza', vinculos: [{ empresa: AI, cargo: 'GESTOR TRÁFEGO', valor: 0 }] },
  { nome: 'Felipe', vinculos: [{ empresa: AI, cargo: 'GESTOR TRÁFEGO', valor: 2000 }] },
  { nome: 'Samuel', vinculos: [{ empresa: AI, cargo: 'GESTOR PROJETOS', valor: 0 }] },
  { nome: 'Ellen', vinculos: [{ empresa: MO, cargo: 'GESTOR PROJETOS', valor: 2900 }] },
  // "Os Três" na planilha = as três empresas, mesmo valor em cada.
  {
    nome: 'Luiz',
    vinculos: [
      { empresa: MS, cargo: 'CFO', valor: 3000 },
      { empresa: AI, cargo: 'CFO', valor: 3000 },
      { empresa: MO, cargo: 'CFO', valor: 3000 },
    ],
  },
  { nome: 'Juliana Ata', vinculos: [{ empresa: MO, cargo: 'DESIGNER', valor: 2500 }] },
  {
    nome: 'Natalia',
    vinculos: [
      { empresa: MS, cargo: 'FINANCEIRO', valor: 1350 },
      { empresa: AI, cargo: 'FINANCEIRO', valor: 1350 },
      { empresa: MO, cargo: 'FINANCEIRO', valor: 1350 },
    ],
  },
  {
    nome: 'Vinicius G',
    vinculos: [
      { empresa: MS, cargo: 'FINANCEIRO', valor: 1100 },
      { empresa: AI, cargo: 'FINANCEIRO', valor: 1100 },
      { empresa: MO, cargo: 'FINANCEIRO', valor: 1100 },
    ],
  },
  { nome: 'Arthur Eufrásio', vinculos: [{ empresa: AI, cargo: 'GESTOR TRÁFEGO', valor: 2000 }] },
  { nome: 'Gabriel Óculos', vinculos: [{ empresa: MO, cargo: 'CONSULTOR DE SERVIÇOS', valor: 3500 }] },
  { nome: 'Gustavo Carmo', vinculos: [{ empresa: MO, cargo: 'CONSULTOR DE SERVIÇOS', valor: 3000 }] },
  { nome: 'Zilly', vinculos: [{ empresa: MO, cargo: 'GESTOR TRÁFEGO', valor: 2200 }] },
  { nome: 'Julia - Azafe', vinculos: [{ empresa: MO, cargo: 'GESTOR PROJETOS', valor: 2200 }] },
  { nome: 'Rafael Mendes (Líder)', vinculos: [{ empresa: AI, cargo: 'CONSULTOR DE SERVIÇOS', valor: 3000 }] },
  { nome: 'Kelvin', vinculos: [{ empresa: AI, cargo: 'GESTOR TRÁFEGO', valor: 2300 }] },
  { nome: 'Vitor', vinculos: [{ empresa: MO, cargo: 'GESTOR TRÁFEGO', valor: 2000 }] },
  { nome: 'Matteus (GT)', vinculos: [{ empresa: MO, cargo: 'GESTOR TRÁFEGO', valor: 2500 }] },
  { nome: 'Gustavo Fernandes', vinculos: [{ empresa: MS, cargo: 'CONSULTOR DE SERVIÇOS', valor: 4000 }] },
  {
    nome: 'Erick',
    vinculos: [
      { empresa: MS, cargo: 'JURÍDICO', valor: 5000 },
      { empresa: AI, cargo: 'JURÍDICO', valor: 5000 },
      { empresa: MO, cargo: 'JURÍDICO', valor: 5000 },
    ],
  },
  { nome: 'Lucas Rosendo', vinculos: [{ empresa: MS, cargo: 'HEAD GESTOR TRÁFEGO', valor: 6000 }] },
  { nome: 'Henri', vinculos: [{ empresa: MS, cargo: 'DESIGNER', valor: 2000 }] },
  { nome: 'Breno', vinculos: [{ empresa: MS, cargo: 'CONSULTOR DE SERVIÇOS', valor: 2700 }] },
  {
    nome: 'Lucas Fernandes',
    vinculos: [
      { empresa: MS, cargo: 'DESIGNER', valor: 3000 },
      { empresa: AI, cargo: 'DESIGNER', valor: 1500 },
    ],
  },
  { nome: 'Luiz Philippe Hagashi', vinculos: [{ empresa: MO, cargo: 'GESTOR TRÁFEGO', valor: 0 }] },
  {
    nome: 'Kamila',
    vinculos: [
      { empresa: AI, cargo: 'EDITORA DE VÍDEO', valor: 1250 },
      { empresa: MO, cargo: 'EDITORA DE VÍDEO', valor: 1250 },
    ],
  },
  {
    nome: 'Liz',
    vinculos: [
      { empresa: AI, cargo: 'AUXILIAR ADMINISTRATIVO', valor: 1250 },
      { empresa: MO, cargo: 'AUXILIAR ADMINISTRATIVO', valor: 1250 },
    ],
  },
  { nome: 'Daiana Machado', vinculos: [{ empresa: MO, cargo: 'EDITORA DE VÍDEO', valor: 2000 }] },
  // Cargo não informado na planilha.
  { nome: 'Lucas Silva', vinculos: [{ empresa: MO, cargo: '-', valor: 2500 }] },
  { nome: 'Lucas de Abreu', vinculos: [{ empresa: MO, cargo: 'DESIGNER', valor: 1500 }] },
];

async function main() {
  const emailAdmin = process.env.SEED_ADMIN_EMAIL;
  const senhaAdmin = process.env.SEED_ADMIN_SENHA;

  if (!emailAdmin || !senhaAdmin) {
    throw new Error(
      'Defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA antes de rodar.\n' +
        'PowerShell:\n' +
        '  $env:SEED_ADMIN_EMAIL="voce@empresa.com"; $env:SEED_ADMIN_SENHA="UmaSenhaForte123"; npm run seed',
    );
  }

  const problema = validarForcaSenha(senhaAdmin);
  if (problema) throw new Error(`Senha do admin recusada: ${problema}`);

  const agora = new Date().toISOString();

  const empresas = [
    { id: randomUUID(), nome: MS, cor: '#16A891' },
    { id: randomUUID(), nome: AI, cor: '#2F6F9E' },
    { id: randomUUID(), nome: MO, cor: '#9C6A2E' },
  ];
  const idPorNome = new Map(empresas.map((e) => [e.nome, e.id]));

  const colaboradores: Colaborador[] = PESSOAS.map((p) => ({
    id: randomUUID(),
    nome: p.nome,
    nascimento: null,
    dataContratacao: null,
    vinculos: p.vinculos.map((v) => {
      const empresaId = idPorNome.get(v.empresa);
      if (!empresaId) throw new Error(`Empresa desconhecida: ${v.empresa}`);
      return {
        id: randomUUID(),
        empresaId,
        cargo: v.cargo,
        valorFixoCentavos: reaisParaCentavos(v.valor),
        ativo: true,
      };
    }),
    ativo: true,
    desligadoEm: null,
    contrato: null,
    avaliacoes: [],
    criadoEm: agora,
    atualizadoEm: agora,
  }));

  const base: BaseDados = {
    versao: 1,
    empresas,
    usuarios: [
      {
        id: randomUUID(),
        email: emailAdmin.toLowerCase().trim(),
        senhaHash: await hashSenha(senhaAdmin),
        nome: 'Administrador',
        papel: 'admin',
        ativo: true,
        empresaIds: [],
        mfaSecret: null,
        trocarSenha: true,
        ultimoLoginEm: null,
        criadoEm: agora,
      },
    ],
    colaboradores,
  };

  // Escreve direto no disco local. Em produção, o mesmo JSON é enviado ao
  // Vercel Blob pela própria aplicação na primeira execução.
  const destino = path.join(process.cwd(), '.data', 'dados', 'base.json');

  try {
    await fs.access(destino);
    throw new Error(
      `${destino} já existe. Apague-o antes de rodar o seed de novo — ' +
      'rodar por cima apagaria dados já cadastrados.`,
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('já existe')) throw e;
  }

  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, JSON.stringify(base, null, 2), 'utf8');

  const totalVinculos = colaboradores.reduce((a, c) => a + c.vinculos.length, 0);
  const folha = colaboradores
    .flatMap((c) => c.vinculos)
    .reduce((a, v) => a + v.valorFixoCentavos, 0);

  console.log(`✓ Base criada em ${destino}`);
  console.log(`  ${empresas.length} empresas`);
  console.log(`  ${colaboradores.length} pessoas`);
  console.log(`  ${totalVinculos} vínculos`);
  console.log(`  folha fixa: ${(folha / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
  console.log(`  admin: ${base.usuarios[0].email}`);
}

main().catch((e) => {
  console.error('\n✗ Seed falhou:', e.message);
  process.exit(1);
});
