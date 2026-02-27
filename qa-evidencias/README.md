# Pasta de Evidências de QA

Use esta pasta para armazenar prints e vídeos de cada execução de testes.

## Estrutura sugerida por release
- `qa-evidencias/2026-02-27_release-x/desktop/`
- `qa-evidencias/2026-02-27_release-x/mobile/`

## Padrão de nome de arquivo
- `<ITEM>-<STATUS>-<AMBIENTE>.<extensao>`
- Exemplos:
  - `SUB-12-OK-desktop-chrome.png`
  - `VIS-01-NOK-mobile-ios.mp4`

## Boas práticas
- Sempre vincule a evidência ao ID do item do checklist.
- Em caso de falha, incluir pelo menos 1 print do erro e 1 print do contexto.
- Se houver bug aberto, incluir o código no nome ou no comentário do checklist.
