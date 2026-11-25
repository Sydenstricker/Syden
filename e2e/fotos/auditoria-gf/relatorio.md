# Auditoria de game feel — 25/11/2026

Seis jogos de ação, vistos pelo piloto automático no Solo, num Chrome sem janela, com o checklist de
`.claude/skills/auditoria-de-jogo/game-feel.md`. Ninguém mexeu nos jogos: só os scripts `e2e/auditoria-gf-*.mjs` e as
folhas desta pasta. **Jogado por gente: não.** Tremor e pausa não aparecem em foto; o som foi conferido só pelo código.

## Os defeitos (coisas que o código pede e não acontecem)

| Jogo | Defeito | Onde |
|---|---|---|
| Masmorra | A pausa no acerto é pedida (`impacto.acerto({ pausaMs: 50 })`) e nunca acontece: o laço não lê o `congelado` | JogoMasmorra.tsx ~497 e ~762 |
| Esquadrilha | O mesmo: a pausa de 60 ms ao perder vida é pedida e o `congelado` não é lido | JogoNave.tsx |
| Chefe | A toupeira nunca pisca ao levar golpe: `sombra()` devolve o alpha a 1 depois de ele ir a 0,45 | `desenharChefe` (chefe/desenho) |
| Comando | A gaiola aberta: o comentário promete o coelhinho "saindo pulando"; ele só some e sobem 5 pontinhos | desenho do Comando |

## As sugestões que mais pesam, por jogo

**Comando** (folhas `comando-*.png`)
1. A explosão da granada é um disco chapado que muda de cor: pede clarão curto, anel, fumaça subindo e lascas.
2. O bicho some ~100 ms antes de a fumaça aparecer (ela espera o atraso da rede), e a fumaça é pequena e parada: o
   `poof-pequeno` da Briga cabe (mesma escala), saindo onde o bicho está DESENHADO, como na Briga.
3. A faísca do acerto é quase invisível (~8 px); pausa de ~50 ms na faca e na morte do chefe.

**Masmorra** (`masmorra-*.png`; não capturados: o rei-cogumelo e as estrelas da cenoura)
1. Ligar a pausa que já está pedida (o defeito acima) e somar ~40 ms no golpe de pá que acerta.
2. O puf aparece ~150 ms depois de o bicho sumir, creme sobre chão pêssego (some no fundo).
3. O coração perdido só fica cinza: pede piscar ou rachar; o baú abre sem força.

**Arena** (`arena-*.png`; só saiu o cenário da Praia)
1. Nenhum impacto: sem pausa, sem tremor, sem clarão em quem leva (não usa o impacto.ts).
2. Os efeitos somem na areia clara (a fumaça creme de "caiu", o anel da marca, os números cinza).
3. O número do dano, a informação central da luta, está ilegível (10 px, cinza, sem contorno).

**Chefe** (`chefe-*.png`; não capturada a vitória)
1. O piscar da toupeira (o defeito acima).
2. O acerto próprio aparece 150–200 ms depois do contato (espera o servidor): mostrar a faísca na hora.
3. A bomba pede mais peso (clarão, anel, fumaça), e aparecer antes do véu vermelho quando fecha a fase.

**Caça** (`caca-*.png`; não usar `caca-acerto-12.png`)
1. A praga não reage ao tiro: passa direto à queda. Um piscar de 60–80 ms e uma pausa de ~40 ms.
2. O ×2/×3 aparece seco e some calado quando o combo quebra.
3. O erro não deixa marca; o clarão de tela inteira a cada tiro não sai com "menos movimento".

**Esquadrilha** (`nave-*.png`; ignorar `nave-levou-1` e `nave-bomba-1`, falsas; não capturados dano, bomba, loop)
1. O chefe cai com UMA explosão, os tiros dele ficam na tela e a nave some: pede uma sequência de explosões.
2. A pausa pedida e não lida (o defeito acima).
3. Sem clarão no cano; o bônus de onda (+500) só no número do placar.

## O pixelfx

- **Cabe:** Comando e Chefe (a mesma escala da Briga: reaproveitar `poof-pequeno` e `hit-spark-pequena`), Arena (a
  maior: 640×360, coelhos de 60–90 px, o efeito a ~60–70%), Masmorra (o poof a ~80%). Em todos, **sem a luz**: chão
  ou areia clara.
- **Não cabe:** Caça (arte vetorial lisa, o pixel quadrado destoa) e Esquadrilha (tela de 180×240, inimigos de 12–16 px;
  ela já tem a folha da Kenney na escala certa).

## Precisa de alguém jogando
O tremor e as pausas; o atraso da faísca do Chefe com 200 ms de rede; se o clarão da Caça cansa numa partida inteira; o
rei-cogumelo; levar dano, bomba e loop na Esquadrilha; a Arena nos outros cenários.
