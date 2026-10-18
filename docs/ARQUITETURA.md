# Arquitetura

## Interface e geometria

`main.cjs` inicia o Electron, os diálogos de arquivo, a impressão/PDF e o
controlador de máquina. `preload.cjs` expõe uma API limitada ao renderer, com
isolamento de contexto e sem Node integrado à página.

`studio.html`, `studio.css` e `studio.js` compõem o editor. Paper.js representa
a arte e a geometria vetorial. Os módulos de transformações, alinhamento
magnético e cortes vetoriais concentram os comportamentos de edição.

`contours.mjs` e `sharp-contours.mjs` geram a geometria a partir da máscara da
imagem. O offset sempre deriva da imagem original. O controle de cantos fica
separado da suavização. Workers executam o cálculo de contornos, sangria e
encaixe sem concentrar todo o processamento na interação principal.

`production.mjs` mantém as peças, suas artes de verso, sangria, camadas,
duplicação, substituição de arte e exportações. Imagens compartilhadas são
deduplicadas no arquivo `.recorte`. `print-guides.mjs` calcula guias e orientação
física de virada da folha.

## Corte e impressão

A mesma geometria das marcas alimenta a prévia, as exportações e a proteção
usada no encaixe. O controlador recompila e valida o projeto antes do envio.
O trabalho preparado fica congelado: editar a tela não muda um corte em andamento.

O worker Python usa somente a biblioteca padrão e acessa USBPRINT no Windows.
O canal Node/Python transmite geometria e ajustes; não precisa enviar a arte a
um serviço externo. Veja [hardware/README.md](../hardware/README.md).

## Dados e testes

`data/` contém recuperação automática, biblioteca de materiais e históricos
locais. `projetos/` é o destino padrão dos arquivos salvos. Ambos são ignorados
pelo Git. `.test-output/` recebe os perfis e artefatos dos testes.

O exemplo em `test/fixtures/` usa arte sintética. `scripts/showcase.mjs` consegue
recriar o projeto e as capturas da documentação, sem usar a sessão do usuário.
