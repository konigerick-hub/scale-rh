# Scale RH — Painel de Colaboradores

Sistema interno do Grupo Scale (Mentoria Scale · Acelera Imob · Mundo Ótico) para
cadastro de colaboradores, contratos assinados, remuneração e clima cultural.

**Os dados são sensíveis** — salários, contratos com CPF/RG, avaliações nominais.
Leia `SEGURANCA.md` antes de mexer em `lib/auth/` ou `lib/store/`.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| App | Next.js 16 (App Router) na Vercel | Front e API no mesmo deploy |
| Dados | Vercel Blob (privado), JSON | Sem conta nova, sem banco para administrar |
| Auth | Próprio: Argon2id + JWT em cookie | Sem dependência de serviço externo |
| Limite de tentativas | Arquivo por chave | Memória não funciona em serverless |

**Não há banco relacional.** O cadastro inteiro é um documento JSON carregado em
memória — adequado a 52 pessoas e 66 vínculos, inadequado a milhares. Se o
volume crescer muito, ou se auditoria inviolável virar exigência formal, é hora
de reconsiderar um banco de verdade (ver `SEGURANCA.md`).

## Rodando localmente

Não precisa de banco, conta ou container. Os dados vão para `.data/` no projeto.

**1. Segredo da sessão**

```bash
cp .env.example .env.local
```

Gere e cole em `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

**2. Carga inicial** — 3 empresas, 52 pessoas, 66 vínculos e o usuário admin.
No PowerShell:

```bash
$env:SEED_ADMIN_EMAIL="voce@empresa.com"; $env:SEED_ADMIN_SENHA="UmaSenhaForte123"; npm run seed
```

**3. Subir**

```bash
npm run dev
```

## Comandos

```bash
npm run dev
```

```bash
npm run typecheck
```

```bash
npm run seed
```

## Modelo de dados

Quem atua em mais de uma empresa é **um** registro com **N** vínculos, cada um
com sua empresa, cargo e valor:

```
colaboradores (52)  ──<  vinculos (66)  >──  empresas (3)
```

Victor Paredes, Luiz, Natalia, Vinicius G, Erick, Gabriel Souza, Lucas Fernandes,
Kamila e Liz têm mais de um vínculo. Corrigir o nome de qualquer um muda em um
lugar só.

Valores monetários são guardados **em centavos** (inteiro), para não acumular
erro de arredondamento de ponto flutuante.

## Papéis

| Papel | Vê | Edita | Contratos | Exporta |
|---|---|---|---|---|
| `admin` | tudo | sim | sim | sim |
| `gestor` | só suas empresas | sim | não | não |
| `leitura` | só suas empresas | não | não | não |

O escopo por empresa é aplicado em `lib/queries/`, ao montar o resultado — nunca
na tela.

## Estrutura

```
app/
  login/              tela de login
  painel/             lista de colaboradores
  api/auth/           login e logout
lib/
  auth/
    session.ts        JWT (Edge-safe — não importa armazenamento nem argon2)
    password.ts       Argon2id (Node runtime apenas)
    guard.ts          autorização de verdade: revalida a cada requisição
    rate-limit.ts     limite de tentativas de login
    audit.ts          registro de auditoria (um arquivo imutável por evento)
  store/
    tipos.ts          formato dos dados
    blob.ts           Vercel Blob em produção, disco local no dev
    dados.ts          carga e alteração com controle de concorrência
  queries/            consultas com escopo por empresa aplicado
proxy.ts              triagem na borda (não é a autorização)
.data/                dados locais de dev — nunca versionado
```

## Deploy na Vercel

1. Suba o repositório no GitHub — **privado**
2. Importe o projeto na Vercel
3. No painel da Vercel, crie um **Blob Store em modo privado** e conecte ao projeto
   — a Vercel injeta as credenciais sozinha e as rotaciona
4. Adicione `SESSION_SECRET` nas variáveis de ambiente (um valor novo, não o do dev)
5. Faça o primeiro acesso e cadastre os dados, ou envie o `base.json` gerado pelo seed

Antes de considerar em produção, percorra o checklist em `SEGURANCA.md`.
