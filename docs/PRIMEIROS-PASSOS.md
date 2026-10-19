# Primeiros passos

## Abrir e salvar

Baixe o instalador na [última versão](https://github.com/eronGreco/Recorte-Studio/releases/latest) e abra pelo atalho. Para executar o código-fonte, use `npm ci` e `npm start`. A tela abre um
projeto novo ou recupera a última sessão local. Use **Salvar** para guardar um
arquivo `.recorte` e **Abrir** para continuar depois.

O exemplo público `test/fixtures/demo.recorte` contém artes criadas para a
demonstração. Abra esse arquivo pelo botão **Abrir** para conhecer o fluxo.

## Preparar a arte

1. Importe uma imagem ou SVG. Uma imagem transparente pode gerar seu contorno
   automaticamente; para fundo opaco, ajuste a remoção do fundo da borda.
2. Defina o tamanho em milímetros. A proporção é mantida por padrão.
3. No painel de corte, escolha margem interna/externa, suavização e cantos.
   Confira as reentrâncias e detalhes pequenos na prévia.
4. Se precisar, ative a sangria e escolha uma arte de verso na própria peça.

As formas da barra lateral criam geometria vetorial. Para um furo de cordão,
desenhe um círculo e vincule-o à peça. Use as guias magnéticas para alinhar.

## Montar a folha

Ative as marcas de registro para o fluxo CAMEO. Configure a orientação da A4,
distâncias das bordas, comprimento, espessura e proteção do scanner.

Use **Encaixar na folha** depois de definir as medidas. Confira as peças que
ficaram fora da página: elas são mantidas no projeto e não entram no corte.
O verso acompanha automaticamente as posições correspondentes.

## Imprimir

Abra **Impressão**, selecione a forma de virar a folha e confira as duas faces.
Você pode imprimir ou salvar o PDF. Use **100% / tamanho real** no driver;
ajustar à página muda a distância física entre arte e marcas.

As guias e a seta de recolocação ajudam a repetir a orientação na bandeja.
A forma de carregar o papel depende da impressora; teste uma folha antes de
produzir um lote. Ajustes X/Y corrigem pequenos deslocamentos do verso.

## Testar o papel e cortar

Selecione uma predefinição de material ou seus ajustes pessoais. Em **Teste de
papel**, delimite uma área livre que comporte os seis testes A–F. O programa
mostra se a região é pequena demais ou invade peças e marcas.

Depois da leitura das marcas e dos testes, escolha o resultado que funcionou.
Se todos ficaram rasos ou profundos, informe o resultado e escolha outra área.
Use a reutilização explícita apenas quando a tentativa anterior não deixou
cortes que possam interferir na nova avaliação.

Fixe a folha à base, carregue a CAMEO e envie **Cortar**. A pausa e a parada no
programa esperam a passada atual terminar. A interrupção imediata é feita na
própria máquina. Não há retomada automática após desconexão ou fechamento forçado.
