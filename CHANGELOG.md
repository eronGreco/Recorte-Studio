# Histórico de versões

## [0.12.2](https://github.com/eronGreco/Recorte-Studio/releases/tag/v0.12.2) — 2026-10-24

Esta publicação reúne as mudanças desenvolvidas desde a 0.10.0, incluindo as versões locais 0.11.0 a 0.12.1.

### Projetos, edição e interface

- Projetos em abas na base da janela, com objetos, ajustes, seleção, desfazer e recuperação automática independentes. Abrir ou criar um projeto preserva os anteriores; abas fechadas podem ser reabertas.
- Um trabalho por vez na CAMEO, identificado pelo projeto de origem; outra aba não controla esse envio. Calibrações e áreas de teste ficam separadas por projeto.
- Janela Cortar reorganizada em material/ajustes e prévia, com busca e seleção no mesmo campo, calibração em destaque e diagnóstico recolhido.
- Camadas com miniaturas, busca, reordenação por arrasto, indicação de soltura, recolhimento e opacidade com desfazer; menu do botão direito nas peças e na lista.
- Cursores acompanham o redimensionamento de peças giradas; ajudas explicam finalidade, uso e exemplos; avisos de modais ficam legíveis junto da tarefa.
- Grade com nomes e explicações claros; tela inicial pode ser fechada para começar só com formas, linhas ou texto.
- Ícones próprios no aplicativo, instalador e atalhos, com conferência automática dos executáveis.

### Impressão e tamanhos de folha

- PDF com apenas a frente quando não há verso; seleção das faces e nome do projeto na impressão. A primeira arte sugere o nome e renomear ao salvar atualiza as próximas exportações.
- Recuar o corte preserva a margem colorida impressa; sangria, encaixe e reservas do scanner consideram essa margem.
- Formatos A6, A5, A4, A3, Carta, Ofício US, base de 12 polegadas e medidas personalizadas, com orientação independente. As marcas usam o tamanho real da folha; Print & Cut aceita lados de 60 a 304,8 mm, sujeito às margens.

### Envio de contornos longos à CAMEO

- Corrigido o envio único de trajetos longos que podia exceder o prazo de confirmação USB após iniciar o corte. O worker agora envia blocos de até 1024 bytes, termina cada comando e aguarda READY antes do próximo bloco.
- Geometria, posições, sobrecorte e ajustes são preservados. Uma escrita incerta não é repetida automaticamente; os registros identificam contorno, passada, bloco e bytes confirmados.
- Regressões cobrem trajetos longos, buffer simulado, falha parcial, perda de READY, pausa/retomada e calibração. A alteração USB e os novos formatos ainda precisam de confirmação física; os testes desta publicação não movimentam a máquina.

[Comparar com a versão 0.10.0](https://github.com/eronGreco/Recorte-Studio/compare/v0.10.0...v0.12.2).

## 0.12.1 — 2026-10-21

- Abas dos projetos na base da área de trabalho, com cabeçalho no topo e controles de fechar/criar com tamanhos e destaques contidos em seus limites.
- Botões das abas mantêm sua identidade durante o salvamento e o progresso da máquina, preservando foco e interação do mouse. Nomes longos não encobrem o fechamento.
- Seção Grade de apoio: Mostrar grade, Prender à grade e Espaçamento em milímetros, com explicação, exemplo e distinção da organização automática.
- Verificação visual com pixels dos destaques e teste de janela mínima. Os testes das abas usam a altura real das áreas de edição.

## 0.12.0 — 2026-10-21

- Projetos em abas independentes, com seleção, histórico, trabalhadores e recuperação automática separados. Novo projeto e abrir arquivo mantêm os anteriores abertos.
- Abas fechadas podem ser reabertas; a sessão inteira é recuperada ao reiniciar. Ctrl+N, Ctrl+W, Ctrl+Tab e Ctrl+Shift+T.
- Um envio por vez à CAMEO, vinculado ao projeto de origem. Outra aba não pode controlar o trabalho; calibrações e áreas de teste têm histórico próprio por projeto.
- Modal Cortar reorganizado em material/ajustes e prévia dos contornos. Busca e seleção de material no mesmo campo, calibração em destaque e diagnóstico recolhido. Removidos encaixe e alteração de folha desse modal.
- Avisos dentro dos modais permanecem legíveis; marcas ausentes têm orientação e botão de configuração junto à calibração. Folhas vazias também abrem a calibração.
- Verificação da AutoBlade identificada como diagnóstico do indicador, separada do teste de corte do papel.
- Testes de abas, reinício, bloqueio entre projetos, calibração isolada, busca por mouse/teclado e janela mínima; comandos USB somente em simulação.

## 0.11.2 — 2026-10-20

- Revisão das ajudas de corte, sangria, arte, camadas, papel, registro e edição, com finalidade, instruções e exemplos.
- Uma única ajuda por assunto nas marcas: posição, dimensões e proteção do scanner. Removida a coleta automática que acumulava três botões no mesmo título.
- Explicações da lâmina, força, velocidade, passadas e sobrecorte em parágrafos legíveis junto ao botão de ajuda, sem disparar sobre campos.
- Textos dos botões e ferramentas esclarecem o efeito das ações; a ajuda de Retomar explica a releitura das marcas.
- Conferência visual e testes de ajudas na janela mínima de 1100 × 720.

## 0.11.1 — 2026-10-20

- Reordenação de camadas aceita arrastar o título ou a alça e soltar sobre o cartão ou nos espaços da lista, nos dois sentidos.
- Cursores de redimensionamento acompanham a inclinação da seleção; giro tem cursor próprio e o movimento da tela mantém mão aberta/fechada.
- Regressão com entrada real de mouse cobre camada 3 acima da 4, camada 4 abaixo da 3, desfazer, persistência e os oito puxadores em imagens giradas.

## 0.11.0 — 2026-10-20

- PDF gera somente a frente quando não há arte de verso na folha; seletor de faces e nome do projeto na impressão.
- Recuo da linha de corte preserva a margem colorida original na impressão; sangria, encaixe e proteção do scanner consideram essa margem.
- Camadas com miniaturas, busca, alças de arraste, posição de soltura explícita, reordenação, recolhimento, exclusão de camadas vazias e opacidade com desfazer.
- Menu de contexto na imagem e nas peças da lista, com copiar, duplicar, ordenar, trocar arte e acesso ao corte/sangria.
- Formatos A6, A5, A4, A3, Carta, Ofício US, 12 polegadas e personalizado, com orientação independente.
- Marcas e comandos usam o tamanho real da folha; faixa de Print & Cut da CAMEO 4 de 60 a 304,8 mm por lado, sujeita às margens. A4 mantém os mesmos comandos anteriores; novos formatos ainda requerem teste físico.
- Nome inicial vem da primeira arte; salvar com outro nome atualiza o projeto e as próximas exportações.
- Testes de PDF de uma/duas faces, dimensões físicas, margem de tinta, menu de contexto e reordenação de camadas; USB validado por simulação, sem novos cortes físicos.

## [0.10.0](https://github.com/eronGreco/Recorte-Studio/releases/tag/v0.10.0) — 2026-10-19

- Primeiro instalador para Windows x64, com atalhos, escolha da pasta e dependências incluídas.
- Python 3.13.16 embutido para a comunicação USB, sem exigir instalação separada; pacote oficial conferido por SHA-256.
- Consulta ao GitHub em toda inicialização com avisos distintos para atualização disponível, versão atual e falha de consulta.
- Verificação manual na ajuda e acesso à página da versão; nenhuma instalação automática durante o uso ou corte.
- Dados da versão instalada ficam na pasta do usuário e são preservados nas atualizações; os projetos não são gravados na pasta do programa.
- Construção, teste do aplicativo empacotado e publicação do instalador automatizados no GitHub, com arquivo de checksums.
- Atualização das ações do GitHub para remover os avisos de runtime antigo; falhas históricas dos testes de arrasto permanecem corrigidas.
- Testes de versão, rede indisponível, limites do GitHub, timeout, avisos de interface e execução sem Node/Python no PATH.

## [0.9.2](https://github.com/eronGreco/Recorte-Studio/releases/tag/v0.9.2) — 2026-10-18

Esta publicação reúne as melhorias desenvolvidas nas versões locais 0.9.0 a 0.9.2.

### Interface e navegação

- Barras reorganizadas por tarefa: **Peça, Corte, Sangria, Arte, Camadas e Folha**, com ícone e texto sempre visíveis.
- Sangria ganha uma área própria; as ferramentas à esquerda ficam agrupadas em edição, formas e texto, preparação de corte e projeto.
- Ícones vetoriais consistentes e novo ícone de mão para mover a tela.
- Ajuda explicativa junto ao botão **?**, sem abrir ao passar pelos campos de edição.
- Campos, controles de cor e espessura e título do projeto alinhados na barra estreita; navegação verificada na janela mínima de 1100 × 720.

### Seleção e proteção da arte

- Abas de Corte, Sangria e Arte ficam indisponíveis quando não se aplicam à seleção; a navegação por teclado ignora as abas desativadas.
- Seleção múltipla explica que tamanho, posição, rotação e alinhamento afetam as peças como conjunto.
- Imagens e cortes prontos deixam de oferecer preenchimento, contorno de pintura ou conversão automática, inclusive em seleções múltiplas e mistas.
- Eventos de pintura também validam a seleção, protegendo a arte e as linhas de corte. Preenchimentos indevidos de contornos antigos são removidos ao abrir projetos.
- Preparação automática atua somente nos desenhos elegíveis e mantém os resultados selecionados.

### Contornos e suavização

- Suavização passa a filtrar irregularidades, com intensidade de **0 a 100%**, em vez de aumentar a simplificação até deformar curvas.
- Preservação de pontas e encontros em V continua independente da intensidade de suavização.
- Bordas calculadas corretamente após redimensionamento independente nos dois eixos.
- Mais precisão nas medidas salvas para evitar alterações no contorno ao desfazer ou reabrir projetos.
- Cache de sangria atualizado para acompanhar os contornos recalculados.

### Documentação e verificação

- Imagens e projeto de demonstração atualizados para a nova interface.
- Testes adicionais de seleção, seleção múltipla, barras laterais e suavização; cenários existentes adaptados à navegação por tarefas.

[Comparar com a publicação anterior](https://github.com/eronGreco/Recorte-Studio/compare/86db48718816d4a8332ff504c307b6669f8908ae...v0.9.2).

## 0.8.1 — publicação inicial do código

- Editor de arte e contornos com offset, suavização e preservação de pontas.
- Sangria simulada, verso vinculado e exportação SVG/PDF.
- Encaixe com proteção das marcas, camadas e alinhamento magnético.
- Formas vetoriais de corte, furos vinculados e transformações precisas.
- CAMEO 4 via USBPRINT, materiais, sobrecorte e calibração A–F.
- Progresso em segundo plano e controles de envio entre passadas.
- Guias de impressão e orientação de virada da folha.
- Identidade visual, exemplo público sintético e documentação de instalação.
- Testes portáveis e perfis separados da sessão de uso.
