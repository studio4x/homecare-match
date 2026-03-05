# Checklist QA - Go Live (Desktop + Mobile)

## Metadados
- Build/Versao:
- Data:
- Responsavel:
- Ambiente: Homologacao / Producao

## Como preencher
- Em cada item, preencher `Desktop` e `Mobile` com `OK`, `NOK` ou `NA`.
- `P0` = bloqueador de release: qualquer `NOK` em Desktop ou Mobile = `No-Go`.
- Registrar falhas no log ao final.

---

## 1) Bloqueadores P0 (obrigatorio 100% OK)

### 1.1 Autenticacao e Acesso
- [OK] P0-01 Cadastro de conta funcionando
  Desktop: Profissional OK, Familia OK, Empresa OK
  Mobile: Profissional OK, Familia OK,
  Observacoes:

- [OK] P0-02 Login com credenciais validas funcionando
  Desktop: Profissional OK, Familia OK, Empresa OK
  Mobile: Profissional OK, Familia OK, Empresa OK
  Observacoes:

- [OK] P0-03 Logout encerrando sessao corretamente
  Desktop: Profissional OK, Familia OK, Empresa OK
  Mobile: Profissional OK, Familia OK, Empresa OK
  Observacoes:

- [OK] P0-04 Recuperacao de senha funcionando (envio e redefinicao)
  Desktop: Profissional OK, Empresa OK, Familia OK
  Mobile: Profissional OK, Empresa OK, Familia OK
  Observacoes: Precisou ajustar o funcionamento da redefinição de senha. Ao clicar no botão do e-mail, não abria a janela para redefinir a senha. Foi necessário fazer a tradução de uma frase que aparece na redefinição de senha.

- [OK] P0-05 Rota protegida bloqueada para usuario sem login
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-06 Rota admin bloqueada para usuario nao-admin
  Desktop: OK
  Mobile: OK
  Observacoes:

### 1.2 Planos e Pagamentos
- [OK] P0-07 Contratacao do plano mensal funcionando
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-08 Ativacao/reflexo do plano mensal no dashboard
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-09 Contratacao do plano anual funcionando
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-10 Ativacao/reflexo do plano anual no dashboard
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-11 Cancelamento atualizando status corretamente
  Desktop: OK
  Mobile: OK
  Observacoes: Ajuste para fazer a tela voltar ao topo ao ser feito o cancelamento

- [ ] P0-12 Expiracao atualizando status corretamente
  Desktop:
  Mobile:
  Observacoes:

- [OK] P0-13 Valores de pagamento conferem com Asaas
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-14 Status de pagamento confere com Asaas
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-15 Datas de pagamento conferem com Asaas
  Desktop: OK
  Mobile: OK
  Observacoes:

### 1.3 Busca, Contato e Visibilidade
- [OK] P0-16 Profissional sem plano ativo nao aparece na busca
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-17 Busca de profissionais funcionando
  Desktop: OK
  Mobile: OK
  Observacoes:

- [ ] P0-18 Fluxo de contato iniciado por empresa funcionando
  Desktop:
  Mobile:
  Observacoes:

- [ ] P0-19 Fluxo de contato iniciado por familia funcionando
  Desktop:
  Mobile:
  Observacoes:

### 1.4 PWA e Estabilidade
- [ ] P0-20 Instalacao PWA no Android sem erro critico
  Desktop: NA
  Mobile:
  Observacoes:

- [ ] P0-21 Instalacao PWA no iOS sem erro critico
  Desktop: NA
  Mobile:
  Observacoes:

- [ ] P0-22 Console sem erro critico na home publica
  Desktop:
  Mobile:
  Observacoes:

- [ ] P0-23 Console sem erro critico no dashboard principal
  Desktop:
  Mobile:
  Observacoes:

### Resumo P0
- Desktop OK:
- Mobile OK:
- Itens com NOK:

---

## 2) Validacoes P1 (recomendado para liberar com seguranca)

### 2.1 Dashboards e Navegacao
- [ ] P1-01 Dashboard do profissional carregando e navegando sem quebra
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-02 Dashboard da empresa carregando e navegando sem quebra
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-03 Dashboard da familia carregando e navegando sem quebra
  Desktop:
  Mobile:
  Observacoes:

### 2.2 UX Mobile e Responsividade
- [ ] P1-04 Modais respeitando altura da viewport
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-05 Safe area sem cobrir conteudo
  Desktop: NA
  Mobile:
  Observacoes:

- [ ] P1-06 Menu inferior sem cobrir conteudo
  Desktop: NA
  Mobile:
  Observacoes:

### 2.3 Funcionalidades Complementares
- [ ] P1-07 Upload de avatar funcionando
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-08 Upload de documento funcionando
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-09 Cursos carregando e liberando acesso corretamente (quando aplicavel)
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-10 Progresso de curso salvando e retomando corretamente (quando aplicavel)
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-11 Certificado gerando corretamente (quando aplicavel)
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-12 Abertura de ticket de suporte funcionando
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-13 Resposta em ticket de suporte funcionando
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-14 Notificacoes do painel funcionando
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-15 Configuracoes alteradas no admin refletindo no frontend
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-16 Banner de privacidade/cookies sem sobreposicao indevida
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-17 Permissao/prompt de push sem sobreposicao indevida
  Desktop:
  Mobile:
  Observacoes:

### Resumo P1
- Desktop OK:
- Mobile OK:
- Itens com NOK:

---

## 3) Smoke Final (antes de publicar)

- [ ] SMK-01 Fluxo completo do profissional validado
  Desktop:
  Mobile:
  Observacoes:

- [ ] SMK-02 Fluxo completo da empresa validado
  Desktop:
  Mobile:
  Observacoes:

- [ ] SMK-03 Fluxo completo da familia validado
  Desktop:
  Mobile:
  Observacoes:

- [ ] SMK-04 Fluxo completo do admin validado
  Desktop:
  Mobile:
  Observacoes:

- [ ] SMK-05 Fluxos criticos validados no Android Chrome
  Desktop: NA
  Mobile:
  Observacoes:

- [ ] SMK-06 Fluxos criticos validados no iOS Safari
  Desktop: NA
  Mobile:
  Observacoes:

---

## 4) Log de Falhas

- ID:
  Severidade: P0/P1
  Item:
  Plataforma: Desktop/Mobile + navegador
  Descricao curta:
  Evidencia: Link print/video
  Status: Aberto/Fechado

---

## 5) Decisao de Release
- Go/No-Go:
- Motivo da decisao:
- Itens P0 pendentes:
- Riscos aceitos:
- Aprovado por:
