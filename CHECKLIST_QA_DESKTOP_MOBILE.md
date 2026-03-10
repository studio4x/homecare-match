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

- [OK] P0-18 Fluxo de contato iniciado por empresa funcionando
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-19 Fluxo de contato iniciado por familia funcionando
  Desktop: OK
  Mobile: OK
  Observacoes:

### 1.4 PWA e Estabilidade
- [OK] P0-20 Instalacao PWA no Android sem erro critico
  Desktop: NA
  Mobile: OK
  Observacoes:

- [NA] P0-21 Instalacao PWA no iOS sem erro critico
  Desktop: NA
  Mobile: NA
  Observacoes:

- [OK] P0-22 Console sem erro critico na home publica
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P0-23 Console sem erro critico no dashboard principal
  Desktop: OK
  Mobile: OK
  Observacoes:

### Resumo P0
- Desktop OK:
- Mobile OK:
- Itens com NOK:

---

## 2) Validacoes P1 (recomendado para liberar com seguranca)

### 2.1 Dashboards e Navegacao
- [OK] P1-01 Dashboard do profissional carregando e navegando sem quebra
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P1-02 Dashboard da empresa carregando e navegando sem quebra
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P1-03 Dashboard da familia carregando e navegando sem quebra
  Desktop: OK
  Mobile: OK
  Observacoes:

### 2.2 UX Mobile e Responsividade
- [OK] P1-04 Modais respeitando altura da viewport
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P1-05 Safe area sem cobrir conteudo
  Desktop: NA
  Mobile: OK
  Observacoes:

- [OK] P1-06 Menu inferior sem cobrir conteudo
  Desktop: NA
  Mobile: OK
  Observacoes:

### 2.3 Funcionalidades Complementares
- [OK] P1-07 Upload de avatar funcionando
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P1-08 Upload de documento funcionando
  Desktop: OK
  Mobile: OK
  Observacoes:

- [OK] P1-09 Cursos carregando e liberando acesso corretamente (quando aplicavel)
  Desktop: OK
  Mobile: OK
  Observacoes:

- [NA] P1-10 Progresso de curso salvando e retomando corretamente (quando aplicavel)
  Desktop: NA
  Mobile: NA
  Observacoes:

- [ ] P1-11 Certificado gerando corretamente (quando aplicavel)
  Desktop: OK
  Mobile:
  Observacoes:

- [OK] P1-12 Abertura de ticket de suporte funcionando
  Desktop: OK
  Mobile: OK
  Observacoes: Ajustar recebimento de e-mail no admin

- [ ] P1-13 Resposta em ticket de suporte funcionando
  Desktop: OK
  Mobile: OK
  Observacoes: Ajustar recebimento de resposta de ticket par ao usário

- [ ] P1-14 Notificacoes do painel funcionando
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-15 Configuracoes alteradas no admin refletindo no frontend
  Desktop:
  Mobile:
  Observacoes:

- [OK] P1-16 Banner de privacidade/cookies sem sobreposicao indevida
  Desktop: OK
  Mobile: OK
  Observacoes:

- [ ] P1-17 Permissao/prompt de push sem sobreposicao indevida
  Desktop:
  Mobile:
  Observacoes:

### 2.4 Chatbot da Plataforma (novo)
- [ ] P1-18 Widget do chatbot visivel e funcional no site publico e no dashboard
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-19 Fluxo inicial com saudacao + botao "Iniciar conversa" antes de liberar envio
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-20 Botao de minimizar funcionando e botao "Encerrar conversa" limpando historico
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-21 Historico da conversa persiste ao clicar fora e ao trocar de pagina
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-22 Chat identifica usuario logado (nome) e diferencia respostas para anonimo x autenticado
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-23 Enquanto processa, exibe estado "Estou lendo..." e fase "Quase pronto..." apos 10s
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-24 Resposta fora de escopo aciona fallback com botoes de acao sem quebrar UX
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-25 Botoes de acao exibidos corretamente (Ver FAQ, Abrir chamado, Navegar para pagina citada)
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-26 Respostas sem exibicao de rotas cruas (ex.: "/dashboard/..."), usando texto amigavel
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-27 Intent de cadastro: bot pergunta tipo de cadastro e direciona com botao apropriado
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-28 Conteudo de planos/pagamentos coerente (incluindo Plano Anual e regra de teste gratis)
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-29 Toggle admin de estrategia do bot (IA first x IA secundaria) aplicado no frontend
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-30 Toggle admin para selo "Resposta por IA/FAQ" funcionando no widget
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-31 Guias de uso consumidos pelo chatbot mas nao expostos no frontend
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-32 Perguntas sem resposta viram sugestoes no admin, com acao de criar FAQ
  Desktop:
  Mobile:
  Observacoes:

### 2.5 Marketing (UTM + Encurtador) (novo)
- [ ] P1-33 Admin cria URL com UTM e gera link encurtado funcionando no redirecionamento
  Desktop:
  Mobile: NA
  Observacoes:

- [ ] P1-34 Contadores por link (cliques e cadastros) atualizam corretamente
  Desktop:
  Mobile: NA
  Observacoes:

- [ ] P1-35 Filtro por periodo (7/30/90 dias) e grafico por link funcionando
  Desktop:
  Mobile: NA
  Observacoes:

- [ ] P1-36 Campos UTM com textos de ajuda visiveis no admin
  Desktop:
  Mobile: NA
  Observacoes:

### 2.6 Ajustes de Widgets Flutuantes (novo)
- [ ] P1-37 Botao "voltar ao topo" acima do sino de notificacoes, com nova cor e alinhamento correto
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-38 Distanciamento/empilhamento visual entre icones flutuantes sem sobreposicao
  Desktop:
  Mobile:
  Observacoes:

### 2.7 Programa de Indicacoes (novo)
- [ ] P1-39 Cadastro via link de indicacao aparece na lista do indicador
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-40 Card do indicado exibe nome e e-mail de cadastro corretamente
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-41 Etapa "Validou e-mail" atualiza apos confirmacao pelo admin
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-42 Etapa "Preencheu perfil" atualiza apos completar campos obrigatorios
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-43 Etapa "Validou documentos" atualiza apos verificacao e marca indicacao valida
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-44 Contadores e bloco de nivel (indicacoes validas / faltam para proximo selo) atualizam corretamente
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-45 Lista de indicados atualiza sem recarregar manualmente (polling/foco da aba)
  Desktop:
  Mobile:
  Observacoes:

- [ ] P1-46 Textos da pagina de indicacoes exibidos com acentuacao correta
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

- [ ] SMK-07 Fluxo ponta a ponta do chatbot validado (publico + logado + admin)
  Desktop:
  Mobile:
  Observacoes:

- [ ] SMK-08 Fluxo ponta a ponta de UTM + encurtador + metricas validado
  Desktop:
  Mobile: NA
  Observacoes:

- [ ] SMK-09 Fluxo ponta a ponta de indicacoes validado (cadastro por link -> etapas -> selo)
  Desktop:
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
