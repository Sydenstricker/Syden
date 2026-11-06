# O piloto do quarto em low poly

Feito em 05/11/2026, a pedido dele: "crie uma versão piloto do quarto em low poly e use o coelho 3D para testar". É uma
página de teste fora do app, para comparar com o quarto de pixel art (`e2e/pixel-art/quarto/novo/quarto/`). Nada disto
vai para o Syden.

**NO APP desde 06/11/2026** (pedido dele: "quero esse quarto 3D low poly como PILOTO da nossa funcionalidade de variação
estética"): `web/src/quarto3d/cena.ts` é esta cena trazida para o app, com as funções do quarto de pixel art nos objetos, o
coelho com as cores do avatar seguindo o estado de verdade, e o botão do canto que alterna 3D e pixel art
(`web/src/QuartoComEstilo.tsx`). Os modelos usados foram copiados para `web/public/quarto3d/`. Fotos: `fotos/no-app-*.png`;
teste: `e2e/quarto3d.mjs`. Esta página
continua sendo o lugar de experimentar (Arrumar, Girar), e o que mudar aqui não vai sozinho para o app.

**Abrir:** na raiz do repositório, `npx vite e2e/3D/quarto --port 5200` e abrir http://localhost:5200/.

| arquivo | o que é |
|---|---|
| `fotos/dia.png`, `fotos/noite.png` | **abrir primeiro:** o quarto de fábrica, de dia e de noite |
| `fotos.mjs` | refaz as seis fotos (com o vite no ar: `ENDERECO=http://localhost:5200/ node e2e/3D/quarto/fotos.mjs`; `SO_HORA=1` só dia e noite) |
| `fotos/deitado.png`, `sentado-sofa.png`, `sentado-poltrona.png`, `no-computador.png` | o coelho usando os móveis, com as poses de verdade |
| `main.ts` | a cena inteira (three.js 0.186, o mesmo do tabuleiro do Cidades) |
| `modelos/` | o KayKit Bits Bundle 1 (Kay Lousberg, CC0, `LICENCA-KayKit-Bundle.txt`): os móveis inteiros do Furniture Bits (com as 3 texturas de cor em `texturas/`) e as paredes, a janela e a porta do Restaurant Bits (`restaurante/`); o Kenney Furniture Kit (CC0, `kenney/`, `LICENCA-Kenney-Furniture-Kit.txt`); e o `coelho-animado.glb` |

## A segunda rodada (05/11/2026, à tarde)

Ele baixou o pacote completo ("use eles para compor o quarto com maior qualidade"). O quarto foi refeito com ele: as paredes, a
janela com cortina e a porta são peças do Restaurant Bits, e entraram a mesa de computador completa (monitor, teclado, mouse, o
abajur de mesa com o fone, o porta-lápis), o sofá, a mesa de centro com o videogame e a caneca, e a cômoda. A luz ficou mais clara
e macia, como nas fotos do pacote, e o sol vem do alto, do lado aberto. O quarto continua com ~1 ms por quadro.

**O coelho agora tem o NOSSO esqueleto** (o arquivo do Meshy que ele baixou é o mesmo `mascote-t.glb`, com o esqueleto de gente e
só "Walking" e "Running"). `e2e/pixel-art/personagem/blender/meshy/glb.py` grava as poses do motor do quarto de pixel art como
animações de um GLB (`:MODELO='t'; :GLB='1'; powershell -File rodar.ps1`, ~10 s): parado, andando, falando, sentado,
sentado no sofá, poltrona, banqueta, computador, dormindo, largado e lendo. Ele anda de verdade, senta na poltrona, no sofá e na
cadeira do computador (com as mãos no teclado) e deita na cama. Sai em `web/public/cidades3d/coelho-animado.glb` (650 KB).

## A terceira rodada: o Kenney Furniture Kit junto (05/11/2026, à noite)

Ele baixou o Kenney Furniture Kit (CC0, 140 peças) para deixar o quarto mais rico. **Os dois pacotes foram misturados, mas só
nas peças em que combinam** — o que se mediu:

- **O que entrou do Kenney (12 peças, em `modelos/kenney/`):** a estante aberta com os livros nas prateleiras (`bookcaseClosedWide`
  + `books`, o rádio e duas plantinhas), o guarda-roupa (`bookcaseClosedDoors`), a planta grande debaixo da janela
  (`pottedPlant`), as plantinhas `plantSmall1–3` (na estante, na prateleira da mesa e no banquinho), o tapete redondo em
  terracota no canto da leitura (`rugRound`), o capacho da porta (`rugDoormat`), o pufe da poltrona (`loungeSofaOttoman`, a 75%)
  e a caixa de papelão aberta no canto (`cardboardBoxOpen`).
- **A escala:** o Kenney entra com 2 (a mesa dele tem 0,38 de altura, a do KayKit em 0,75 tem 0,75), e as alturas batem.
- **As cores do Kenney são trocadas pelas do KayKit, pelo nome do material** (`PALETA_KENNEY` em `main.ts`): o estofado e o tapete
  dele vêm vermelho-vivo e a planta verde-menta, que brigavam com o amarelo, o azul-claro e o verde do KayKit. A madeira ficou
  um tom do KayKit, e o brilho de metal saiu. Cada peça ainda troca as suas (`cores`: a terracota do tapete, os livros).
- **O que saiu de novo, por não combinar: tudo o que é REDONDO no Kenney.** O ursinho na cama e a arandela da parede foram
  testados e tirados: o Kenney é facetado (faces chapadas, sem o chanfro macio do KayKit), e numa peça curva a faceta aparece
  — o ursinho virou um bloco marrom de arestas, e a arandela, um papel dobrado. Nas peças de caixa (estante, armário, tapete,
  caixa, pufe) a diferença quase não se vê. As almofadas do Kenney também saíram: no sofá e na poltrona do KayKit elas já vêm.
- **Feito por código, porque nenhum dos dois tem:** a **cortiça** (Caixa de ideias) com quatro bilhetes e tachinhas, as **fotos
  no quadro** de Amigos (quatro fotos de papel desenhadas, sem foto de ninguém: o branco da moldura do KayKit era uma tela vazia)
  e as **luzinhas** no alto das duas paredes (o fio do salão de pixel art), acesas à noite, com uma luz por parede.
- **As funções do quarto do app estão nos móveis:** tocar no guarda-roupa, na mesa (Mini-games; o fone no abajur dela, Salas), no
  quadro (Amigos), na cortiça (ideias), na janela (Explorar) ou no abajur (Dia e noite) leva o coelho até lá, e a barra diz qual
  seria a função. Só diz: o piloto não abre nada.
- **A poltrona virou de frente** (na segunda rodada ela ficava de costas para a câmera e escondia o coelho sentado), com o pufe,
  o tapete redondo, a luminária e o banquinho em volta. A cômoda e a prateleira da parede do fundo saíram para a estante e o
  guarda-roupa caberem ao lado da porta.
- **O fundo da página** é o roxo escuro e quente da barra, no lugar do preto.
- **Medido (Chrome sem placa, depois de os shaders compilarem):** ~2 a 3 ms por quadro, de dia e de noite, 205 chamadas e
  ~48 mil triângulos (eram 82 chamadas: cada livro do Kenney tem 4 materiais). As lâmpadas das luzinhas são 3 malhas
  instanciadas, não 60; `?sem-luz-das-luzinhas` tira as duas luzes delas para medir (a diferença não apareceu).

## O que o piloto faz

- **A grade 8 × 8** do quarto de pixel art, com as duas paredes do fundo. **Arrumar:** tocar num móvel, arrastar e
  apertar R para girar. Os 4 lados saem de graça, sem desenho a mais, e o que está em cima (o abajur no criado-mudo, o
  monitor e o cacto na mesa, os livros na mesinha) anda e gira junto.
- **A luz é de verdade.** De dia, o sol entra PELA JANELA (a parede tem o vão) e desenha a mancha no chão. À noite acendem
  o abajur e a luminária (que também se ligam com um toque), e o monitor brilha.
- **O coelho** anda pulando pela grade, desviando dos móveis, deita na cama e senta na poltrona e na cadeira.
- **O que o pacote não tem foi feito por código,** nas mesmas cores chapadas: o chão de tábuas, as paredes com o lambri, a
  janela e o monitor.

## O que se mediu

- **~1 ms por quadro,** de dia e de noite, com as sombras do sol ligadas: 82 chamadas e ~34 mil triângulos.
- **A sombra de luz pontual é cara:** com a sombra do abajur, a noite foi a 20 ms por quadro, porque são seis desenhos a
  mais. Por isso o abajur ilumina, mas não faz sombra.

## O que falta, e é o que decide

1. **O coelho já tem esqueleto e poses** (a segunda rodada). Falta o andar pelo caminho de verdade até o lado certo da cama.
2. **As peças com função já estão todas** (terceira rodada), mas o fone continua no abajur da mesa, e não pendurado na parede
   como no quarto de pixel art: nenhum dos dois pacotes tem um fone de gancho. Também faltam o ventilador (o `ceilingFan` do
   Kenney pede teto, e a vista isométrica não tem), um gato, e as camas para trocar. Os tapetes nas cores do quarto (sálvia,
   terracota, azul, mostarda) saem de graça, trocando a cor do material do Kenney.
3. **Os dois estilos não se misturam:** os móveis têm cor chapada, e o coelho do Meshy tem textura detalhada. Ao lado dos
   móveis isso aparece pouco, mas aparece. **Entre os dois pacotes**, o Kenney serve para o que é caixa (estante, armário,
   tapete, caixa) e não para o que é curvo (bicho, luminária, almofada), pela faceta. Se um dia for ao app, o KayKit é a base, e o
   Kenney entra só onde falta peça.
4. **Uma skin é manter dois quartos.** A arrumação, o editor, a visita e as funções dos móveis teriam de ser refeitos aqui,
   e cada peça nova passaria a existir nos dois.
5. **À noite, a estante e o guarda-roupa ficam escuros** (estão longe do abajur e das luzes das luzinhas); uma luz a mais ali custaria
   em todo pixel do quarto.
