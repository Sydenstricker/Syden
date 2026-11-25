---
name: auditoria-de-jogo
description: A etapa de auditoria do Syden ANTES DE IR AO AR, para tudo o que a pessoa vê ou ouve num mini-game, no quarto ou no salão. O pedido vira uma lista, o e2e joga e fotografa, um agente que NÃO fez a mudança confere item por item pelas fotos (feito / falta / quebrado), e os jogos passam pelo checklist de game feel. Use antes de commit/push de mudança visível em jogo ou cena, quando ele pedir "audite", "confira antes de subir", ou ao fechar um lote de melhorias.
---

# A auditoria antes de ir ao ar

**Decidido em 25/11/2026, por ele**, a partir do Claude Code Game Studios (MIT, Donchitos): *uma mudança que a pessoa vê
não está pronta até o jogo ter sido aberto, olhado e fotografado.* O motivo, nas nossas palavras: "escrito, não rodado" e
"ninguém jogou com gente" aparecem em dezenas de entradas do CLAUDE.md, e a auditoria de 10/11/2026 achou defeitos de arte
que só apareceram quando ele pintou o coelho de cores berrantes. Teste que passa não prova que a tela está certa.

Não substitui ninguém jogando. O relatório termina SEMPRE dizendo se alguém jogou com gente.

## 1. O pedido vira uma lista

Antes de olhar o código, escreva o que a pessoa vai VER ou OUVIR, um item por linha, cada um conferível numa foto ou num
número. Ruim: "melhorar a briga". Bom: "o 3º soco solta a faísca grande, na altura do peito, e ela some em menos de 1 s".
Inclua as regras do Syden que valem para a mudança (sem foco nada se mexe; "menos movimento" sem tremor; a tela não afirma
o que não é; nada só no botão direito; texto passa pelo `t()`).

## 2. O e2e joga e fotografa

- Cada item tem um e2e que LEVA ATÉ O MOMENTO por teclas por script ou pelo piloto automático do jogo
  (`window.<jogo>PilotoAutomatico`, só no site de desenvolvimento) e fotografa. Use um que já existe ou escreva um novo
  (o padrão de entrar sem chamada é o do computador do quarto: `e2e/caca.mjs`).
- Efeito, animação e transição não cabem numa foto: faça uma FOLHA DE QUADROS (o canvas copiado a cada ~70 ms numa grade,
  só quando o efeito está vivo). Modelo: `e2e/briga-pixelfx.mjs`.
- Mudou o visual de algo que já existia? Fotografe ANTES e DEPOIS, nas mesmas condições (um interruptor no localStorage
  serve; o mesmo arquivo).
- **Rode.** "Escrito, não rodado" não conta como auditado. Os servidores de teste estão na memória (teste-local-syden).
  Precisa do LiveKit e ele não está de pé? Diga isso no relatório; não marque como feito.

## 3. Quem confere não é quem fez

Mande a conferência a um agente NOVO (Agent, `general-purpose`), sem o seu raciocínio: só a lista, os caminhos das fotos e
o diff (`git diff`). Ele abre cada foto e responde, por item:

```
Você confere uma mudança visual num jogo do Syden, sem ter participado dela. Para cada item da lista, abra as fotos
indicadas (Read) e o diff, e responda com uma tabela: item | feito / falta / quebrado | a foto (e o quadro) que mostra |
o que viu. "Feito" só com a prova na foto. Procure também o que NÃO está na lista e está estranho na tela: corte, coisa
fora do lugar, texto sobrando, cor que não combina com o resto da cena, efeito grande demais para o personagem.
Lista: <itens>   Fotos: <caminhos>   Diff: <comando ou arquivo>
```

Desconfie do "feito" sem quadro citado. Item "falta" ou "quebrado" volta para o conserto, e a auditoria roda de novo
nesse item.

## 4. Game feel (só jogos)

Passe os momentos que a mudança tocou pelo [checklist de game feel](game-feel.md). Cada "não" vira uma sugestão no
relatório, não uma mudança automática: o que entra é decisão dele.

## 5. O relatório

Na resposta a ele, curto:

- a tabela da conferência (item, estado, foto);
- as fotos ou folhas principais (os caminhos em `e2e/fotos/`);
- o que o checklist de game feel sugeriu;
- **"Jogado por gente: não"** (ou quem jogou), e os números chutados.

Só com tudo "feito" se faz commit ou push de mudança visível. Se ele mandar subir antes, suba e registre o que ficou "falta".
