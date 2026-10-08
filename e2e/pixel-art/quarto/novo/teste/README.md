# O teste: a base com móveis, e a luz por código

A pergunta, de 08/10/2026: se evoluirmos uma base da pasta `novo/`, pondo os móveis e a luz por código, chegamos
perto do conceito do ChatGPT? A base escolhida para o teste foi a **`pl-512-sem-1`**. A `pl-384-taverna` tem cara
de taverna, e o Sydenstricker a guardou como possível skin temática futura. **Abra `teste.html`**, ou veja `fotos/`.

## Como os móveis foram feitos (`moveis.mjs`)

- **Cada móvel é pintado DENTRO da base,** com o repintar do PixelLab (`inpaint-image-pro-flash`, 6 gerações) e o
  quarto inteiro como contexto. Assim ele sai com a mesma mão, a luz da janela e a sombra no chão. A ordem é de trás
  para a frente: criado-mudo com abajur, cama, estante, tapete.
- **Depois ele é recortado, e o recorte é fácil porque o fundo é conhecido:** o que mudou em relação ao passo
  anterior é o móvel. A sombra é separada pela cor: o que só escureceu, e por igual, é sombra e vira uma camada à
  parte (`pecas/<id>-sombra.png`), que escurece o que estiver embaixo de onde o móvel for parar.
- **A máscara é o pé do móvel na grade, erguido até a altura dele** (`chao.mjs`, `lista.mjs`; o desenho está em
  `ver-pes.png`). Com uma caixa solta, a ferramenta desenhou os móveis em escala real, pequenos num quarto grande
  (`falhas/`).
- **O pufe foi pintado em três lugares** (perto da janela, no meio e na frente): são as três versões de luz.

## O que a página faz (`montar.mjs`)

- De dia, os móveis são os recortes. O pufe se arrasta pela grade, usa a versão pintada mais perto e ganha só a
  intensidade da luz do lugar novo.
- De noite, o fundo é a noite da base (`noite.mjs`, feita por EDIÇÃO da base: mesma geometria, 25 gerações). Os
  móveis são a cor do dia vezes a razão noite/dia do quarto vazio, e o abajur acende por código: uma luz quente que
  cai com a distância.

## O que se viu

- **A qualidade é a da base:** bordas limpas, uma mão só, e os móveis com a luz e a sombra do quarto. O recorte e a
  remontagem não perdem nada visível.
- **A luz do abajur por código convence** à noite.
- **Ainda longe do conceito em DENSIDADE:** o quarto é grande, e os móveis saem em escala real mesmo com a máscara
  maior. O conceito é um quarto pequeno, cheio de coisas: plantas, quadros, prateleiras, objetos em cima dos móveis.
  O que falta é recheio e móveis maiores, não técnica.
- **As versões do pufe saíram de tamanhos diferentes** (a da janela é menor). Para as três versões de um móvel
  serem o mesmo móvel, a segunda e a terceira precisam partir da primeira (a primeira como referência, ou
  recortada e repintada só na luz).
- O abajur foi pintado aceso, com o brilho na parede, e isso fica também de dia.
- A separação da sombra pela cor tem casos difíceis: um cobertor cinza sobre a parede clara escurece por igual, como
  uma sombra. A regra ficou: no chão, a sombra pode ser forte e puxar para o azul; fora dele, só fraca.

## Custo

97 gerações: a noite (25) e doze repinturas de 6 (três delas falharam e estão em `falhas/`). Em 08/10/2026
**restam 1.149 das 2.000 do mês** (o `/balance` dá o que RESTA, não o que se gastou).
