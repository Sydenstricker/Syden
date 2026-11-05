# O piloto do quarto em low poly

Feito em 05/11/2026, a pedido dele: "crie uma versão piloto do quarto em low poly e use o coelho 3D para testar". É uma
página de teste fora do app, para comparar com o quarto de pixel art (`e2e/pixel-art/quarto/novo/quarto/`). Nada disto
vai para o Syden.

**Abrir:** na raiz do repositório, `npx vite e2e/3D/quarto --port 5200` e abrir http://localhost:5200/.

| arquivo | o que é |
|---|---|
| `fotos/dia.png`, `fotos/noite.png` | **abrir primeiro:** o quarto de fábrica, de dia e de noite |
| `fotos/arrumado-sentado.png` | a poltrona arrastada e girada pelo Arrumar, com o coelho sentado nela |
| `fotos/deitado.png` | o coelho deitado na cama |
| `main.ts` | a cena inteira (three.js 0.186, o mesmo do tabuleiro do Cidades) |
| `modelos/` | os 53 móveis do KayKit Furniture Bits grátis (Kay Lousberg, CC0, `LICENCA-KayKit.txt`) e o `coelho.glb` (o mascote, de `web/scripts/cidades3d-coelho.py`) |

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

1. **O coelho não tem esqueleto aqui.** Deitar e sentar são o corpo inteiro posto no lugar, como peça de tabuleiro. Deitado
   passa, mas sentado ele está de pé dentro da poltrona. Para ficar bom, é preciso a malha com o NOSSO esqueleto (a do
   `blender/meshy/t/mascote.blend`) exportada com as animações, e a malha sentada que já estava pendente.
2. **Faltam peças com função no quarto:** guarda-roupa, porta, fone, quadro de fotos, cortiça e tapetes nas cores dele. A
   versão "Extra" do pacote (US$ 2 a 4) traz mais 20 peças e 3 texturas de cor, mas não se sabe quais.
3. **Os dois estilos não se misturam:** os móveis têm cor chapada, e o coelho do Meshy tem textura detalhada. Ao lado dos
   móveis isso aparece pouco, mas aparece.
4. **Uma skin é manter dois quartos.** A arrumação, o editor, a visita e as funções dos móveis teriam de ser refeitos aqui,
   e cada peça nova passaria a existir nos dois.
