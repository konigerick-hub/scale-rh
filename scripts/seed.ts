import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { empresas, usuarios, colaboradores, vinculos } from '../lib/db/schema';
import { hashSenha, validarForcaSenha } from '../lib/auth/password';

/**
 * Carga inicial.
 *
 * Origem: "Planilha funcionários.xlsx". Lá, quem atua em mais de uma empresa
 * aparece repetido; aqui cada pessoa é UMA linha em `colaboradores`, com N
 * linhas em `vinculos`. 52 pessoas, 66 vínculos.
 *
 * Nascimento e data de contratação não constavam na planilha e ficam nulos.
 *
 * Rodar:  npm run db:seed
 */

const MS = 'Mentoria Scale';
const AI = 'Acelera Imob';
const MO = 'Mundo Ótico';

const EMPRESAS = [
  { nome: MS, cor: '#16A891' },
  { nome: AI, cor: '#2F6F9E' },
  { nome: MO, cor: '#9C6A2E' },
];

type Vinculo = { empresa: string; cargo: string; valor: number };
type Pessoa = { nome: string; vinculos: Vinculo[] };

const PESSOAS: Pessoa[] = [
  { nome: 'Homero', vinculos: [{ empresa: MS, cargo: 'SDR', valor: 2500 }] },
  { nome: 'Luiz Antônio - Tom', vinculos: [{ empresa: MS, cargo: 'SDR', valor: 2500 }] },
  { nome: 'João Henrique', vinculos: [{ empresa: MS, cargo: 'SDR', valor: 2000 }] },
  { nome: 'Joana', vinculos: [{ empresa: MS, cargo: 'FINANCEIRO', valor: 2000 }] },
  { nome: 'Leyla', vinculos: [{ empresa: MS, cargo: 'CONSULTOR DE SERVIÇOS', valor: 3500 }] },
  { nome: 'Otávio', vinculos: [{ empresa: MS, cargo: 'COO - CLOSER', valor: 4000 }] },
  { nome: 'Rui', vinculos: [{ empresa: AI, cargo: 'SDR', valor: 2200 }] },
  { nome: 'Fred', vinculos: [{ empresa: AI, cargo: 'CLOSER', valor: 3000 }] },

  // Atua nas três empresas com valores distintos.
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

  // Sem valor na planilha — entra como 0 para ser preenchido depois.
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

  // "Os Três" na planilha = as três empresas, com o mesmo valor em cada.
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
      'Defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA no ambiente antes de rodar o seed.\n' +
        'Exemplo (PowerShell):\n' +
        '  $env:SEED_ADMIN_EMAIL="voce@empresa.com"; $env:SEED_ADMIN_SENHA="UmaSenhaForte123"; npm run db:seed',
    );
  }

  const problema = validarForcaSenha(senhaAdmin);
  if (problema) throw new Error(`Senha do admin recusada: ${problema}`);

  console.log('→ Empresas');
  const mapaEmpresa = new Map<string, string>();
  for (const e of EMPRESAS) {
    const [existente] = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(eq(empresas.nome, e.nome))
      .limit(1);

    if (existente) {
      mapaEmpresa.set(e.nome, existente.id);
    } else {
      const [nova] = await db.insert(empresas).values(e).returning({ id: empresas.id });
      mapaEmpresa.set(e.nome, nova.id);
    }
  }
  console.log(`  ${mapaEmpresa.size} empresas`);

  console.log('→ Usuário admin');
  const email = emailAdmin.toLowerCase().trim();
  const [jaExiste] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);

  if (jaExiste) {
    console.log('  já existe, mantido como está');
  } else {
    await db.insert(usuarios).values({
      email,
      senhaHash: await hashSenha(senhaAdmin),
      nome: 'Administrador',
      papel: 'admin',
      trocarSenha: true,
    });
    console.log(`  criado: ${email}`);
  }

  console.log('→ Colaboradores e vínculos');
  let pessoasCriadas = 0;
  let vinculosCriados = 0;

  for (const pessoa of PESSOAS) {
    const [existente] = await db
      .select({ id: colaboradores.id })
      .from(colaboradores)
      .where(eq(colaboradores.nome, pessoa.nome))
      .limit(1);

    if (existente) continue;

    const [nova] = await db
      .insert(colaboradores)
      .values({ nome: pessoa.nome })
      .returning({ id: colaboradores.id });
    pessoasCriadas++;

    for (const v of pessoa.vinculos) {
      const empresaId = mapaEmpresa.get(v.empresa);
      if (!empresaId) throw new Error(`Empresa desconhecida: ${v.empresa}`);
      await db.insert(vinculos).values({
        colaboradorId: nova.id,
        empresaId,
        cargo: v.cargo,
        valorFixo: v.valor.toFixed(2),
      });
      vinculosCriados++;
    }
  }

  const totalVinculos = PESSOAS.reduce((a, p) => a + p.vinculos.length, 0);
  console.log(`  ${pessoasCriadas} pessoas, ${vinculosCriados} vínculos`);
  console.log(`\n✓ Seed concluído. Esperado na planilha: ${PESSOAS.length} pessoas / ${totalVinculos} vínculos.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('\n✗ Seed falhou:', e.message);
  process.exit(1);
});
