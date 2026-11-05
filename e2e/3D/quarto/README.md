# O piloto do quarto em low poly

Feito em 05/11/2026, a pedido dele: "crie uma versão piloto do quarto em low poly e use o coelho 3D para testar". É uma
página de teste fora do app, para comparar com o quarto de pixel art (`e2e/pixel-art/quarto/novo/quarto/`). Nada disto
vai para o Syden.

**Abrir:** na raiz do repositório, `npx vite e2e/3D/quarto --port 5200` e abrir http://localhost:5200/.

| arquivo | o que é |
|---|---|
| `fotos/dia.png`, `fotos/noite.png` | **abrir primeiro:** o quarto de fábrica, de dia e de noite |
| `fotos/deitado.png`, `sentado-sofa.png`, `sentado-poltrona.png`, `no-computador.png` | o coelho usando os móveis, com as poses de verdade |
| `main.ts` | a cena inteira (three.js 0.186, o mesmo do tabuleiro do Cidades) |
| `modelos/` | o KayKit Bits Bundle 1 (Kay Lousberg, CC0, `LICENCA-KayKit-Bundle.txt`): os móveis inteiros do Furniture Bits (com as 3 texturas de cor em `texturas/`) e as paredes, a janela e a porta do Restaurant Bits (`restaurante/`); e o `coelho-animado.glb` |

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
2. **Faltam peças com função no quarto:** guarda-roupa, porta, fone, quadro de fotos, cortiça e tapetes nas cores dele. A
   versão "Extra" do pacote (US$ 2 a 4) traz mais 20 peças e 3 texturas de cor, mas não se sabe quais.
3. **Os dois estilos não se misturam:** os móveis têm cor chapada, e o coelho do Meshy tem textura detalhada. Ao lado dos
   móveis isso aparece pouco, mas aparece.
4. **Uma skin é manter dois quartos.** A arrumação, o editor, a visita e as funções dos móveis teriam de ser refeitos aqui,
   e cada peça nova passaria a existir nos dois.
