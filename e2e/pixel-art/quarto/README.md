# O quarto do coelho: o kit em pixel art e a página de teste

A home em pixel art (CLAUDE.md, "Gerar arte com IA"): o quarto do coelho, com os objetos clicáveis.
**Nada daqui entra no Syden ainda.** É o teste combinado: gerar o kit, montar fora do app e ver se agrada.

Feito em 07/10/2026. **Abra `quarto.html` no navegador.** Ou veja `foto-dia.png` e `foto-noite.png`.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `conceito.png` | O conceito feito no ChatGPT (cópia de `imagem/Sugestao/home.png`), a referência de tudo |
| `recortes.png` | Os pedaços do conceito usados como referência de cada peça |
| `pecas.mjs` | A lista do kit: cada peça, o recorte, o tamanho e a função na home |
| `gerar.mjs` | Gera peças: `node e2e/pixel-art/quarto/gerar.mjs <pixellab\|rd> <comparacao\|todas\|id,...>` |
| `saida/<ferramenta>/` | Tudo o que as ferramentas devolveram (o PixelLab devolve de 4 a 64 variações por chamada) |
| `paleta/` | As mesmas peças postas na paleta feita à mão (só as da comparação; ver abaixo) |
| `ver-*.png` | Folhas com as variações de cada peça, ampliadas (`ver.mjs`) |
| `limpar.mjs` | A variação escolhida de cada peça, sem as sobras, em `pecas/` |
| `montar.mjs` | Monta `quarto.html`: onde fica cada peça e o que cada objeto abre |
| `fotografar.mjs` | Tira `foto-dia.png` e `foto-noite.png` |
| `custos.jsonl` | Quanto cada chamada custou |

## A comparação: PixelLab ganhou

As mesmas três peças (cama, estante, coelho) nas duas ferramentas, com o conceito como referência:

- **PixelLab Pro** (`generate-with-style-v2`, com recortes do conceito como estilo): de **4 a 64 variações
  por chamada**, 20 gerações cada. Luz de dia, fiel ao conceito, e boa parte das variações serve. O coelho
  manteve o personagem em 16 de 16.
- **Retro Diffusion Pro** (`rd_pro__isometric`): **uma imagem por US$ 0,18**. A cama ficou boa, a estante veio
  cortada e com planta, e o coelho veio com fundo (a remoção falhou).

Com o plano de US$ 12 (2.000 gerações), o kit inteiro gastou 325 gerações. Sobraram 1.675. No Retro
Diffusion foram US$ 0,72 (quatro imagens); sobraram US$ 4,36.

## O que se aprendeu

- **A paleta feita à mão piorou as peças.** Posta cor por cor (`paleta/`), a coberta ficou roxa e a parede,
  laranja. O PixelLab já devolve as peças em cores que combinam entre si, porque o estilo vem do mesmo
  conceito. A paleta, se voltar, deve sair das próprias peças escolhidas, não ser imposta antes.
- **Peça de parede vem com a parede junto.** A janela, a porta e o mural trouxeram linhas de parede e chão.
  O `limpar.mjs` resolve com "fica só a maior mancha" ou com uma caixa. Peças soltas (cama, gato, vaso) vêm
  limpas.
- **Às vezes vem um brinde:** prateleira atrás da cama, mata-moscas, cesto. Também sai na limpeza.
- **A noite por código funciona.** Uma camada escura com a casca como máscara, e a luz do abajur e do monitor
  abrindo buracos nela. Uma arte só serve para os dois horários, e o entardecer é a mesma camada mais fraca.
- **Espelhar uma peça troca a parede dela:** a porta foi gerada para a parede direita e virou para a esquerda.

## Onde ficou cada função (proposta)

| Objeto | Abre |
|---|---|
| Abajur na estante | Dia e noite |
| Prateleira de livros | Novidades |
| Computador | Mini-games |
| Fone de ouvido | Salas de voz |
| Pôster do coelho | Coelhos (escolher o seu) |
| Varal de fotos | Amigos |
| Quadro de cortiça | Caixa de ideias |
| Porta | Explorar outra comunidade (e, um dia, sair para a cidade) |
| Vaso de cenouras | Plantar cenoura |
| Coelho | Cutucar |

**O guarda-roupa foi gerado e não coube:** o quarto tem 241 px, e um armário de 95 px cobre a cama ou a
janela. Está em `pecas/`, fora da montagem (`fora: true` em `montar.mjs`).

## Falta, se continuar

- Decidir o que fazer com o guarda-roupa (quarto maior, ou a função vai para outro objeto).
- Animar: o coelho respirando ou virando a página, o gato dormindo, o abajur. O PixelLab tem animação de
  objeto e de personagem.
- A janela à noite: hoje é a camada escura por cima do céu de dia. Uma versão noturna só da vista ficaria
  melhor.
- Ampliação: aqui é 3×. Na home, o tamanho tem de ser múltiplo inteiro (2×, 3×, 4×), conforme a tela.
