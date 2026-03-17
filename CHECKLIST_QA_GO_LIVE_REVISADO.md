# Checklist QA - Go Live Revisado (Desktop + Mobile)

## 0) Metadados
- Build/Versao: 5.8.182
- Commit:
- Data: 13/03/2026
- Responsavel QA: Rodolfo
- Responsavel Tecnico: Rodolfo
- Ambiente: Homologacao / Producao
- Janela de lancamento:

## 0.1) Regras de preenchimento (obrigatorias)
- Em cada item, preencher `Desktop` e `Mobile` com `OK`, `NOK` ou `NA`.
- Quando o item envolver mais de um perfil, preencher separado por:
  - `Profissional`
  - `Familia`
  - `Empresa`
- Se marcar item como `OK`, preencher tambem:
  - Evidencia (print/video/log/link),
  - Data/Hora da validacao,
  - Responsavel.
- Item multi-perfil sem separacao `Profissional/Familia/Empresa` = checklist incompleto.
- Item com status em branco = **NOK** para decisao de release.
- `P0` e bloqueador. Qualquer `NOK` em P0 = **NO-GO**.
- `NA` em P0 so pode ser aceito com justificativa formal em "Riscos aceitos".

## 0.2) Bloco padrao para itens multi-perfil
- Profissional:
  - Desktop:
  - Mobile:
- Familia:
  - Desktop:
  - Mobile:
- Empresa:
  - Desktop:
  - Mobile:
- Evidencia:
- Data/Hora:
- Responsavel:
- Observacoes:

---

## 1) Bloqueadores P0 (obrigatorio 100% OK)

### 1.1 Autenticacao e Acesso
- [ ] P0-01 Cadastro (profissional, familia, empresa)
  - Profissional: OK
    - Desktop: OK
    - Mobile: OK
  - Familia: OK
    - Desktop: OK
    - Mobile: OK
  - Empresa:
    - Desktop: OK
    - Mobile: OK
  - Evidencia:
  - Data/Hora: 16/03/2026 ÀS 11:02
  - Responsavel:
  - Observacoes:

- [OK] P0-02 Login, logout e expiracao de sessao
  - Profissional: OK
    - Desktop: OK
    - Mobile: OK
  - Familia: OK
    - Desktop: OK
    - Mobile: OK
  - Empresa: OK
    - Desktop: OK
    - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-03 Recuperacao de senha (envio, link, redefinicao)
  - Profissional: OK
    - Desktop: OK
    - Mobile: OK
  - Familia: OK
    - Desktop: OK
    - Mobile: OK
  - Empresa: OK
    - Desktop: OK
    - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes: 

- [OK] P0-04 Rotas protegidas e rota admin bloqueada para nao-admin
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

### 1.2 Pagamentos, Assinaturas e Webhooks
- [OK] P0-05 Contratacao plano mensal e reflexo no dashboard
  - Profissional: OK
    - Desktop: OK
    - Mobile: OK
  - Familia: OK
    - Desktop: OK
    - Mobile: OK
  - Empresa: OK
    - Desktop: OK
    - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-06 Contratacao plano anual e reflexo no dashboard
  - Profissional: OK
    - Desktop: OK
    - Mobile: OK
  - Familia: OK
    - Desktop: OK
    - Mobile: OK
  - Empresa: OK
    - Desktop: OK
    - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-07 Cancelamento atualiza status corretamente
  - Profissional: OK
    - Desktop: OK
    - Mobile: OK
  - Familia: OK
    - Desktop: OK
    - Mobile: OK
  - Empresa: OK
    - Desktop: OK
    - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-08 Expiracao atualiza status corretamente (obrigatorio)
  - Profissional: OK
    - Desktop: OK
    - Mobile: OK
  - Familia: OK
    - Desktop: OK
    - Mobile: OK
  - Empresa: OK
    - Desktop: OK
    - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-09 Conciliacao Asaas: valor, status e datas
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-10 Webhook Asaas com idempotencia (evento duplicado nao duplica efeito)
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-11 Webhook Asaas fora de ordem (estado final correto)
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

### 1.3 Busca, Visibilidade e Contato
- [OK] P0-12 Profissional sem plano ativo nao aparece na busca
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-13 Busca e filtros funcionando
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-14 Fluxo de contato empresa -> profissional funcionando
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-15 Fluxo de contato familia -> profissional funcionando
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

### 1.4 WhatsApp E2E (novo bloqueador)
- [OK] P0-16 Templates aprovados na Meta para todos os eventos em uso
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-17 Mapeamento evento -> template correto no admin/notificacoes
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-18 Envio de teste por evento (usuario/admin) com conteudo correto
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-19 Fila WhatsApp processa (pending -> sent/retry/failed) sem travar
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-20 Casos de erro validados: opt-in desligado, numero invalido, template invalido
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

### 1.5 Seguranca e Dados
- [OK] P0-21 RLS: usuario nao acessa dados de outro usuario
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-22 RLS: empresa/familia/profissional/admin com escopos corretos
  - Desktop: OK
  - Mobile: OK
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

- [OK] P0-23 Secrets e chaves sensiveis apenas no backend (sem vazamento no frontend)
  - Desktop: OK
  - Mobile: OK
  - Evidencia: Varredura regex em `src/public/dist` + inspeção do bundle de produção (`/assets/index-Bx8P9EtG.js`) sem ocorrência de `sb_secret_`, `SUPABASE_SERVICE_ROLE_KEY`, `service_role` ou chaves privadas reais. Ocorrência de `ASAAS_API_KEY_*` apenas como texto informativo de UI (nome de variável, não valor).
  - Data/Hora: 17/03/2026 16:41
  - Responsavel: Codex (validação automatizada)
  - Observacoes: Exposição de `SUPABASE_URL` e chave publishable/anon no frontend é esperada e segura; segredos permanecem no backend/Edge Functions via `Deno.env`.

### 1.6 Estabilidade e Operacao
- [OK] P0-24 Cron jobs ativos (push, whatsapp, alertas) e executando
  - Desktop: OK
  - Mobile: OK
  - Evidencia: `setup-cron-job` retornou `200` com mensagem de automacao ativa (push + estornos + alertas + whatsapp); sentinela em `whatsapp_notification_queue` (destino invalido) mudou automaticamente de `pending` para `failed` com `attempt_count=1` em ~1 min (execucao cron comprovada); backlog vencido zerado em `whatsapp_notification_queue` e `push_notifications`; alerta de assinatura validado com execucao sem force (`forced=false`) gerando logs `widget/email` em `notification_delivery_logs`.
  - Data/Hora: 17/03/2026 17:02
  - Responsavel: Codex (validação automatizada)
  - Observacoes: Execucao automatica do WhatsApp comprovada por sentinela cron. Para alertas, a rotina foi validada em modo admin sem force (mesma logica de producao). Nao houve envio para usuarios reais na prova de cron do WhatsApp.

- [OK] P0-25 Console sem erro critico (home publica + dashboard principal)
  - Desktop: OK
  - Mobile: OK
  - Evidencia: Automacao Playwright executada em producao (`https://www.homecarematch.com.br/` e `https://www.homecarematch.com.br/dashboard`) com sessao autenticada valida no dashboard. Resultado: `pageerror=0` e `console.error=0` em desktop/mobile. Falhas de rede observadas apenas na home para telemetria (`/_vercel/speed-insights/script.js` e `google-analytics collect` com `ERR_ABORTED`), sem impacto funcional.
  - Data/Hora: 17/03/2026 17:08
  - Responsavel: Codex (validacao automatizada)
  - Observacoes: Nao foram identificados erros criticos de runtime JS na home publica nem no dashboard principal. Dashboard sem request failures durante a execucao.

- [ ] P0-26 Backup e restore testado (amostra)
  - Desktop: PENDENTE
  - Mobile: PENDENTE
  - Evidencia:
  - Data/Hora:
  - Responsavel:
  - Observacoes:

### Resumo P0
- Total itens P0:
- OK:
- NOK:
- NA:
- Pendencias P0:

---

## 2) Validacoes P1 (recomendado para liberar com seguranca)

- Em itens P1 que envolvam mais de um perfil, preencher separado por `Profissional`, `Familia` e `Empresa`.

### 2.1 UX e Responsividade
- [ ] P1-01 Dashboard profissional sem quebra
- [ ] P1-02 Dashboard empresa sem quebra
- [ ] P1-03 Dashboard familia sem quebra
- [ ] P1-04 Modais/safe-area/menu inferior OK

### 2.2 Funcionalidades complementares
- [ ] P1-05 Upload avatar e documento
- [ ] P1-06 Cursos e progresso (quando aplicavel)
- [ ] P1-07 Certificado (quando aplicavel)
- [ ] P1-08 Suporte: abertura + resposta + notificacao email/whatsapp
- [ ] P1-09 Config admin reflete no frontend

### 2.3 Canais e comunicacao
- [ ] P1-10 Notificacoes de painel (widget/admin) funcionando
- [ ] P1-11 Push prompt e permissao sem sobreposicao indevida
- [ ] P1-12 WhatsApp historico de testes no admin consistente com fila

### 2.4 Performance e carga
- [ ] P1-13 Carga leve em fluxos criticos (login, busca, contato, checkout)
- [ ] P1-14 Tempo de resposta aceitavel no horario de pico

### 2.5 Observabilidade
- [ ] P1-15 Monitoramento de erros frontend/edge ativo
- [ ] P1-16 Alerta para falha de webhook e fila whatsapp acumulada

### Resumo P1
- Total itens P1:
- OK:
- NOK:
- NA:
- Pendencias P1:

---

## 3) Smoke Final (antes de publicar)

- [ ] SMK-01 Fluxo completo profissional
  - Desktop:
  - Mobile:
  - Evidencia:
  - Observacoes:

- [ ] SMK-02 Fluxo completo empresa
  - Desktop:
  - Mobile:
  - Evidencia:
  - Observacoes:

- [ ] SMK-03 Fluxo completo familia
  - Desktop:
  - Mobile:
  - Evidencia:
  - Observacoes:

- [ ] SMK-04 Fluxo completo admin
  - Desktop:
  - Mobile:
  - Evidencia:
  - Observacoes:

- [ ] SMK-05 Android Chrome
  - Desktop: NA
  - Mobile:
  - Evidencia:
  - Observacoes:

- [ ] SMK-06 iOS Safari
  - Desktop: NA
  - Mobile:
  - Evidencia:
  - Observacoes:

- [ ] SMK-07 WhatsApp E2E (envio real + entrega + erro controlado)
  - Desktop:
  - Mobile:
  - Evidencia:
  - Observacoes:

---

## 4) Log de Falhas

| ID | Severidade | Item | Plataforma | Descricao | Evidencia | Status | Owner | ETA |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

---

## 5) Gate de Release (Go / No-Go)

### Regras automaticas
- **NO-GO** se:
  - existir qualquer `NOK` em P0;
  - existir qualquer item P0 em branco;
  - houver P0 marcado `NA` sem risco aceito e aprovador;
  - nao houver evidencia para item marcado `OK`.
- **GO** somente se:
  - 100% dos P0 = `OK`;
  - smoke final concluido sem bloqueador;
  - riscos aceitos documentados;
  - plano de rollback validado.

### Decisao
- Go/No-Go:
- Motivo da decisao:
- Riscos aceitos:
- Plano de rollback:
- Aprovado por (Produto):
- Aprovado por (Tecnico):
- Data/Hora aprovacao:
