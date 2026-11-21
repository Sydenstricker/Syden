import { embaralhar, type Definicao } from './minijogo-motor.js';

/**
 * O LOBISOMEM, o melhor jogo de todos para jogar por voz: ele É a conversa. O Syden faz o papel do narrador
 * (que no jogo de mesa é uma pessoa que não joga): sorteia os papéis em segredo, conduz a noite e o dia, conta
 * os votos e anuncia quem morreu.
 *
 * - PREPARO (19/11/2026): quem começou escolhe quantos lobisomens, quais papéis entram e quanto duram a noite e o dia,
 *   dentro de limites; a composição aparece para todos (o segredo é QUEM tem cada papel, não QUAIS existem).
 * - NOITE: os lobisomens escolhem juntos quem atacar (e conversam por texto, só entre eles); a vidente descobre se alguém
 *   é lobisomem; o anjo protege alguém. Depois, se o Caldeirão está na partida, vem a vez das poções: ele vê quem os lobos
 *   atacaram e pode curar essa pessoa (uma vez na partida) e envenenar alguém (uma vez). Para quem não é o Caldeirão, as
 *   duas etapas são "noite" — e a etapa das poções acontece mesmo com ele fora do jogo (curta, de duração sorteada), para
 *   o tempo da noite não contar a ninguém se ele ainda vive.
 * - DIA: o Syden conta quem morreu na noite (e o papel de quem morreu). A turma discute pela voz e vota; o mais votado
 *   tem 20 s de DEFESA, e a turma decide no SIM ou NÃO se ele sai (empate, fica). Ninguém mais votado: ninguém sai.
 * - A ARMADILHA: quem tem esse papel, ao sair do jogo (de noite ou de dia), leva alguém junto.
 * - FIM: a vila vence quando não sobra lobisomem; os lobisomens vencem quando são tantos quanto o resto. No fim, a HISTÓRIA
 *   da partida aparece para todos: quem os lobos atacaram, quem o anjo protegeu, o que a vidente viu, as poções.
 *
 * O SEGREDO É O QUE SEGURA O JOGO, e por isso o estado é pedido por pessoa: cada um recebe só o próprio papel; o lobisomem
 * vê também os outros lobisomens, os votos e a conversa deles; a vidente vê o que já descobriu; o Caldeirão vê as poções. O
 * papel de quem morre fica aberto para todos — como no jogo de mesa. A conversa dos lobos mora só na memória e some no
 * amanhecer.
 *
 * OS NOMES NÃO DIZEM O SEXO DE QUEM RECEBE O PAPEL (o Syden não sabe): "Caçador" e "Bruxa" diriam, então os papéis novos
 * têm nome de COISA, como as classes das Lendas: a ARMADILHA (que dispara quando cai) e o CALDEIRÃO (das poções).
 *
 * OS TRÊS DE 21/11/2026, também coisas (escolhidos no preparo, como os outros):
 * - o AMULETO: a primeira vez que a vila decide tirar essa pessoa no julgamento, ele quebra e ela fica, com o papel aberto
 *   a todos dali em diante (o "príncipe" do jogo de mesa);
 * - a CARAPAÇA: aguenta o primeiro ataque dos lobisomens, calada (o amanhecer diz só que ninguém morreu); o veneno passa;
 * - a MÁSCARA: joga por conta própria e vence se a VILA a tirar do jogo no julgamento (o "curtidor" do jogo de mesa); a
 *   partida acaba ali. Atacada pelos lobisomens, envenenada ou levada pela Armadilha, ela só sai.
 */

export type Papel = 'lobisomem' | 'vidente' | 'anjo' | 'armadilha' | 'caldeirao' | 'amuleto' | 'carapaca' | 'mascara' | 'aldeao';
export const ESPECIAIS = ['vidente', 'anjo', 'armadilha', 'caldeirao', 'amuleto', 'carapaca', 'mascara'] as const;
export type Especial = (typeof ESPECIAIS)[number];

export const MINIMO_LOBISOMEM = 4;
export const NOITE_MS = 45_000;
export const AMANHECER_MS = 7_000;
export const DIA_MS = 150_000;
export const VEREDITO_MS = 7_000;
export const PREPARO_MS = 90_000;
export const DEFESA_MS = 20_000;
export const JULGAMENTO_MS = 20_000;
export const ARMADILHA_MS = 20_000;
export const POCAO_MS = 20_000;
/** Os limites do que quem começa pode escolher (de 5 em 5 s). */
export const LIMITES = { noite: [30_000, 90_000], dia: [60_000, 300_000] } as const;
/** A conversa dos lobos: tamanho, quantas por noite e o intervalo entre duas da mesma pessoa. */
export const CONVERSA_MAX = 200;
export const CONVERSA_POR_NOITE = 60;
export const CONVERSA_INTERVALO_MS = 400;

export interface Composicao {
  lobos: number;
  especiais: Especial[];
  noiteMs: number;
  diaMs: number;
}

/** Quantos lobisomens cabem: sempre menos que o resto, senão a partida acabaria antes de começar. */
export function lobosMax(n: number) {
  return Math.max(1, Math.min(4, Math.floor((n - 1) / 2)));
}

/** O de fábrica para `n` pessoas: um lobisomem a cada quatro (no máximo três), vidente sempre, anjo a partir de 5. */
export function composicaoPadrao(n: number): Composicao {
  const especiais: Especial[] = ['vidente'];
  if (n >= 5) especiais.push('anjo');
  return { lobos: Math.min(3, lobosMax(n), Math.max(1, Math.floor(n / 4))), especiais, noiteMs: NOITE_MS, diaMs: DIA_MS };
}

const prender = (x: unknown, [min, max]: readonly [number, number], padrao: number) => {
  const v = Number(x);
  if (!Number.isFinite(v)) return padrao;
  return Math.min(max, Math.max(min, Math.round(v / 5_000) * 5_000));
};

/** O pedido de quem começa, dentro dos limites (o que não cabe é cortado, nunca recusado). */
export function ajustar(n: number, pedido: Partial<Record<keyof Composicao, unknown>>, atual = composicaoPadrao(n)): Composicao {
  const lobosPedidos = Number(pedido.lobos);
  const lobos = Number.isInteger(lobosPedidos) ? Math.min(lobosMax(n), Math.max(1, lobosPedidos)) : Math.min(atual.lobos, lobosMax(n));
  const lista = Array.isArray(pedido.especiais) ? pedido.especiais : atual.especiais;
  const especiais = ESPECIAIS.filter((e) => lista.includes(e)).slice(0, Math.max(0, n - lobos));
  return {
    lobos,
    especiais,
    noiteMs: pedido.noiteMs === undefined ? atual.noiteMs : prender(pedido.noiteMs, LIMITES.noite, atual.noiteMs),
    diaMs: pedido.diaMs === undefined ? atual.diaMs : prender(pedido.diaMs, LIMITES.dia, atual.diaMs),
  };
}

/** Os papéis para `n` pessoas (sem sorteio de lugar: quem embaralha é a partida). */
export function papeisPara(n: number, comp: Composicao = composicaoPadrao(n)): Papel[] {
  const papeis: Papel[] = [...Array<Papel>(comp.lobos).fill('lobisomem'), ...comp.especiais];
  while (papeis.length < n) papeis.push('aldeao');
  return papeis.slice(0, n);
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

type Fase = 'preparo' | 'noite' | 'amanhecer' | 'armadilha' | 'dia' | 'defesa' | 'julgamento' | 'veredito' | 'fim';

/** Uma linha da história da partida (mostrada a todos só no fim). */
export interface LinhaDaHistoria {
  dia: number;
  tipo: 'ataque' | 'protecao' | 'visao' | 'cura' | 'veneno' | 'mortes' | 'acusado' | 'julgamento' | 'armadilha';
  /** Quem fez (a vidente, o anjo, o Caldeirão, a Armadilha). */
  de?: number;
  alvo?: number | null;
  /** O ataque não matou (o anjo, a cura ou a carapaça). */
  salvo?: boolean;
  /** Quem salvou foi a carapaça (21/11/2026). */
  carapaca?: boolean;
  /** No julgamento, o amuleto quebrou e a pessoa ficou (21/11/2026). */
  amuleto?: boolean;
  lobisomem?: boolean;
  mortos?: number[];
  votos?: number;
  sim?: number;
  nao?: number;
  saiu?: boolean;
}

export interface OpcoesDoLobisomem {
  aleatorio?: () => number;
  agora?: () => number;
}

export function criarLobisomem({ aleatorio = Math.random, agora = Date.now }: OpcoesDoLobisomem = {}): Definicao {
  return {
    minimo: MINIMO_LOBISOMEM,
    comecar(ctx, { naSala, criadaPor }) {
      if (naSala.length < MINIMO_LOBISOMEM) return 'O Lobisomem precisa de pelo menos 4 pessoas na sala.';
      const n = naSala.length;
      let comp = composicaoPadrao(n);
      const papel = new Map<number, Papel>();
      const vivos = new Set(naSala);
      let fase: Fase = 'preparo';
      /** A noite em duas etapas: a dos lobos (com a vidente e o anjo) e a das poções. Só o Caldeirão vê qual. */
      let etapa: 'lobos' | 'pocao' = 'lobos';
      let dia = 1;
      /** Quanto dura a fase de agora (o relógio da tela). */
      let duracao = PREPARO_MS;
      /** Os votos da noite dos lobisomens: lobisomem → alvo. */
      const ataque = new Map<number, number>();
      let alvoDosLobos: number | null = null;
      let protegido: number | null = null;
      let viuHoje = false;
      /** O que a vidente já descobriu, em ordem. */
      const visoes: { alvo: number; lobisomem: boolean }[] = [];
      /** As poções do Caldeirão: cada uma, uma vez na partida. */
      const pocoes = { cura: true, veneno: true };
      let curouHoje = false;
      let envenenouHoje: number | null = null;
      let decidiuPocao = false;
      /** A conversa dos lobos desta noite (some no amanhecer). */
      let conversa: { id: number; de: number; texto: string }[] = [];
      let proximaFala = 1;
      const ultimaFala = new Map<number, number>();
      /** Os votos do dia: quem vota → alvo (0 = ninguém). São abertos, como de mão levantada. */
      const votos = new Map<number, number>();
      let acusado: number | null = null;
      /** O julgamento: quem vota → sim (sai) ou não. */
      const julgamento = new Map<number, boolean>();
      let mortosDaNoite: number[] = [];
      let eliminado: number | null = null;
      /** A Armadilha que caiu e ainda vai escolher, e quem ela levou. */
      let armadilha: { quem: number; alvo: number | null } | null = null;
      let depoisDaArmadilha: (() => void) | null = null;
      let vencedor: 'vila' | 'lobisomens' | 'mascara' | null = null;
      /** A Carapaça e o Amuleto valem uma vez; quem quebrou o amuleto fica com o papel aberto a todos. */
      let carapacaInteira = true;
      let amuletoInteiro = true;
      let amuletoQuebrou: number | null = null;
      const revelados = new Set<number>();
      const historia: LinhaDaHistoria[] = [];

      const vivosCom = (p: Papel) => [...vivos].filter((id) => papel.get(id) === p);
      const lobosVivos = () => vivosCom('lobisomem');
      const temNaPartida = (p: Papel) => [...papel.values()].includes(p);
      /**
       * O MICROFONE, COMO NO JOGO DE MESA (20/11/2026, decisão dele): de noite (as duas etapas) ninguém da partida fala, e
       * quem saiu do jogo só ouve até o fim. No preparo e no fim, todos falam. Quem só assiste à sala nunca entra.
       */
      const silencioDe = (id: number): 'noite' | 'fora' | null => {
        if (fase === 'preparo' || fase === 'fim' || !naSala.includes(id)) return null;
        if (!vivos.has(id)) return 'fora';
        return fase === 'noite' ? 'noite' : null;
      };
      function sincronizarSilencio() {
        const motivos = new Map<number, 'noite' | 'fora'>();
        for (const id of naSala) {
          const m = silencioDe(id);
          if (m) motivos.set(id, m);
        }
        ctx.silenciar?.(motivos);
      }
      /** Toda mudança de estado passa por aqui: o microfone acompanha a fase, e a sala busca o estado novo. */
      const avisar = () => {
        sincronizarSilencio();
        ctx.avisar();
      };
      const marcar = (ms: number, depois: () => void) => {
        duracao = ms;
        ctx.agendar(ms, depois);
      };

      function verificarFim(): boolean {
        const lobos = lobosVivos().length;
        if (lobos === 0) vencedor = 'vila';
        else if (lobos >= vivos.size - lobos) vencedor = 'lobisomens';
        if (!vencedor) return false;
        fase = 'fim';
        ctx.terminar();
        avisar();
        return true;
      }

      // ---------------- O PREPARO ----------------
      function comecarPartida() {
        if (fase !== 'preparo') return;
        const sorteio = embaralhar(papeisPara(n, comp), aleatorio);
        naSala.forEach((id, i) => papel.set(id, sorteio[i]));
        noite();
      }

      // ---------------- A NOITE ----------------
      function noite() {
        fase = 'noite';
        etapa = 'lobos';
        ataque.clear();
        alvoDosLobos = null;
        protegido = null;
        viuHoje = false;
        curouHoje = false;
        envenenouHoje = null;
        decidiuPocao = false;
        conversa = [];
        marcar(comp.noiteMs, fimDosLobos);
        avisar();
      }

      /** A etapa dos lobos acaba quando cada papel com ação já agiu (ou o tempo acaba). */
      function lobosCompleto() {
        const lobosDecidiram = lobosVivos().every((id) => ataque.has(id));
        const videnteViu = vivosCom('vidente').length === 0 || viuHoje;
        const anjoAgiu = vivosCom('anjo').length === 0 || protegido !== null;
        return lobosDecidiram && videnteViu && anjoAgiu;
      }

      function fimDosLobos() {
        if (fase !== 'noite' || etapa !== 'lobos') return;
        const alvo = maisVotado(ataque.values()) ?? [...ataque.values()][0] ?? null;
        alvoDosLobos = alvo !== null && vivos.has(alvo) ? alvo : null;
        if (!temNaPartida('caldeirao')) return amanhecer();
        etapa = 'pocao';
        const podeAgir = vivosCom('caldeirao').length > 0 && (pocoes.cura || pocoes.veneno);
        // sem o Caldeirão vivo (ou sem poção), a etapa passa num tempo sorteado, como quem pensa e decide: a barra da tela
        // é a mesma nos dois casos (só o número cru do prazo, que a tela não mostra, diria alguma coisa)
        if (podeAgir) marcar(POCAO_MS, amanhecer);
        else {
          ctx.agendar(6_000 + Math.floor(aleatorio() * 14_000), amanhecer);
          duracao = POCAO_MS;
        }
        avisar();
      }

      function amanhecer() {
        if (fase !== 'noite') return;
        if (etapa === 'lobos') {
          // (sem Caldeirão, a noite vem direto para cá)
          const alvo = maisVotado(ataque.values()) ?? [...ataque.values()][0] ?? null;
          alvoDosLobos = alvo !== null && vivos.has(alvo) ? alvo : null;
        }
        conversa = [];
        const mortos: number[] = [];
        if (alvoDosLobos !== null) {
          let salvo = alvoDosLobos === protegido || curouHoje;
          // a Carapaça aguenta o primeiro ataque que a acertaria (o anjo ou a cura, se vieram, não a gastam)
          const carapaca = !salvo && carapacaInteira && papel.get(alvoDosLobos) === 'carapaca';
          if (carapaca) {
            carapacaInteira = false;
            salvo = true;
          }
          historia.push({ dia, tipo: 'ataque', alvo: alvoDosLobos, salvo, ...(carapaca ? { carapaca: true } : {}) });
          if (!salvo) mortos.push(alvoDosLobos);
        } else historia.push({ dia, tipo: 'ataque', alvo: null });
        if (protegido !== null) historia.push({ dia, tipo: 'protecao', de: vivosCom('anjo')[0] ?? [...papel].find(([, p]) => p === 'anjo')?.[0], alvo: protegido });
        if (curouHoje) historia.push({ dia, tipo: 'cura', alvo: alvoDosLobos });
        if (envenenouHoje !== null) {
          historia.push({ dia, tipo: 'veneno', alvo: envenenouHoje });
          if (vivos.has(envenenouHoje) && !mortos.includes(envenenouHoje)) mortos.push(envenenouHoje);
        }
        for (const id of mortos) vivos.delete(id);
        mortosDaNoite = mortos;
        historia.push({ dia, tipo: 'mortes', mortos: [...mortos] });
        const caiu = mortos.find((id) => papel.get(id) === 'armadilha');
        fase = 'amanhecer';
        if (caiu === undefined && verificarFim()) return;
        marcar(AMANHECER_MS, () => {
          if (caiu !== undefined) return abrirArmadilha(caiu, comecarDia);
          comecarDia();
        });
        avisar();
      }

      // ---------------- A ARMADILHA ----------------
      function abrirArmadilha(quem: number, depois: () => void) {
        fase = 'armadilha';
        armadilha = { quem, alvo: null };
        depoisDaArmadilha = depois;
        marcar(ARMADILHA_MS, () => dispararArmadilha(null));
        avisar();
      }
      function dispararArmadilha(alvo: number | null) {
        if (fase !== 'armadilha' || !armadilha) return;
        armadilha.alvo = alvo;
        if (alvo !== null) vivos.delete(alvo);
        historia.push({ dia, tipo: 'armadilha', de: armadilha.quem, alvo });
        const depois = depoisDaArmadilha;
        depoisDaArmadilha = null;
        if (verificarFim()) return;
        depois?.();
      }

      // ---------------- O DIA ----------------
      function comecarDia() {
        fase = 'dia';
        amuletoQuebrou = null;
        votos.clear();
        acusado = null;
        julgamento.clear();
        eliminado = null;
        marcar(comp.diaMs, fimDoDia);
        avisar();
      }

      function fimDoDia() {
        if (fase !== 'dia') return;
        acusado = maisVotado(votos.values());
        if (acusado === null || !vivos.has(acusado)) {
          acusado = null;
          historia.push({ dia, tipo: 'acusado', alvo: null });
          return veredito();
        }
        historia.push({ dia, tipo: 'acusado', alvo: acusado, votos: [...votos.values()].filter((v) => v === acusado).length });
        fase = 'defesa';
        marcar(DEFESA_MS, abrirJulgamento);
        avisar();
      }

      function abrirJulgamento() {
        if (fase !== 'defesa') return;
        fase = 'julgamento';
        julgamento.clear();
        marcar(JULGAMENTO_MS, fimDoJulgamento);
        avisar();
      }
      const juizes = () => [...vivos].filter((id) => id !== acusado);

      function fimDoJulgamento() {
        if (fase !== 'julgamento' || acusado === null) return;
        const sim = [...julgamento.values()].filter(Boolean).length;
        const nao = julgamento.size - sim;
        let saiu = sim > nao;
        // o Amuleto quebra na primeira vez: a pessoa fica, e o papel dela abre para todos
        const amuleto = saiu && amuletoInteiro && papel.get(acusado) === 'amuleto';
        if (amuleto) {
          amuletoInteiro = false;
          amuletoQuebrou = acusado;
          revelados.add(acusado);
          saiu = false;
        }
        historia.push({ dia, tipo: 'julgamento', alvo: acusado, sim, nao, saiu, ...(amuleto ? { amuleto: true } : {}) });
        eliminado = saiu ? acusado : null;
        veredito();
      }

      function veredito() {
        if (eliminado !== null) vivos.delete(eliminado);
        const caiu = eliminado !== null && papel.get(eliminado) === 'armadilha' ? eliminado : null;
        fase = 'veredito';
        // a Máscara tirada pela vila vence ali mesmo
        if (eliminado !== null && papel.get(eliminado) === 'mascara') {
          vencedor = 'mascara';
          fase = 'fim';
          ctx.terminar();
          avisar();
          return;
        }
        if (caiu === null && verificarFim()) return;
        marcar(VEREDITO_MS, () => {
          const proxima = () => {
            dia++;
            noite();
          };
          if (caiu !== null) return abrirArmadilha(caiu, proxima);
          proxima();
        });
        avisar();
      }

      marcar(PREPARO_MS, comecarPartida);
      return {
        // a partida saiu da memória (acabou, foi encerrada, trocada ou quebrou): todos voltam a falar
        parar() {
          ctx.silenciar?.(new Map());
        },
        publico(quem) {
          const meu = papel.get(quem) ?? null;
          const souLobo = meu === 'lobisomem';
          const vivoEu = vivos.has(quem);
          const aberto = (id: number) => fase === 'fim' || !vivos.has(id) || id === quem || revelados.has(id) || (souLobo && papel.get(id) === 'lobisomem');
          const caldeiraoAgindo = meu === 'caldeirao' && fase === 'noite' && etapa === 'pocao' && vivoEu;
          return {
            fase,
            dia,
            duracao,
            criadaPor,
            composicao: comp,
            lobosMax: lobosMax(n),
            meuPapel: meu,
            vivo: vivoEu,
            // o seu microfone, desligado pela partida: 'noite' (volta no amanhecer) ou 'fora' (até o fim)
            microfone: silencioDe(quem),
            jogadores: naSala.map((userId) => ({
              userId,
              username: ctx.nome(userId),
              vivo: vivos.has(userId),
              // O papel só aparece de quem já saiu, de você mesmo e, para um lobisomem, dos outros lobisomens.
              papel: papel.has(userId) && aberto(userId) ? papel.get(userId) : null,
            })),
            // Para os lobisomens: em quem cada um votou nesta noite, para se acertarem, e a conversa deles.
            ataque: souLobo && fase === 'noite' ? Object.fromEntries(ataque) : null,
            conversa: souLobo && vivoEu && fase === 'noite' ? conversa : null,
            visoes: meu === 'vidente' ? visoes : null,
            protegido: meu === 'anjo' ? protegido : null,
            viuHoje: meu === 'vidente' ? viuHoje : null,
            // O Caldeirão: as poções que sobram, e, na etapa dele, quem os lobos atacaram.
            etapa: meu === 'caldeirao' && fase === 'noite' ? etapa : null,
            pocoes: meu === 'caldeirao' ? { ...pocoes, curouHoje, envenenouHoje, decidiu: decidiuPocao } : null,
            alvoDosLobos: caldeiraoAgindo ? alvoDosLobos : null,
            votos: fase === 'dia' || fase === 'defesa' || fase === 'julgamento' || fase === 'veredito' ? Object.fromEntries(votos) : null,
            acusado: fase === 'defesa' || fase === 'julgamento' || fase === 'veredito' ? acusado : null,
            // no julgamento, só QUEM já votou; o sim e o não aparecem no veredito
            julgou: fase === 'julgamento' ? [...julgamento.keys()] : null,
            meuJulgamento: fase === 'julgamento' ? (julgamento.get(quem) ?? null) : null,
            julgamento: fase === 'veredito' || fase === 'fim' ? Object.fromEntries(julgamento) : null,
            mortosDaNoite: fase === 'noite' || fase === 'preparo' ? [] : mortosDaNoite,
            eliminado: fase === 'veredito' || fase === 'fim' ? eliminado : null,
            amuletoQuebrou: fase === 'veredito' ? amuletoQuebrou : null,
            armadilha: fase === 'armadilha' || armadilha?.alvo !== null ? armadilha : null,
            vencedor,
            historia: fase === 'fim' ? historia : null,
          };
        },
        acao(quem, corpo) {
          if (!naSala.includes(quem)) return 'Esta partida começou sem você. Espere a próxima.';
          // O PREPARO: quem começou ajusta e dá a largada (se saiu da sala, qualquer um da partida pode)
          if (corpo.tipo === 'ajustes' || corpo.tipo === 'comecar') {
            if (fase !== 'preparo') return 'Agora não dá.';
            if (quem !== criadaPor && ctx.naSala().includes(criadaPor)) return 'Só quem começou a partida escolhe.';
            if (corpo.tipo === 'comecar') comecarPartida();
            else {
              comp = ajustar(n, corpo as Partial<Record<keyof Composicao, unknown>>, comp);
              avisar();
            }
            return null;
          }
          if (fase === 'preparo') return 'Agora não dá.';
          // A Armadilha escolhe depois de cair: é a única ação de quem saiu
          if (corpo.tipo === 'armadilha') {
            if (fase !== 'armadilha' || !armadilha || armadilha.quem !== quem) return 'Agora não dá.';
            const alvo = Number(corpo.alvo);
            if (alvo === 0) dispararArmadilha(null);
            else if (!vivos.has(alvo)) return 'Escolha alguém que ainda está no jogo.';
            else dispararArmadilha(alvo);
            return null;
          }
          if (!vivos.has(quem)) return 'Quem saiu do jogo só assiste.';
          const alvo = Number(corpo.alvo);
          const meu = papel.get(quem);
          if (corpo.tipo === 'conversa') {
            if (meu !== 'lobisomem' || fase !== 'noite') return 'Agora não dá.';
            const texto = typeof corpo.texto === 'string' ? corpo.texto.replace(/\s+/g, ' ').trim().slice(0, CONVERSA_MAX) : '';
            if (!texto) return 'Agora não dá.';
            const t = agora();
            if (t - (ultimaFala.get(quem) ?? -Infinity) < CONVERSA_INTERVALO_MS || conversa.length >= CONVERSA_POR_NOITE) return 'Devagar.';
            ultimaFala.set(quem, t);
            conversa.push({ id: proximaFala++, de: quem, texto });
            avisar();
            return null;
          }
          if (corpo.tipo === 'noite') {
            if (fase !== 'noite' || etapa !== 'lobos') return 'Agora não é noite.';
            if (!vivos.has(alvo)) return 'Escolha alguém que ainda está no jogo.';
            if (meu === 'lobisomem') {
              if (papel.get(alvo) === 'lobisomem') return 'Escolha alguém que não é lobisomem.';
              ataque.set(quem, alvo);
            } else if (meu === 'vidente') {
              if (viuHoje) return 'Você já usou a sua visão esta noite.';
              if (alvo === quem) return 'Escolha outra pessoa.';
              const lobo = papel.get(alvo) === 'lobisomem';
              visoes.push({ alvo, lobisomem: lobo });
              historia.push({ dia, tipo: 'visao', de: quem, alvo, lobisomem: lobo });
              viuHoje = true;
            } else if (meu === 'anjo') {
              protegido = alvo;
            } else return 'Quem é da vila dorme à noite.';
            if (lobosCompleto()) fimDosLobos();
            else avisar();
            return null;
          }
          if (corpo.tipo === 'pocao') {
            if (meu !== 'caldeirao' || fase !== 'noite' || etapa !== 'pocao' || decidiuPocao) return 'Agora não dá.';
            const curar = corpo.curar === true;
            const veneno = Number(corpo.veneno) || 0;
            if (curar && (!pocoes.cura || alvoDosLobos === null)) return 'Agora não dá.';
            if (veneno && (!pocoes.veneno || !vivos.has(veneno) || veneno === quem)) return 'Escolha alguém que ainda está no jogo.';
            if (curar) {
              pocoes.cura = false;
              curouHoje = true;
            }
            if (veneno) {
              pocoes.veneno = false;
              envenenouHoje = veneno;
            }
            decidiuPocao = true;
            amanhecer();
            return null;
          }
          if (corpo.tipo === 'voto') {
            if (fase !== 'dia') return 'A votação é de dia.';
            if (alvo !== 0 && !vivos.has(alvo)) return 'Escolha alguém que ainda está no jogo.';
            votos.set(quem, alvo);
            if ([...vivos].every((id) => votos.has(id))) fimDoDia();
            else avisar();
            return null;
          }
          if (corpo.tipo === 'pronto') {
            // o acusado termina a defesa antes do tempo
            if (fase !== 'defesa' || quem !== acusado) return 'Agora não dá.';
            abrirJulgamento();
            return null;
          }
          if (corpo.tipo === 'julgamento') {
            if (fase !== 'julgamento') return 'Agora não dá.';
            if (quem === acusado) return 'Quem está sendo julgado não vota.';
            julgamento.set(quem, corpo.sim === true);
            if (juizes().every((id) => julgamento.has(id))) fimDoJulgamento();
            else avisar();
            return null;
          }
          return 'Ação desconhecida.';
        },
      };
    },
  };
}

export const lobisomem: Definicao = criarLobisomem();
