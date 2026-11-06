/** A jogada honesta dos microjogos do LOTE 1 (para a partida aleatória de minijogos-festa.test.ts): true se o id é do lote. */
import { deslocamento, type DadosRetrato } from '../src/festa/retrato.js';
import { fimDaDanca, type DadosDanca } from '../src/festa/danca.js';
import { PRIMEIRA_SAIDA_MS, type DadosMultidao } from '../src/festa/multidao.js';
import { fimDosPasseios, ondeFica, type DadosPortas } from '../src/festa/portas.js';
import { figuraNaJanela, type DadosTrinca } from '../src/festa/trinca.js';
import type { DadosPotes } from '../src/festa/potes.js';
import { travessia, type DadosBarraca } from '../src/festa/barraca.js';

type Jogo = { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null };

export function jogadaHonestaDoLote1(
  micro: string,
  jogo: Jogo,
  quem: number,
  { andar, avancar }: { andar: () => void; avancar: (ms: number) => void },
): boolean {
  const dados = jogo.publico(quem).dados;
  if (micro === 'retrato') {
    // para a primeira faixa no lugar (as outras contam como as piores, mas vale)
    const d = dados as DadosRetrato;
    let t = 300;
    while (deslocamento(d.faixas[0], t) !== 0) t++;
    avancar(t + 100);
    jogo.acao(quem, { tipo: 'acerto', t });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'danca' || micro === 'portas') {
    // a pergunta só vem quando a dança (ou os passeios) acaba
    andar();
    avancar(800);
    if (micro === 'danca') {
      const d = jogo.publico(quem).dados as DadosDanca;
      jogo.acao(quem, { tipo: 'resultado', bicho: d.ordem[d.pergunta], t: fimDaDanca(d) + 700 });
    } else {
      const d = jogo.publico(quem).dados as DadosPortas;
      jogo.acao(quem, { tipo: 'resultado', toca: ondeFica(d)[d.pergunta], t: fimDosPasseios(d) + 700 });
    }
  } else if (micro === 'multidao') {
    // o bicho só vem quando o primeiro coelho sai
    andar();
    avancar(2000);
    const d = jogo.publico(quem).dados as DadosMultidao;
    jogo.acao(quem, { tipo: 'resultado', bicho: d.bicho, t: PRIMEIRA_SAIDA_MS + 1900 });
  } else if (micro === 'trinca') {
    // uma trinca: para cada rolo quando ele mostra a primeira figura do primeiro rolo, andando o tempo junto
    const d = dados as DadosTrinca;
    const alvo = d.rolos[0].figuras[0];
    let t = 300;
    let ja = 0;
    for (let r = 0; r < 3; r++) {
      if (r) t += 120;
      while (figuraNaJanela(d.rolos[r], t) !== alvo) t++;
      avancar(t + 50 - ja);
      ja = t + 50;
      jogo.acao(quem, { tipo: 'acerto', t });
    }
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'potes') {
    // abre o primeiro pote, girando a cada 120 ms
    const d = dados as DadosPotes;
    const t = 400 + d.potes[0].voltas * 120;
    avancar(t + 100);
    jogo.acao(quem, { tipo: 'acerto', i: 0, t });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'barraca') {
    // acerta o primeiro corvo no meio da barraca
    const d = dados as DadosBarraca;
    const i = d.figuras.findIndex((f) => !f.coelho);
    avancar(d.figuras[i].t + travessia(d.figuras[i]) / 2);
    jogo.acao(quem, { tipo: 'acerto', i });
    jogo.acao(quem, { tipo: 'resultado' });
  } else return false;
  return true;
}
