# Template de Checklist de QA por Release

## Instrucoes rapidas
1. Copie este arquivo para um novo nome:
   - `qa-checklists/CHECKLIST_QA_YYYY-MM-DD_RELEASE-NOME.md`
2. Use como base detalhada:
   - `CHECKLIST_QA_GO_LIVE_REVISADO.md`
3. Preencha todos os metadados e todos os campos obrigatorios.
4. Nao marque item como `OK` sem evidencia.

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

## Itens minimos obrigatorios (resumo)
- [ ] P0 completo sem pendencias (conforme checklist revisado)
- [ ] WhatsApp E2E validado (template, fila, envio real, erros controlados)
- [ ] Webhook de pagamento com idempotencia validado
- [ ] RLS e acesso por perfil validados
- [ ] Smoke final desktop + mobile concluido

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
