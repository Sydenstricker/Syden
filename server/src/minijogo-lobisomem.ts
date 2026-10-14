import { embaralhar, type Definicao } from './minijogo-motor.js';

/**
 * O LOBISOMEM, o melhor jogo de todos para jogar por voz: ele É a conversa. O Syden faz o papel do narrador
 * (que no jogo de mesa é uma pessoa que não joga): sorteia os papéis em segredo, conduz a noite e o dia, conta
 * os votos e anuncia quem morreu.
 *
 * - NOITE: os lobisomens escolhem juntos quem atacar; a vidente descobre se alguém é lobisomem; o anjo
 *   protege alguém. Cada um faz isso na própria tela, e ninguém mais vê.
 * - DIA: o Syden conta quem morreu na noite (e o papel de quem morreu). A turma discute pela voz e vota em
 *   quem acha que é lobisomem; o mais votado sai do jogo. Empate ou "ninguém" mais votado: ninguém sai.
 * - FIM: a vila vence quando não sobra lobisomem; os lobisomens vencem quando são tantos quanto o resto.
 *
 * O SEGREDO É O QUE SEGURA O JOGO, e por isso o estado é pedido por pessoa: cada um recebe só o próprio
 * papel; o lobisomem vê também os outros lobisomens e os votos deles; a vidente vê o que já descobriu. O
 * papel de quem morre fica aberto para todos — como no jogo de mesa.
 */

export type Papel = 'lobisomem' | 'vidente' | 'anjo' | 'aldeao';

export const MINIMO_LOBISOMEM = 4;
export const NOITE_MS = 45_000;
export const AMANHECER_MS = 7_000;
export const DIA_MS = 150_000;
export const VEREDITO_MS = 7_000;

/** Os papéis para `n` pessoas: um lobisomem a cada quatro (no máximo três), vidente sempre, anjo a partir de 5. */
export function papeisPara(n: number): Papel[] {
  const lobos = Math.min(3, Math.max(1, Math.floor(n / 4)));
  const papeis: Papel[] = [...Array<Papel>(lobos).fill('lobisomem'), 'vidente'];
  if (n >= 5) papeis.push('anjo');
  while (papeis.length < n) papeis.push('aldeao');
  return papeis;
}

/** O mais votado; empate (ou nenhum voto) dá null. `0` é o voto em ninguém. */
export function maisVotado(votos: Iterable<number>): number | null {
  const contagem = new Map<number, number>();
  for (const v of votos) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  let melhor: number | null = null;
  let maximo = 0;
  let empate = false;
  for (const [alvo, n] of contagem) {
    if (n > maximo) {
      melhor = alvo;
      maximo = n;
      empate = false;
    } else if (n === maximo) empate = true;
  }
  return empate || melhor === 0 ? null : melhor;
}

type Fase = 'noite' | 'amanhecer' | 'dia' | 'veredito' | 'fim';

export const lobisomem: Definicao = {
  minimo: MINIMO_LOBISOMEM,
  comecar(ctx, { naSala }) {
    if (naSala.length < MINIMO_LOBISOMEM) return 'O Lobisomem precisa de pelo menos 4 pessoas na sala.';
    const sorteio = embaralhar(papeisPara(naSala.length));
    const papel = new Map(naSala.map((id, i) => [id, sorteio[i]]));
    const vivos = new Set(naSala);
    let fase: Fase = 'noite';
    let dia = 1;
    /** Os votos da noite dos lobisomens: lobisomem → alvo. */
    const ataque = new Map<number, number>();
    let protegido: number | null = null;
    let viuHoje = false;
    /** O que a vidente já descobriu, em ordem. */
    const visoes: { alvo: number; lobisomem: boolean }[] = [];
    /** Os votos do dia: quem vota → alvo (0 = ninguém). São abertos, como de mão levantada. */
    const votos = new Map<number, number>();
    let mortoDaNoite: number | null = null;
    let eliminado: number | null = null;
    let vencedor: 'vila' | 'lobisomens' | null = null;

    const vivosCom = (p: Papel) => [...vivos].filter((id) => papel.get(id) === p);
    const lobosVivos = () => vivosCom('lobisomem');

    function verificarFim(): boolean {
      const lobos = lobosVivos().length;
      if (lobos === 0) vencedor = 'vila';
      else if (lobos >= vivos.size - lobos) vencedor = 'lobisomens';
      if (!vencedor) return false;
      fase = 'fim';
      ctx.terminar();
      return true;
    }

    function noite() {
      fase = 'noite';
      ataque.clear();
      protegido = null;
      viuHoje = false;
      ctx.agendar(NOITE_MS, amanhecer);
      ctx.avisar();
    }

    /** A noite acaba quando cada papel com ação já agiu (ou o tempo acaba). */
    function noiteCompleta() {
      const lobosDecidiram = lobosVivos().every((id) => ataque.has(id));
      const videnteViu = vivosCom('vidente').length === 0 || viuHoje;
      const anjoAgiu = vivosCom('anjo').length === 0 || protegido !== null;
      return lobosDecidiram && videnteViu && anjoAgiu;
    }

    function amanhecer() {
      if (fase !== 'noite') return;
      const alvo = maisVotado(ataque.values()) ?? [...ataque.values()][0] ?? null;
      mortoDaNoite = alvo !== null && alvo !== protegido && vivos.has(alvo) ? alvo : null;
      if (mortoDaNoite !== null) vivos.delete(mortoDaNoite);
      if (verificarFim()) return;
      fase = 'amanhecer';
      ctx.agendar(AMANHECER_MS, () => {
        fase = 'dia';
        votos.clear();
        ctx.agendar(DIA_MS, veredito);
        ctx.avisar();
      });
      ctx.avisar();
    }

    function veredito() {
      if (fase !== 'dia') return;
      eliminado = maisVotado(votos.values());
      if (eliminado !== null) vivos.delete(eliminado);
      if (verificarFim()) return;
      fase = 'veredito';
      ctx.agendar(VEREDITO_MS, () => {
        dia++;
        noite();
      });
      ctx.avisar();
    }

    noite();
    return {
      publico(quem) {
        const meu = papel.get(quem) ?? null;
        const souLobo = meu === 'lobisomem';
        const aberto = (id: number) => fase === 'fim' || !vivos.has(id) || id === quem || (souLobo && papel.get(id) === 'lobisomem');
        return {
          fase,
          dia,
          meuPapel: meu,
          vivo: vivos.has(quem),
          jogadores: [...papel.keys()].map((userId) => ({
            userId,
            username: ctx.nome(userId),
            vivo: vivos.has(userId),
            // O papel só aparece de quem já saiu, de você mesmo e, para um lobisomem, dos outros lobisomens.
            papel: aberto(userId) ? papel.get(userId) : null,
          })),
          // Para os lobisomens: em quem cada um votou nesta noite, para se acertarem.
          ataque: souLobo && fase === 'noite' ? Object.fromEntries(ataque) : null,
          visoes: meu === 'vidente' ? visoes : null,
          protegido: meu === 'anjo' ? protegido : null,
          viuHoje: meu === 'vidente' ? viuHoje : null,
          votos: fase === 'dia' || fase === 'veredito' ? Object.fromEntries(votos) : null,
          mortoDaNoite: fase === 'noite' ? null : mortoDaNoite,
          eliminado: fase === 'veredito' || fase === 'fim' ? eliminado : null,
          vencedor,
        };
      },
      acao(quem, corpo) {
        if (!papel.has(quem)) return 'Esta partida começou sem você. Espere a próxima.';
        if (!vivos.has(quem)) return 'Quem saiu do jogo só assiste.';
        const alvo = Number(corpo.alvo);
        if (corpo.tipo === 'noite') {
          if (fase !== 'noite') return 'Agora não é noite.';
          if (!vivos.has(alvo)) return 'Escolha alguém que ainda está no jogo.';
          const meu = papel.get(quem);
          if (meu === 'lobisomem') {
            if (papel.get(alvo) === 'lobisomem') return 'Escolha alguém que não é lobisomem.';
            ataque.set(quem, alvo);
          } else if (meu === 'vidente') {
            if (viuHoje) return 'Você já usou a sua visão esta noite.';
            if (alvo === quem) return 'Escolha outra pessoa.';
            visoes.push({ alvo, lobisomem: papel.get(alvo) === 'lobisomem' });
            viuHoje = true;
          } else if (meu === 'anjo') {
            protegido = alvo;
          } else return 'Quem é da vila dorme à noite.';
          if (noiteCompleta()) amanhecer();
          else ctx.avisar();
          return null;
        }
        if (corpo.tipo === 'voto') {
          if (fase !== 'dia') return 'A votação é de dia.';
          if (alvo !== 0 && !vivos.has(alvo)) return 'Escolha alguém que ainda está no jogo.';
          votos.set(quem, alvo);
          if ([...vivos].every((id) => votos.has(id))) veredito();
          else ctx.avisar();
          return null;
        }
        return 'Ação desconhecida.';
      },
    };
  },
};
