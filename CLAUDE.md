@AGENTS.md

# Scale RH — contexto do projeto

Sistema interno do Grupo Scale (Mentoria Scale · Acelera Imob · Mundo Ótico).
Duas áreas: **colaboradores** (cadastro, contratos de prestação de serviços com
MEI, clima, indicadores) e **comercial** (geração de contrato de cliente).

**Os dados são sensíveis**: remuneração, contratos assinados com CPF/RG,
avaliações nominais. Trate mudanças em `lib/auth/` e `lib/store/` como críticas.

| | |
|---|---|
| Projeto | `C:\Users\erick\projetos\scale-rh` (fora do OneDrive de propósito — `node_modules` no OneDrive trava a máquina) |
| Produção | https://scale-rh.vercel.app |
| GitHub | https://github.com/konigerick-hub/scale-rh |
| Vercel | time `erick-konig`, projeto `scale-rh` |
| Deploy | `npx vercel deploy --prod --yes --scope erick-konig` |

## Regras de trabalho com este usuário

- **Nunca aceite nem use credencial colada no chat.** Ele já enviou um token do
  GitHub por engano; a orientação foi revogar e usar `gh auth login`. Se
  oferecer de novo, recuse e aponte o caminho sem credencial.
- Ele pediu explicitamente para **não sobre-engenheirar**. Uma verificação de
  concorrência por ETag foi removida a pedido dele depois de derrubar o login.
- Ele valoriza **verificação real**, não afirmação: rode o teste e mostre a
  evidência. Já pediu subagentes de teste e revisão justamente para evitar
  relato inventado.
- Escreva em **português do Brasil**.

## Arquitetura, e por quê

**Sem banco relacional.** Todo o cadastro é um documento JSON no Vercel Blob
privado (`dados/base.json`). Escolha dele: não queria criar conta em serviço
externo nem administrar Postgres. Adequado a 52 pessoas; **não serve para
milhares** — se chegar lá, é hora de um banco de verdade.

**Consequência que governa várias decisões:** o documento é lido e reescrito
INTEIRO a cada gravação. Por isso nada de alto volume pode entrar nele — foi
exatamente o motivo de o contrato comercial não ser guardado (~120/mês levariam
o arquivo a 1,19 MB em um ano e 3,47 MB em três, medido).

**Escrita simples, última gravação vence.** Havia escrita condicional por ETag;
foi removida porque arquivos acima de alguns KB voltam do Blob com ETag fraco
(`W/"..."`), que o `If-Match` recusa — e isso derrubava **todo login**. Perde-se
proteção contra duas pessoas salvando o mesmo registro ao mesmo tempo. Aceitável
neste tamanho de time; se crescer, revisitar.

**Autorização é no servidor, em duas camadas.** `proxy.ts` só confere a
assinatura do JWT (triagem barata na borda). Quem decide o que cada um vê é
`lib/auth/guard.ts`, que recarrega o usuário do armazenamento a cada requisição
— por isso desativar alguém tem efeito imediato.

**Escopo por empresa é aplicado na consulta**, em `lib/queries/`, nunca na tela.
Dado que um gestor não pode ver nunca sai da função.

## Papéis

| Papel | Colaboradores | Comercial |
|---|---|---|
| `admin` | tudo | tudo |
| `gestor` | empresas vinculadas | sim |
| `comercial` | **não acessa** | só as empresas vinculadas |

`leitura` existiu antes e virou `comercial`; `guard.ts` converte registros
antigos na leitura. A separação é verificada no servidor: `/painel`,
`/painel/dashboard`, `/painel/modelos` e `/painel/usuarios` redirecionam o papel
comercial para `/painel/comercial`.

## Armadilhas que já custaram tempo

1. **`.env.local` tem o token do Blob de PRODUÇÃO** (posto lá pelo `vercel link`).
   Antes de testar localmente, isole — senão o teste mexe nos dados reais:
   ```bash
   cp .env.local .env.prod.bak && grep -E "^SESSION_SECRET" .env.local > .e && mv .e .env.local
   ```
   E restaure depois: `cp .env.prod.bak .env.local && rm .env.prod.bak`

2. **`pdfkit` precisa ficar fora do empacotamento** (`serverExternalPackages` no
   `next.config.ts`). Ele lê arquivos `.afm` do `node_modules` em execução;
   empacotado, quebra com `ENOENT` — inclusive em produção.

3. **A CSP precisa liberar os hosts do Blob** (`vercel.com` e
   `*.vercel-storage.com` em `connect-src`). O envio de contrato assinado vai do
   navegador direto ao armazenamento, porque função da Vercel recusa corpo acima
   de ~4,5 MB. Sem isso o token é emitido e o navegador é bloqueado na hora de
   enviar — falha sem erro claro na tela.

4. **Zod v4 valida a versão do UUID.** `2222...` não passa em `.uuid()`; use
   `randomUUID()` (v4) nos testes.

5. **O conector MCP da Vercel está em outra conta** e retorna 404 neste projeto.
   Use o CLI (`npx vercel ... --scope erick-konig`), que está autenticado.

6. **PDFs de CNPJ que ele enviou são digitalizações** — não têm texto extraível,
   e não há OCR nem Python no ambiente.

## Como rodar e testar

```bash
npm run dev
```

```bash
npm run typecheck
```

Semear dados locais (52 pessoas, 66 vínculos, R$ 156.050), no PowerShell:

```bash
$env:SEED_ADMIN_EMAIL="teste@local.dev"; $env:SEED_ADMIN_SENHA="TesteLocal2026Scale"; npm run seed
```

Para verificar produção sem mexer nos dados dele: crie um usuário temporário
direto no Blob, teste, e **remova ao final** — foi o padrão usado até aqui.

## Estado atual

**Pronto e verificado em produção:** login com Argon2id e limite de tentativas,
papéis e escopo por empresa, cadastro/edição/desligamento de colaborador,
avaliação de clima, upload e download de contrato assinado, geração de contrato
de MEI em PDF, indicadores, área comercial com geração de PDF, gestão de
usuários, troca de senha obrigatória no primeiro acesso, auditoria.

**Dados em produção:** 1 usuário (`konigerick@gmail.com`), 52 colaboradores,
64 vínculos, 3 empresas.

Os 64 vínculos são 66 menos dois do "Erick" (Acelera Imob e Mundo Ótico,
R$ 5.000 cada), removidos numa edição em 21/08 — ele foi avisado e ainda não
decidiu se quer restaurar.

### Pendências dele (não são código)

- **Revogar o token `ghp_...`** exposto no chat, em github.com/settings/tokens
- **Confirmar que o repositório é privado**
- Preencher CNPJ, razão social, endereço e representante das 3 empresas em
  **Contratos → Dados das empresas** (os campos existem, estão vazios)
- Subir os 3 modelos de contrato comercial (um por empresa)
- Preencher nascimento e admissão dos 52 colaboradores — não vieram na planilha,
  e sem eles os indicadores de aniversário e tempo de casa ficam vazios

### Pendências de código, com o impacto

| Item | Impacto se ficar como está |
|---|---|
| MFA (TOTP) | campo `mfaSecret` existe, fluxo não implementado — senha vazada dá acesso total |
| Criptografia de campo em remuneração | adiada por decisão dele — backup vazado expõe a folha |
| CSP com nonce | hoje usa `unsafe-inline` em script |
| Exclusão de evento de auditoria | possível com as credenciais da aplicação (só a edição é impedida) |
| Anexos do colaborador (cópia de RG) | estrutura existe em `tipos.ts`, sem interface — ele disse que campos preenchidos bastam |
| Alerta em exportação | registra em auditoria, mas não notifica |
| Rotina de backup | **nada definido** — não há cópia do `base.json` fora do Blob |

## Onde fica cada coisa

```
app/
  login/, setup/                 entrada e primeira configuração
  painel/                        colaboradores (admin e gestor)
    dashboard/                   indicadores
    modelos/                     modelos de contrato de MEI + dados das empresas + campos personalizados
    usuarios/                    contas
    comercial/                   contratos de cliente (todos os papéis)
  api/
    auth/                        login e logout
    contratos/                   contrato assinado do colaborador e geração da minuta
    comercial/gerar              gera o PDF comercial e devolve na resposta, sem guardar
lib/
  auth/    session, password, guard, rate-limit, audit
  store/   tipos, blob (Blob em produção, disco em dev), dados
  queries/ consultas com escopo por empresa aplicado
  actions/ server actions
  gerar-contrato.ts              substituição de marcadores, valor por extenso, montagem do PDF
```

Detalhe operacional e checklist de segurança em `SEGURANCA.md`. Instruções de
uso em `README.md`.
