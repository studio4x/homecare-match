# Checklist de QA - Desktop e Mobile

## Como usar
- Marque cada item com `OK`, `NOK` ou `NA`.
- Quando falhar, preencha o bloco de "Notas de falha" abaixo do item.
- Anexe evidências (print/vídeo) e ambiente (desktop/mobile + navegador).
- Após correções, reexecute apenas os itens que ficaram `NOK`.

## Metadados da execução
- Release/Versão: 5.8.98
- Data: 27/02/2026
- Responsável pelo teste: Rodolfo Medeiros
- Ambiente: Homologação

## Legenda de status
- `OK` = validado e aprovado
- `NOK` = validado e reprovado
- `NA` = não se aplica

---

## 1) Escopo e Ambiente
- [OK] ENV-01 - Produção e homologação validadas
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [OK] ENV-02 - Desktop Chrome e Edge validados
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] ENV-03 - Mobile Android Chrome e iOS Safari validados
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [OK] ENV-04 - Perfis testados: profissional, empresa, família, admin
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] ENV-05 - Cenários testados: com plano ativo, sem plano, plano cancelado
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 2) Autenticação e Sessão
- [ ] AUTH-01 - Cadastro de profissional
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] AUTH-02 - Cadastro de empresa
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] AUTH-03 - Login com credenciais válidas
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] AUTH-04 - Login com senha inválida exibe mensagem correta
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] AUTH-05 - Fluxo de recuperação de senha
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] AUTH-06 - Logout encerra acesso às rotas protegidas
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] AUTH-07 - URL protegida sem login redireciona para login
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 3) Dashboard do Profissional
- [ ] DASH-PRO-01 - Home do dashboard carrega no desktop
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] DASH-PRO-02 - Home do dashboard carrega no mobile
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] DASH-PRO-03 - Menu lateral funciona no desktop
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] DASH-PRO-04 - Menu mobile abre/fecha e navega corretamente
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] DASH-PRO-05 - Botão `scroll to top` oculto no mobile do dashboard
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] DASH-PRO-06 - Botão `scroll to top` visível e funcional no desktop do dashboard
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 4) Assinatura e Planos
- [ ] SUB-01 - "Assinar agora" abre modal de planos (sem redirecionar para home)
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-02 - Modal de planos funciona no desktop
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-03 - Modal de planos funciona no mobile
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-04 - Altura do modal não ultrapassa a viewport no desktop
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-05 - Botão de fechar modal funciona
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-06 - Recursos do plano vêm da configuração feita no admin
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-07 - Fluxo de compra de assinatura mensal
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-08 - Fluxo de compra de assinatura anual (12x)
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-09 - Plano ativo exibido corretamente após compra
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-10 - Trial de 30 dias é concedido apenas uma vez após cadastro
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-11 - Botão de cancelamento cancela a assinatura ativa
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-12 - Cancelamento de anual (12x) em até 7 dias trata estorno corretamente
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-13 - Não ocorre erro de estorno individual em fluxo válido de cancelamento
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-14 - Após cancelamento/expiração, rótulo do plano é "nenhum plano definido"
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SUB-15 - Status de pagamento mostra "estornado" quando aplicável
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 5) Regras de Visibilidade do Profissional
- [ ] VIS-01 - Sem plano ativo, profissional fica oculto na página de busca
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] VIS-02 - Com plano ativo, profissional aparece na página de busca
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] VIS-03 - Dashboard exibe alerta de perfil não visível por ausência de plano ativo
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] VIS-04 - Alerta não aparece para usuários com plano ativo
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 6) Busca e Filtros
- [ ] SEARCH-01 - Busca por nome/localidade funciona
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SEARCH-02 - Filtros combinados funcionam
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SEARCH-03 - Paginação/infinite scroll funciona no desktop
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SEARCH-04 - Paginação/infinite scroll funciona no mobile
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SEARCH-05 - Profissionais sem plano não aparecem em nenhuma combinação de filtros
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 7) Perfil e Dados
- [ ] PROFILE-01 - Edição de perfil e salvamento
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] PROFILE-02 - Upload/atualização de avatar
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] PROFILE-03 - Validação de campos obrigatórios
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] PROFILE-04 - Dados persistem após logout/login
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 8) Contatos, Indicações, Suporte e Notificações
- [ ] OPS-01 - Lista de contatos carrega
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] OPS-02 - Ações de indicação registram corretamente
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] OPS-03 - Abrir ticket de suporte e enviar resposta
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] OPS-04 - Notificações no dashboard atualizam corretamente (incluindo push quando permitido)
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 9) Cursos e Conteúdo
- [ ] COURSE-01 - Lista de cursos carrega
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] COURSE-02 - Controle de acesso respeita regras de plano ativo
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] COURSE-03 - Salvar/retomar progresso funciona
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] COURSE-04 - Geração de certificados (quando aplicável)
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 10) Pagamentos e Histórico
- [ ] PAY-01 - Histórico de pagamentos carrega sem erros
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] PAY-02 - Links de detalhe de pagamento abrem parcela/fatura corretas
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] PAY-03 - Valores/datas/status conferem com Asaas
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] PAY-04 - Atualização manual sincroniza sem duplicar registros
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 11) Admin
- [ ] ADM-01 - Login admin e proteção de rotas
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] ADM-02 - Configuração de planos reflete no modal de planos do dashboard
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] ADM-03 - Fluxo de cupons: criar/aplicar/expirar
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] ADM-04 - Ações de gestão de usuários (buscar/editar/status)
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] ADM-05 - Consistência da visão de pagamentos no admin
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 12) UX Mobile e Responsividade
- [ ] MOB-01 - Nenhum modal ultrapassa a altura da viewport
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] MOB-02 - Teclado virtual não bloqueia campos críticos
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] MOB-03 - Alvos de toque são utilizáveis
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] MOB-04 - Navegação inferior/safe area não encobre conteúdo
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 13) Segurança e Regras de Acesso
- [ ] SEC-01 - Usuário não-admin não acessa rotas admin
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SEC-02 - Usuário sem plano não acessa recursos premium por URL direta
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SEC-03 - Não há exposição de dados de outro usuário por manipulação de URL
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

## 14) Smoke Final (Go/No-Go)
- [ ] SMOKE-01 - Fluxo completo profissional: cadastro -> trial (uma vez) -> plano pago -> cancelamento
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SMOKE-02 - Fluxo completo empresa: cadastro -> busca -> contato
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SMOKE-03 - Fluxo completo admin: editar plano -> validar reflexo no frontend
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:
- [ ] SMOKE-04 - Fluxos críticos validados em desktop e mobile
  - Status:
  - Evidência:
  - Ambiente:
  - Notas de falha:

---

## Log de defeitos
| ID | Item do checklist | Prioridade | Ambiente | Descrição | Evidência | Ticket/Link | Status |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Decisão de release
- Go/No-Go:
- Responsável pela decisão:
- Observações:
