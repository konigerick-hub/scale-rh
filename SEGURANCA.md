# Segurança — Scale RH

Este sistema guarda salários, contratos assinados (CPF, RG, endereço, assinatura)
e avaliações nominais. Trate qualquer mudança em `lib/auth/` ou `lib/store/` como
mudança crítica.

## Princípios que o código segue

**1. O proxy não autoriza, só faz triagem.**
`proxy.ts` confere a assinatura do JWT na borda — barato, barra ruído. A
autorização real está em `lib/auth/guard.ts`, que recarrega o usuário a cada
requisição. Por isso desativar alguém tem efeito imediato, sem esperar o token
de 4 horas expirar.

**2. Escopo por empresa aplicado ao montar o resultado, nunca na tela.**
Em `lib/queries/colaboradores.ts`, o dado de uma empresa que o gestor não pode
ver nunca sai da função. Filtrar no componente significaria que a informação já
foi serializada e enviada ao navegador. Gestor sem empresa vinculada recebe
lista vazia — nunca a lista completa.

**3. Login não revela quais contas existem.**
Mesma mensagem para e-mail inexistente e senha errada, e `gastarTempoConstante()`
gasta tempo comparável quando o usuário não existe — sem isso, a diferença de
latência entrega a lista de e-mails válidos.

**4. Nomes de arquivo são hash, não o dado.**
O controle de tentativas grava em `tentativas/<hash>.json`. Se fosse o e-mail em
claro, quem tivesse acesso de leitura ao armazenamento leria a lista de contas só
pela listagem de arquivos.

**5. Escrita concorrente não perde trabalho.**
`alterarBase()` lê, aplica e só grava se ninguém escreveu no intervalo (ETag).
Se houve conflito, recarrega e reaplica em vez de sobrescrever.

## Limitação conhecida: auditoria

Cada evento é gravado como arquivo próprio com `allowOverwrite: false`, então
**não é possível alterar** um evento já registrado.

Mas, sem um banco recusando `DELETE`, quem tiver as credenciais da aplicação
ainda consegue **apagar** eventos. Com Postgres dava para bloquear as duas
coisas via `REVOKE`.

Isso foi aceito conscientemente em troca de não depender de banco externo. **Se
auditoria inviolável virar exigência** — auditoria externa, exigência contratual
de cliente, investigação trabalhista — este é o motivo para migrar para um banco
de verdade.

## Checklist antes de ir para produção

**Configuração**
- [ ] `SESSION_SECRET` gerado com `openssl rand -base64 48`, valor novo — nunca o do dev
- [ ] Blob Store criado em **modo privado** (não dá para mudar depois)
- [ ] Região do Blob Store escolhida considerando residência de dados
- [ ] Repositório GitHub **privado**
- [ ] Confirmar que `.data/` e `.env.local` não estão versionados

**Contas**
- [ ] Nenhuma conta compartilhada — uma por pessoa
- [ ] Senha inicial com `trocarSenha: true`
- [ ] Papel mínimo necessário: `leitura` por padrão, `admin` só para quem precisa
- [ ] Gestores vinculados apenas às empresas que administram

**Verificação pós-deploy**
- [ ] Cabeçalhos conferidos em securityheaders.com
- [ ] `/painel` deslogado redireciona para `/login`
- [ ] Seis tentativas erradas retornam 429
- [ ] Gestor de uma empresa não vê colaborador de outra
- [ ] Gestor não vê a coluna de contrato
- [ ] Auditoria registrando login, visualização de contrato e exportação

**Backup**
- [ ] Rotina de cópia do `base.json` e dos contratos definida
- [ ] **Restauração testada** — backup nunca restaurado não é backup

## Já verificado

Testado localmente contra o sistema rodando, não apenas por inspeção de código:

| Verificação | Resultado |
|---|---|
| Painel sem sessão redireciona | 307 → `/login` |
| Senha errada rejeitada | 401 |
| E-mail inexistente e senha errada dão a mesma mensagem | idênticas |
| Cookie `HttpOnly` e `SameSite=Strict` | presentes |
| Cookie adulterado rejeitado | 307 → `/login` |
| Bloqueio na 6ª tentativa | 429, `Retry-After: 900` |
| Bloqueio resiste à senha correta | 429 |
| Gestor não vê outras empresas | 3 empresas → 1 |
| Gestor não vê pessoas de outras empresas | Homero, Leyla, Rui, Fred, Davi Kern ocultos |
| Gestor não vê a coluna de contrato | ausente |
| Admin vê tudo | 3 empresas, 66 vínculos |
| Cabeçalhos de segurança | nosniff, DENY, CSP, sem X-Powered-By |
| JWT: forjado, `alg:none`, expirado, papel adulterado | todos rejeitados |

## Pendências

| Item | Situação | Impacto |
|---|---|---|
| MFA (TOTP) | Campo `mfaSecret` existe, fluxo não implementado | Senha vazada = acesso total |
| Criptografia dos salários | Adiada por decisão | Backup vazado expõe a folha |
| CSP com nonce | Hoje usa `unsafe-inline` em script | Reduz proteção contra XSS |
| Upload de contrato | Não implementado | Próxima fase |
| Exclusão de auditoria | Possível com credenciais da aplicação | Ver limitação acima |
| Alerta em exportação | Registra, mas não notifica | Exfiltração só é vista depois |
| Datas de nascimento e admissão | Sem dado na planilha | Preencher pela tela |

## LGPD

- **Base legal:** execução de contrato de trabalho e obrigação legal
- **Titulares têm direito** de acessar o que o sistema guarda sobre eles — inclusive avaliações de clima
- **Retenção:** desligamento é soft delete (prazos trabalhistas); definir por quanto tempo e quem consulta inativos — confirmar prazos com o jurídico
- **Encarregado (DPO):** designar responsável
- **Incidente:** ter o procedimento escrito antes de precisar dele

## Em caso de incidente

1. Trocar `SESSION_SECRET` na Vercel → derruba todas as sessões na hora
2. Marcar contas suspeitas como `ativo: false` → efeito imediato
3. Ler `auditoria/<data>/` para reconstituir o que foi acessado
4. Rotacionar as credenciais do Blob Store
5. Avaliar dever de notificação à ANPD
