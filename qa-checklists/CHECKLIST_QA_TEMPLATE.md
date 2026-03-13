# Template de Checklist de QA por Release

## Instrucoes rapidas
1. Copie este arquivo para um novo nome:
   - `qa-checklists/CHECKLIST_QA_YYYY-MM-DD_RELEASE-NOME.md`
2. Use como base detalhada:
   - `CHECKLIST_QA_GO_LIVE_REVISADO.md`
3. Separe sempre os testes dos 3 perfis quando o item envolver mais de um:
   - `Profissional`
   - `Familia`
   - `Empresa`
4. Preencha todos os metadados e todos os campos obrigatorios.
5. Nao marque item como `OK` sem evidencia.

## Metadados da execucao
- Release/Versao:
- Data:
- Responsavel pelo teste:
- Responsavel tecnico:
- Ambiente: Producao / Homologacao
- Build/Commit:

## Legenda de status
- `OK` = validado e aprovado
- `NOK` = validado e reprovado
- `NA` = nao se aplica (exige justificativa em P0)

## Regras de gate (obrigatorias)
- Item em branco conta como `NOK`.
- P0 com `NOK` = `NO-GO`.
- P0 com `NA` sem justificativa/aprovacao = `NO-GO`.
- Item `OK` sem evidencia = `NO-GO`.
- Item multi-perfil sem separacao `Profissional/Familia/Empresa` = checklist incompleto.

## Bloco padrao para itens multi-perfil
- `Profissional`
  - `Desktop`:
  - `Mobile`:
- `Familia`
  - `Desktop`:
  - `Mobile`:
- `Empresa`
  - `Desktop`:
  - `Mobile`:
- Evidencia:
- Data/Hora:
- Responsavel:
- Observacoes:

## Itens minimos obrigatorios (resumo)
- [ ] P0 completo sem pendencias (conforme checklist revisado)
- [ ] Fluxos de cadastro/login/recuperacao validados e separados por `Profissional`, `Familia`, `Empresa`
- [ ] Fluxos de plano (mensal/anual/cancelamento/expiracao) validados e separados por `Profissional`, `Familia`, `Empresa`
- [ ] WhatsApp E2E validado (template, fila, envio real, erros controlados)
- [ ] Webhook de pagamento com idempotencia validado
- [ ] RLS e acesso por perfil validados
- [ ] Smoke final separado por perfil (`Profissional`, `Familia`, `Empresa`) concluido em desktop + mobile

## Log de defeitos
| ID | Item | Prioridade | Ambiente | Descricao | Evidencia | Ticket/Link | Status | Owner | ETA |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

## Decisao de release
- Go/No-Go:
- Motivo da decisao:
- Riscos aceitos:
- Aprovado por (Produto):
- Aprovado por (Tecnico):
- Data/Hora:
