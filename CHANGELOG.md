# Histórico de versões

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
