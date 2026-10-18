# Comunicação com a CAMEO 4

Transporte nativo Windows USBPRINT: VID `0B4D`, PID `1137`, acesso exclusivo e
I/O overlapped. O programa usa GPGL, com comandos terminados em ETX, coordenadas
de 20 unidades por milímetro e ordem vertical/horizontal nos comandos M/D.

## Requisitos

- Windows com o driver USB Printing Support.
- CAMEO 4 conectada por USB, AutoBlade no suporte 1, folha A4.
- Python 3.12+ disponível como `python` no PATH ou em `RECORTE_PYTHON`.
- Nenhum outro aplicativo usando a mesma interface USB.

Não é necessário instalar PyUSB ou substituir o driver por Zadig.

## Responsabilidades

- `machine-controller.mjs`: prepara e valida o trabalho no processo principal,
  conserva uma cópia durante o envio e registra o resultado.
- `project-cut-paths.mjs` / `path-job.mjs`: transformam a geometria do projeto
  em trajetos físicos, validam os limites e compilam os comandos.
- `registration-layout.mjs` / `machine-marks.mjs`: geometria comum para tela,
  impressão, organização da folha e preparação do corte.
- `scanner-protection.mjs`: áreas reservadas e proteção das marcas.
- `usb-transport.mjs`: contrato JSON entre Node e o worker Python.
- `cameo_worker.py`: enquadramento de respostas, execução e controle entre
  passadas. Mantém espaços significativos nas respostas de registro.
- `vendor/cameo4_backend.py`: rotinas nativas de I/O e protocolo. Sua licença
  está preservada em `vendor/LICENSE`.
- `calibration-service.mjs` / `calibration.mjs`: planejamento e histórico dos
  seis testes de papel, com seleção de resultado e reutilização explícita.
- `replay-transport.mjs`: equipamento simulado para ensaios sem USB.

## Comportamento e limites

O envio usa a geometria preparada, não acompanha alterações feitas no editor
depois de iniciar. Uma falha não repete automaticamente o corte. READY confirma
disponibilidade, não mede a profundidade física da lâmina nem a qualidade do corte.

Pausa e parada esperam uma passada inteira terminar. Retomar relê as marcas e
restaura os ajustes antes da próxima passada. Para interrupção imediata, use a
máquina. Pausa/retomada ainda precisa de validação física completa.

Há corte de produção confirmado em uma CAMEO 4. A geometria configurável e os
fluxos adicionais têm testes automatizados, mas não equivalem a uma validação
de todos os materiais, impressoras, firmwares e formatos. Outros modelos não
estão habilitados neste transporte.

## Testes sem equipamento

```powershell
npm test
npm run test:ui
```

Os testes usam respostas simuladas e perfis separados; não devem movimentar a
máquina. Não altere sequências USB, limites ou temporização sem evidência e testes.

Referência técnica pública: [comandos GPGL do inkscape-silhouette](https://github.com/fablabnbg/inkscape-silhouette/blob/main/Commands.md).
