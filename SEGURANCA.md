# Segurança — Scale RH

Este sistema guarda salários, contratos assinados (CPF, RG, endereço, assinatura)
e avaliações nominais de desempenho. Trate qualquer mudança em `lib/auth/` como
mudança crítica.

## Princípios que o código segue

**1. O proxy não autoriza, só faz triagem.**
`proxy.ts` confere a assinatura do JWT na borda — é barato e barra ruído. A
autorização real está em `lib/auth/guard.ts`, que recarrega o usuário do banco a
cada requisição. Por isso desativar um usuário tem efeito imediato, sem esperar
o token de 4h expirar.

**2. Escopo é aplicado no SQL, nunca na tela.**
Filtrar no componente significa que o dado já saiu do banco e trafegou. Em
`lib/queries/`, a empresa que um gestor não pode ver nunca chega a existir na
memória do processo. Gestor sem empresa vinculada recebe lista vazia — nunca a
lista completa.

**3. Auditoria é append-only no banco.**
A migração `0001` revoga UPDATE e DELETE de `audit_log` do usuário da aplicação
e instala uma trigger que barra até o dono da tabela. Quem comprometer a
aplicação não apaga o próprio rastro.

**4. Login não revela quais contas existem.**
Mesma mensagem para e-mail inexistente e senha errada, e `gastarTempoConstante()`
gasta tempo comparável quando o usuário não existe — sem isso, a diferença de
latência entrega a lista de e-mails válidos.

**5. Rate limit vive no Postgres.**
Contador em memória zera a cada invocação em serverless. 5 tentativas por e-mail
e 20 por IP, em janela de 15 minutos.

## Pré-requisito de deploy: usuário do banco sem privilégio

A garantia de auditoria append-only **só funciona** se a aplicação conectar com
um usuário que não seja dono da tabela nem superusuário:

```sql
CREATE ROLE scale_app LOGIN PASSWORD 'senha-forte';
```

Rode as migrações com o usuário dono; aponte a `DATABASE_URL` da aplicação para
`scale_app`. Se a aplicação rodar como dono/superusuário, os GRANTs são ignorados
e a proteção vira decoração.

## Checklist antes de ir para produção

**Configuração**
- [ ] `SESSION_SECRET` gerado com `openssl rand -base64 48` — nunca reaproveitado do dev
- [ ] `DATABASE_URL` com `sslmode=verify-full` (não `require`)
- [ ] `DATABASE_SSL` vazio ou ausente em produção
- [ ] `scale_app` criado e migração `0001` aplicada
- [ ] Repositório GitHub **privado**
- [ ] Confirmar que nenhum `.env*` além do `.env.example` está versionado

**Contas**
- [ ] Nenhuma conta compartilhada — uma conta por pessoa
- [ ] Senha inicial marcada com `trocarSenha: true`
- [ ] Papel mínimo necessário: `leitura` por padrão, `admin` só para quem precisa
- [ ] Gestores vinculados apenas às empresas que administram

**Verificação pós-deploy**
- [ ] Cabeçalhos conferidos em securityheaders.com
- [ ] Testar: acessar `/painel` deslogado redireciona para `/login`
- [ ] Testar: 6 tentativas de login erradas retornam 429
- [ ] Testar: gestor de uma empresa não vê colaborador de outra
- [ ] Testar: gestor não consegue abrir contrato
- [ ] Confirmar que `audit_log` registra login, visualização de contrato e exportação
- [ ] Tentar `UPDATE audit_log SET acao='x'` com o usuário da aplicação — deve falhar

**Backup**
- [ ] Backup automático ativo e criptografado
- [ ] **Restauração testada** — backup nunca restaurado não é backup
- [ ] Backup guardado em local distinto do banco de produção

## Pendências conhecidas

Coisas que ficaram deliberadamente para depois — registradas para não sumirem:

| Item | Situação | Impacto |
|---|---|---|
| MFA (TOTP) | Coluna `mfa_secret` existe, fluxo não implementado | Senha vazada = acesso total |
| Criptografia de campo em salário | Adiada por decisão | Backup vazado expõe a folha |
| CSP com nonce | Hoje usa `unsafe-inline` no script | Reduz a proteção contra XSS |
| Upload de contrato | Não implementado (fase 2) | — |
| Alerta em exportação | Registra em auditoria, mas não notifica | Exfiltração só é vista depois |
| Retenção de ex-colaborador | `ativo`/`desligadoEm` existem, política não definida | Confirmar prazos com o jurídico |

## LGPD

- **Base legal:** execução de contrato de trabalho e obrigação legal
- **Titulares têm direito** de acessar o que o sistema guarda sobre eles — inclusive as avaliações de clima
- **Retenção:** desligamento é soft delete (prazos trabalhistas exigem o histórico); definir por quanto tempo e quem pode consultar inativos
- **Encarregado (DPO):** designar responsável
- **Incidente:** ANPD e titulares afetados precisam ser comunicados — ter o procedimento escrito antes de precisar dele

## Em caso de incidente

1. Trocar `SESSION_SECRET` na Vercel → derruba todas as sessões ativas na hora
2. Desativar contas suspeitas (`ativo = false`) → efeito imediato, sem esperar expiração
3. `SELECT * FROM audit_log WHERE ts > ... ORDER BY ts` → reconstituir o que foi acessado
4. Rotacionar a senha do `scale_app` e as credenciais do storage
5. Avaliar dever de notificação à ANPD
