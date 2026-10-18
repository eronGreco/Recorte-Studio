# Contribuir com o Recorte Studio

O objetivo principal é tornar o fluxo de arte, impressão e corte mais fácil de
entender e executar. Mudanças pequenas, com um problema claro e um resultado
visível, são mais fáceis de revisar.

## Preparar o ambiente

Use Windows, Node.js 24 e Python 3.12+. Execute `npm ci` e `npm start`.

Antes de enviar um PR:

```powershell
npm test
npm run test:ui
```

Os testes usam equipamento simulado e perfis próprios. Não inclua `data/`,
projetos pessoais, artes de terceiros, logs USB ou números de série num PR.

## UI/UX

- Coloque a opção perto da tarefa e use nomes que expliquem o resultado.
- Mantenha milímetros visíveis e deixe o usuário confirmar valores digitados.
- Preserve proporção, arte e posicionamento quando a intenção não for alterá-los.
- Não transforme preferências de visualização em alterações na geometria de corte.
- Mostre capturas do antes/depois com o projeto sintético de demonstração.

## Hardware

Para acrescentar um modelo ou alterar comandos, informe equipamento, firmware,
sistema, sequência relevante e resultado efetivamente observado. Separe ensaios
simulados de validação física. Uma resposta READY não comprova ajuste da lâmina.

Não habilite modelos por semelhança de nome nem use reenvio automático após uma
escrita de resultado incerto. Mudanças no protocolo precisam de testes e de
evidência sanitizada, sem identificadores pessoais.

## Relatar problemas

Informe a versão, os passos, o resultado esperado e o que aconteceu. Anexe um
exemplo mínimo criado para o relato. Para impressão, descreva orientação,
virada da folha e escala escolhida no driver.
