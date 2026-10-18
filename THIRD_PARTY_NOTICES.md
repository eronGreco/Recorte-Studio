# Componentes de terceiros

O código do Recorte Studio é distribuído sob [MIT](LICENSE). As dependências
mantêm suas próprias licenças, disponíveis nos respectivos pacotes e projetos.

- **Electron** — MIT. Ambiente desktop.
- **Paper.js** — MIT. Modelo de desenho e geometria vetorial.
- **Clipper Library / clipper-lib** — Boost Software License. Operações e offsets de polígonos.
- **Sharp** — Apache-2.0. Decodificação e processamento de imagens; seu binário
  inclui componentes com avisos adicionais fornecidos pelo pacote.
- **pdf-lib** — MIT. Ajustes e gravação de PDF.
- **DOMPurify** — Apache-2.0 ou MPL-2.0. Sanitização de SVG.
- **opentype.js** — MIT. Leitura e conversão de fontes em geometria.
- **Playwright** — Apache-2.0. Testes de interface e capturas automatizadas.

Os avisos dos pacotes transitivos permanecem nos pacotes instalados por npm.
As fontes do sistema são lidas da instalação local do usuário e não são
redistribuídas neste repositório.

O backend nativo em `hardware/vendor/` conserva seu aviso MIT em
[`hardware/vendor/LICENSE`](hardware/vendor/LICENSE).

O logo vetorial e as artes de demonstração em `test/fixtures/` fazem parte
deste projeto e seguem a licença MIT do repositório.
