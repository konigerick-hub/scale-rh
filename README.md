# Scale RH — Painel de Colaboradores

Sistema interno do Grupo Scale (Mentoria Scale · Acelera Imob · Mundo Ótico) para
cadastro de colaboradores, contratos assinados, remuneração e clima cultural.

**Os dados são sensíveis** (salários, contratos com CPF/RG, avaliações nominais).
Leia `SEGURANCA.md` antes de mexer na camada de autenticação ou autorização.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| App | Next.js 16 (App Router) na Vercel | Front e API no mesmo deploy |
| Banco | Postgres gerenciado + Drizzle | Sem servidor pra administrar |
| Auth | Próprio: Argon2id + JWT em cookie | Sem dependência de API externa |
| Rate limit | Postgres | Memória não funciona em serverless |
| PDFs | Storage privado + URL assinada | Nunca em bucket público |

## Rodando localmente

**1. Variáveis de ambiente**

```bash
cp .env.example .env.local
```

Gere o segredo da sessão e cole em `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

**2. Banco**

Aponte `DATABASE_URL` para um Postgres. Para desenvolvimento local com Docker:

```bash
docker run -d --name scale-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
```

Nesse caso use `DATABASE_URL="postgresql://postgres:dev@localhost:5432/postgres"`
e `DATABASE_SSL="disable"` (Postgres local não tem TLS).

**3. Migrações**

```bash
npm run db:migrate
```

**4. Carga inicial** — 3 empresas, 52 colaboradores, 66 vínculos e o usuário admin.
No PowerShell:

```bash
$env:SEED_ADMIN_EMAIL="voce@empresa.com"; $env:SEED_ADMIN_SENHA="UmaSenhaForte123"; npm run db:seed
```

**5. Subir**

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
npm run db:generate
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

## Modelo de dados

Uma pessoa que atua em mais de uma empresa é **uma** linha em `colaboradores`
com **N** linhas em `vinculos` — cada uma com sua empresa, cargo e valor:

```
colaboradores (52)  ──<  vinculos (66)  >──  empresas (3)
```

Victor Paredes, Luiz, Natalia, Vinicius G, Erick, Gabriel Souza, Lucas Fernandes,
Kamila e Liz têm mais de um vínculo. Editar o nome de qualquer um deles muda em
um lugar só.

## Papéis

| Papel | Vê | Edita | Contratos | Exporta |
|---|---|---|---|---|
| `admin` | tudo | sim | sim | sim |
| `gestor` | só suas empresas | sim | não | não |
| `leitura` | só suas empresas | não | não | não |

O escopo por empresa é aplicado **na consulta SQL** (`lib/queries/`), não na tela.

## Estrutura

```
app/
  login/              tela de login
  painel/             lista de colaboradores
  api/auth/           login e logout
lib/
  auth/
    session.ts        JWT (Edge-safe — não importa banco nem argon2)
    password.ts       Argon2id (Node runtime apenas)
    guard.ts          autorização de verdade: revalida no banco
    rate-limit.ts     limite de tentativas via Postgres
    audit.ts          registro de auditoria
  db/schema.ts        tabelas
  queries/            consultas com escopo por empresa aplicado no SQL
proxy.ts              triagem na borda (não é a autorização)
drizzle/              migrações versionadas
```

## Deploy na Vercel

1. Suba o repositório no GitHub — **privado**
2. Importe na Vercel
3. Configure as variáveis do `.env.example` no painel da Vercel
4. Rode as migrações apontando para o banco de produção

Antes de considerar em produção, percorra o checklist em `SEGURANCA.md`.
