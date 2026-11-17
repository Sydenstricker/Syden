/**
 * LENDAS DA TOCA (16/11/2026): um RPG de turnos curto para a turma, do GÊNERO dos RPGs de turno dos anos 90 — só a mecânica
 * (a turma de heróis, a vez de cada um, a energia das habilidades, o ataque combinado de dois heróis, o equipamento que cai
 * depois da luta). Nada de nome, personagem, magia, arte ou música de jogo nenhum: as classes, os golpes e o caminho são
 * nossos, os heróis são o coelho da Briga (com as cores de cada um) e os inimigos são os monstros da Quaternius (CC0) que a
 * Briga já usa.
 *
 * A AVENTURA: um caminho de cinco paradas — a floresta, o deserto, a fogueira (descanso), a neve e o castelo, onde mora o
 * dragão. Três lutas, o descanso e o chefe. Depois de cada luta, cada herói ganha uma peça de equipamento (arma, armadura ou
 * amuleto) e decide se a veste.
 *
 * A TURMA É SEMPRE DE QUATRO: cada pessoa (1 a 4) escolhe a classe do seu herói, e os lugares que sobram são de robôs
 * (minijogo-robos.ts), que pegam as classes que faltam. No Solo, a pessoa joga um herói e três robôs completam a turma.
 * As classes têm nome de COISA, e não de gente (Escudo, Faísca, Erva, Flecha): não dizem o sexo de ninguém em língua nenhuma.
 *
 * A REDE DECIDIU A FORMA DO TURNO: a rodada é de ESCOLHA AO MESMO TEMPO. Todos escolhem juntos (20 s, que o servidor conta),
 * e o servidor resolve a rodada inteira pela velocidade de cada um, heróis e inimigos misturados. Ninguém espera a vez de
 * ninguém, e 200 ms de internet não mudam nada. Quem não escolheu a tempo, ou saiu da sala, joga pelo robô.
 *
 * O COMBO: dois heróis ou mais que escolhem "Combo" na mesma rodada atacam JUNTOS, na vez do mais rápido, e o golpe junta o
 * que cada classe sabe (a Faísca espalha nos outros inimigos, a Erva cura a turma, o Escudo deixa o alvo tonto, a Flecha
 * acerta mais forte). Custa energia de cada um; sozinho no combo, o herói só ataca, e não gasta nada. O robô atende: quem
 * escolhe Combo e não tem par ganha um robô com energia de parceiro.
 *
 * O SERVIDOR DECIDE TUDO (o dano, o sorteio, a ordem); o site só escolhe a ação e o alvo, e desenha o que veio.
 *
 * Este arquivo não fala com o banco (o avatar e o troféu chegam por `servicos`), para o teste rodar a regra sem servidor. O
 * que o Syden registra é minijogo-lendas.ts.
 */
import { embaralhar, type Contexto, type Definicao, type Jogo } from './minijogo-motor.js';
import { comRobos, ehRobo, idsDosRobos } from './minijogo-robos.js';

// ---------------- OS RELÓGIOS ----------------
/** A escolha de cada rodada, na sala. */
export const TEMPO_DA_ESCOLHA = 20_000;
/** A escolha da classe e a do espólio. */
export const TEMPO_DA_CLASSE = 30_000;
export const TEMPO_DO_ESPOLIO = 15_000;
/** No Solo, pensar não segura ninguém (a regra das mesas): o relógio é longo. */
export const TEMPO_SOLO = 30 * 60_000;
/** O mapa entre uma parada e outra, e o descanso na fogueira. */
export const MAPA_MS = 2_500;
export const DESCANSO_MS = 3_000;
/** Cada acontecimento da rodada, na tela (o site anima no mesmo passo). */
export const EVENTO_MS = 850;
export const ACAO_FOLGA_MS = 700;
/** Uma luta que não acaba (os dois lados só se defendendo) termina em derrota. */
export const RODADAS_MAX = 40;

// ---------------- AS CLASSES ----------------
export const CLASSES = ['escudo', 'faisca', 'erva', 'flecha'] as const;
export type Classe = (typeof CLASSES)[number];

interface Base {
  hp: number;
  en: number;
  atk: number;
  def: number;
  mag: number;
  vel: number;
  /** O custo da habilidade, em energia. */
  custo: number;
}
export const BASES: Record<Classe, Base> = {
  // aguenta, e protege a turma
  escudo: { hp: 150, en: 6, atk: 14, def: 10, mag: 4, vel: 4, custo: 2 },
  // pouca vida, acerta todos os inimigos
  faisca: { hp: 85, en: 10, atk: 6, def: 3, mag: 16, vel: 6, custo: 3 },
  // cura a turma (e levanta quem caiu)
  erva: { hp: 95, en: 10, atk: 7, def: 5, mag: 13, vel: 5, custo: 4 },
  // a mais rápida, um tiro forte que atravessa a defesa
  flecha: { hp: 100, en: 8, atk: 15, def: 5, mag: 5, vel: 9, custo: 2 },
};
export const CUSTO_DO_COMBO = 2;

// ---------------- O CAMINHO E OS INIMIGOS ----------------
/** Os ids dos bichos são os da Briga (web/src/briga/folhasDosBichos.ts): o site os desenha pela folha deles. */
export interface DefDoInimigo {
  hp: number;
  atk: number;
  def: number;
  vel: number;
  chefe?: boolean;
}
export const INIMIGOS: Record<string, DefDoInimigo> = {
  // (o equilíbrio é chute medido contra os robôs: a turma toda de robôs vence ~4 de 5, e quase sempre perde no dragão)
  cogumelo: { hp: 102, atk: 22, def: 3, vel: 3 },
  sapo: { hp: 85, atk: 26, def: 2, vel: 6 },
  abelha: { hp: 68, atk: 24, def: 1, vel: 9 },
  cacto: { hp: 136, atk: 29, def: 6, vel: 3 },
  dino: { hp: 119, atk: 33, def: 4, vel: 5 },
  redemoinho: { hp: 94, atk: 31, def: 2, vel: 10 },
  espinhento: { hp: 153, atk: 33, def: 7, vel: 4 },
  golem: { hp: 187, atk: 31, def: 9, vel: 2 },
  macaco: { hp: 136, atk: 37, def: 4, vel: 8 },
  diabinho: { hp: 119, atk: 35, def: 4, vel: 9 },
  fantasma: { hp: 119, atk: 33, def: 3, vel: 7 },
  dragao: { hp: 572, atk: 42, def: 8, vel: 6, chefe: true },
};

export type TipoDeParada = 'luta' | 'descanso' | 'chefe';
/** O caminho: a parada, o cenário (o da Briga, web/src/briga/cenarios.ts) e quem mora nela. */
export const ROTA: { id: string; tipo: TipoDeParada; inimigos: string[] }[] = [
  { id: 'floresta', tipo: 'luta', inimigos: ['cogumelo', 'sapo', 'abelha'] },
  { id: 'deserto', tipo: 'luta', inimigos: ['cacto', 'dino', 'redemoinho'] },
  { id: 'fogueira', tipo: 'descanso', inimigos: [] },
  { id: 'neve', tipo: 'luta', inimigos: ['espinhento', 'golem', 'macaco'] },
  { id: 'castelo', tipo: 'chefe', inimigos: ['diabinho', 'dragao', 'fantasma'] },
];

// ---------------- O EQUIPAMENTO ----------------
export const PECAS = ['arma', 'armadura', 'amuleto'] as const;
export type Peca = (typeof PECAS)[number];
export interface Item {
  peca: Peca;
  /** A arma soma no ataque e na magia; a armadura, na defesa; o amuleto, na vida máxima. */
  valor: number;
}

// ---------------- OS TIPOS ----------------
export type Acao = 'atacar' | 'habilidade' | 'defender' | 'combo';
export const ACOES: readonly Acao[] = ['atacar', 'habilidade', 'defender', 'combo'];
export interface Escolha {
  acao: Acao;
  /** O inimigo (índice), para atacar, a Flecha e o combo. */
  alvo: number | null;
}

export interface Heroi {
  userId: number;
  classe: Classe | null;
  hp: number;
  equip: Record<Peca, number>;
  en: number;
  escolha: Escolha | null;
  /** Quem escolheu foi o robô (o tempo acabou, ou a pessoa saiu): a tela não marca como escolha dela. */
  pontos: number;
  defendendo: boolean;
  protegendo: boolean;
}

export interface Inimigo {
  id: number;
  tipo: string;
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  vel: number;
  chefe: boolean;
  /** Tonto pelo combo do Escudo: perde a próxima vez. */
  tonto: boolean;
  /** O chefe enchendo o fôlego: na próxima rodada, o sopro pega a turma inteira (a tela avisa). */
  preparando: boolean;
}

/** Quem age ou leva: um herói (pelo id da pessoa) ou um inimigo (pelo índice). */
export type Ator = { h: number } | { i: number };
export interface Alvo {
  quem: Ator;
  dano?: number;
  cura?: number;
  /** Caiu com este golpe. */
  ko?: boolean;
  /** Levantou (a cura da Erva em quem tinha caído). */
  volta?: boolean;
}
export type TipoDeEvento = 'ataque' | 'habilidade' | 'defender' | 'combo' | 'inimigo' | 'sopro' | 'preparar' | 'tonto';
export interface Evento {
  id: number;
  tipo: TipoDeEvento;
  de: Ator;
  alvos: Alvo[];
  /** No combo: quem atacou junto. */
  membros?: number[];
  /** O herói do Escudo que levou o golpe no lugar de outro. */
  protegido?: boolean;
}

export interface OpcoesDasLendas {
  agora?: () => number;
  aleatorio?: () => number;
  servicos?: {
    avatarDe(userId: number): number | string | null;
    guardarTrofeu(t: { userId: number; evento: string; communityId: number; pista: string; posicao: number; tempoMs: number | null; pontos: number | null; rivais: number[] }): void;
  };
}

// ---------------- AS CONTAS (puras, exportadas para o teste) ----------------
/** Os números do herói com o equipamento. */
export function atributos(h: Pick<Heroi, 'classe' | 'equip'>) {
  const b = BASES[h.classe ?? 'escudo'];
  return {
    hpMax: b.hp + h.equip.amuleto,
    enMax: b.en,
    atk: b.atk + h.equip.arma,
    mag: b.mag + h.equip.arma,
    def: b.def + h.equip.armadura,
    vel: b.vel,
    custo: b.custo,
  };
}

/** As cores dos robôs: três coelhos prontos, para a turma não ser de quatro mascotes iguais. */
const AVATARES_DOS_ROBOS = [4, 9, 13, 2];

export function criarLendas({ agora = Date.now, aleatorio = Math.random, servicos }: OpcoesDasLendas = {}): Definicao {
  return {
    minimo: 1,
    maximo: 4,
    comecar(ctxDaSala, { naSala: naSalaDaSala }) {
      const humanos = naSalaDaSala.slice(0, 4);
      if (!humanos.length) return 'Ainda falta gente para começar.';
      const robos = idsDosRobos(4 - humanos.length);
      const ctx = comRobos(ctxDaSala, robos);
      const solo = ctxDaSala.solo === true;
      const ordem = [...humanos, ...robos];
      const partidaId = `lendas-${ctx.comunidade ?? 0}-${agora()}`;
      const sorteio = (a: number, b: number) => a + (b - a) * aleatorio();
      const variar = (x: number) => x * sorteio(0.9, 1.1);

      const herois = new Map<number, Heroi>(
        ordem.map((userId) => [
          userId,
          { userId, classe: null, hp: 0, equip: { arma: 0, armadura: 0, amuleto: 0 }, en: 0, escolha: null, pontos: 0, defendendo: false, protegendo: false },
        ]),
      );
      const avatares = new Map<number, number | string | null>(
        ordem.map((id) => [id, ehRobo(id) ? AVATARES_DOS_ROBOS[(-id - 1) % AVATARES_DOS_ROBOS.length] : (servicos?.avatarDe(id) ?? null)]),
      );
      /** Quem escolheu pelo robô nesta fase (o tempo acabou, ou saiu): a tela mostra a escolha com outra marca. */
      const peloRobo = new Set<number>();

      let fase: 'classes' | 'mapa' | 'descanso' | 'escolha' | 'acao' | 'espolio' | 'fim' = 'classes';
      let parada = 0;
      let rodada = 0;
      let inimigos: Inimigo[] = [];
      let eventos: Evento[] = [];
      let proximoEvento = 1;
      /** O número da resolução: o site sabe que chegou rodada nova para animar. */
      let resolucao = 0;
      let espolio = new Map<number, Item>();
      const decidiram = new Set<number>();
      let venceu = false;
      let resultado: { userId: number; username: string; pontos: number; posicao: number | null }[] | null = null;

      const presente = (id: number) => ctx.naSala().includes(id);
      const humanosPresentes = () => humanos.filter(presente);
      const vivos = () => ordem.map((id) => herois.get(id)!).filter((h) => h.hp > 0);
      const inimigosVivos = () => inimigos.filter((i) => i.hp > 0);
      const relogio = (ms: number) => (solo ? TEMPO_SOLO : ms);

      // ---------------- AS CLASSES ----------------
      const classeDoRobo = (): Classe => {
        const usadas = new Set([...herois.values()].map((h) => h.classe).filter(Boolean));
        const falta = CLASSES.filter((c) => !usadas.has(c));
        return falta.length ? falta[0] : CLASSES[Math.floor(aleatorio() * CLASSES.length)];
      };
      const vestir = (h: Heroi, classe: Classe) => {
        h.classe = classe;
        const a = atributos(h);
        h.hp = a.hpMax;
        h.en = a.enMax;
      };
      const fecharClasses = () => {
        if (fase !== 'classes') return;
        // primeiro quem é gente (o tempo acabou ou saiu), depois os robôs com o que faltou
        for (const id of humanos) if (!herois.get(id)!.classe) vestir(herois.get(id)!, classeDoRobo());
        for (const id of robos) vestir(herois.get(id)!, classeDoRobo());
        irAoMapa();
      };
      const conferirClasses = () => {
        for (const id of humanos) if (!presente(id) && !herois.get(id)!.classe) vestir(herois.get(id)!, classeDoRobo());
        if (humanos.every((id) => herois.get(id)!.classe)) fecharClasses();
      };

      // ---------------- O MAPA ----------------
      const irAoMapa = () => {
        fase = 'mapa';
        eventos = [];
        ctx.agendar(MAPA_MS, entrarNaParada);
        ctx.avisar();
      };
      const entrarNaParada = () => {
        const p = ROTA[parada];
        if (p.tipo === 'descanso') {
          fase = 'descanso';
          // a fogueira: metade da vida de volta, quem caiu levanta, a energia cheia
          for (const h of herois.values()) {
            const a = atributos(h);
            h.hp = Math.min(a.hpMax, Math.max(h.hp, 0) + Math.round(a.hpMax * 0.5));
            h.en = a.enMax;
          }
          ctx.agendar(DESCANSO_MS, () => {
            parada++;
            irAoMapa();
          });
          ctx.avisar();
          return;
        }
        inimigos = p.inimigos.map((tipo, id) => {
          const d = INIMIGOS[tipo];
          return { id, tipo, hp: d.hp, hpMax: d.hp, atk: d.atk, def: d.def, vel: d.vel, chefe: !!d.chefe, tonto: false, preparando: false };
        });
        rodada = 0;
        novaRodada();
      };

      // ---------------- A ESCOLHA ----------------
      const novaRodada = () => {
        fase = 'escolha';
        rodada++;
        eventos = [];
        peloRobo.clear();
        for (const h of herois.values()) {
          h.escolha = null;
          h.defendendo = false;
          h.protegendo = false;
        }
        // os robôs escolhem na hora; quem é gente tem o relógio
        for (const id of robos) escolherPeloRobo(herois.get(id)!);
        for (const id of humanos) if (!presente(id)) escolherPeloRobo(herois.get(id)!, true);
        ctx.agendar(relogio(TEMPO_DA_ESCOLHA), fecharEscolha);
        if (!conferirEscolhas()) ctx.avisar();
      };

      /** Todo herói vivo escolheu? Então a rodada se resolve já. */
      const conferirEscolhas = () => {
        if (fase !== 'escolha') return false;
        for (const id of humanos) {
          const h = herois.get(id)!;
          if (h.hp > 0 && !h.escolha && !presente(id)) escolherPeloRobo(h, true);
        }
        if (vivos().every((h) => h.escolha)) {
          resolver();
          return true;
        }
        return false;
      };
      const fecharEscolha = () => {
        if (fase !== 'escolha') return;
        for (const h of vivos()) if (!h.escolha) escolherPeloRobo(h, true);
        resolver();
      };

      /** O robô: regras de quem joga com cuidado, vendo o que a turma vê. */
      const escolherPeloRobo = (h: Heroi, porGente = false) => {
        if (h.hp <= 0 || !h.classe) return;
        if (porGente) peloRobo.add(h.userId);
        const a = atributos(h);
        const vivosI = inimigosVivos();
        if (!vivosI.length) return (h.escolha = { acao: 'defender', alvo: null });
        // o alvo: o inimigo com menos vida (fechar a conta), e o chefe por último quando há outros
        const fraco = [...vivosI].sort((x, y) => x.hp - y.hp)[0];
        const sopro = vivosI.some((i) => i.preparando);
        const turma = vivos();
        const caidos = ordem.filter((id) => herois.get(id)!.hp <= 0).length;
        const falta = turma.reduce((s, x) => s + (atributos(x).hpMax - x.hp), 0);
        const total = turma.reduce((s, x) => s + atributos(x).hpMax, 0);
        const podeHab = h.en >= a.custo;
        let e: Escolha = { acao: 'atacar', alvo: fraco.id };
        switch (h.classe) {
          case 'erva':
            if (podeHab && (caidos > 0 || falta > total * 0.3 || turma.some((x) => x.hp < atributos(x).hpMax * 0.35))) e = { acao: 'habilidade', alvo: null };
            else if (sopro) e = { acao: 'defender', alvo: null };
            break;
          case 'escudo':
            if (sopro) e = { acao: 'defender', alvo: null };
            else if (podeHab && turma.some((x) => x !== h && x.hp < atributos(x).hpMax * 0.4)) e = { acao: 'habilidade', alvo: null };
            break;
          case 'faisca':
            if (podeHab && vivosI.length >= 2) e = { acao: 'habilidade', alvo: null };
            else if (sopro && !podeHab) e = { acao: 'defender', alvo: null };
            break;
          case 'flecha': {
            const forte = vivosI.find((i) => i.chefe) ?? fraco;
            if (podeHab) e = { acao: 'habilidade', alvo: forte.id };
            break;
          }
        }
        // o robô atende o chamado de combo de quem é gente (um só por rodada), se tem energia e não está curando a turma
        const chamado = [...herois.values()].find((x) => x !== h && x.escolha?.acao === 'combo' && !ehRobo(x.userId));
        const jaTemPar = [...herois.values()].filter((x) => x.escolha?.acao === 'combo').length >= 2;
        if (chamado && !jaTemPar && h.en >= CUSTO_DO_COMBO && e.acao !== 'habilidade' && e.acao !== 'defender') e = { acao: 'combo', alvo: chamado.escolha!.alvo };
        h.escolha = e;
      };

      /** Alguém de gente escolheu Combo: um robô (que ainda não está no combo) vira o par, se a turma não tem outro. */
      const atenderCombo = (quem: Heroi) => {
        const noCombo = [...herois.values()].filter((x) => x.hp > 0 && x.escolha?.acao === 'combo');
        if (noCombo.length >= 2) return;
        const par = robos
          .map((id) => herois.get(id)!)
          .filter((x) => x.hp > 0 && x.en >= CUSTO_DO_COMBO && x.escolha?.acao !== 'combo')
          // quem estava só atacando primeiro; a Erva curando e quem se defende do sopro ficam
          .sort((x, y) => Number(x.escolha?.acao !== 'atacar') - Number(y.escolha?.acao !== 'atacar'))[0];
        if (par && (par.escolha?.acao === 'atacar' || par.classe === 'flecha' || par.classe === 'faisca')) par.escolha = { acao: 'combo', alvo: quem.escolha!.alvo };
      };

      // ---------------- A RESOLUÇÃO ----------------
      const evento = (e: Omit<Evento, 'id'>) => eventos.push({ ...e, id: proximoEvento++ });
      const ferirInimigo = (i: Inimigo, dano: number, quem: Heroi[]): Alvo => {
        const d = Math.max(1, Math.round(dano));
        const real = Math.min(i.hp, d);
        i.hp -= real;
        for (const h of quem) h.pontos += Math.round(real / quem.length);
        return { quem: { i: i.id }, dano: d, ko: i.hp <= 0 };
      };
      const alvoVivo = (alvo: number | null) => {
        const i = inimigos.find((x) => x.id === alvo && x.hp > 0);
        return i ?? [...inimigosVivos()].sort((a, b) => a.hp - b.hp)[0];
      };

      const agirHeroi = (h: Heroi) => {
        if (h.hp <= 0 || !h.escolha || !inimigosVivos().length) return;
        const a = atributos(h);
        const { acao } = h.escolha;
        if (acao === 'defender') return; // já valeu desde o começo da rodada
        if (acao === 'habilidade' && h.en >= a.custo) {
          h.en -= a.custo;
          switch (h.classe) {
            case 'escudo':
              return; // o "proteger" já valeu desde o começo da rodada
            case 'faisca':
              return evento({
                tipo: 'habilidade',
                de: { h: h.userId },
                alvos: inimigosVivos().map((i) => ferirInimigo(i, variar(a.mag) - i.def * 0.25, [h])),
              });
            case 'erva': {
              const alvos: Alvo[] = [];
              for (const x of herois.values()) {
                const ax = atributos(x);
                if (x.hp <= 0) {
                  x.hp = Math.round(ax.hpMax * 0.25);
                  h.pontos += x.hp;
                  alvos.push({ quem: { h: x.userId }, cura: x.hp, volta: true });
                } else {
                  const cura = Math.min(ax.hpMax - x.hp, Math.round(variar(a.mag * 1.4 + 8)));
                  x.hp += cura;
                  h.pontos += cura;
                  alvos.push({ quem: { h: x.userId }, cura });
                }
              }
              return evento({ tipo: 'habilidade', de: { h: h.userId }, alvos });
            }
            case 'flecha': {
              const i = alvoVivo(h.escolha.alvo);
              return evento({ tipo: 'habilidade', de: { h: h.userId }, alvos: [ferirInimigo(i, variar(a.atk * 2), [h])] });
            }
          }
        }
        // atacar (e o combo sem par, e a habilidade sem energia)
        const i = alvoVivo(h.escolha.alvo);
        evento({ tipo: 'ataque', de: { h: h.userId }, alvos: [ferirInimigo(i, variar(a.atk) - i.def * 0.5, [h])] });
      };

      const agirCombo = (membros: Heroi[], alvo: number | null) => {
        const ainda = membros.filter((h) => h.hp > 0 && h.en >= CUSTO_DO_COMBO);
        if (ainda.length < 2 || !inimigosVivos().length) {
          for (const h of ainda) {
            h.escolha = { acao: 'atacar', alvo };
            agirHeroi(h);
          }
          return;
        }
        for (const h of ainda) h.en -= CUSTO_DO_COMBO;
        const classes = new Set(ainda.map((h) => h.classe));
        const i = alvoVivo(alvo);
        let forca = ainda.reduce((s, h) => s + Math.max(atributos(h).atk, atributos(h).mag), 0) * 1.5;
        if (classes.has('flecha')) forca *= 1.25;
        const alvos: Alvo[] = [ferirInimigo(i, variar(forca), ainda)];
        if (classes.has('faisca')) for (const o of inimigosVivos()) if (o !== i) alvos.push(ferirInimigo(o, variar(forca * 0.4) - o.def * 0.25, ainda));
        if (classes.has('escudo') && i.hp > 0) i.tonto = true;
        if (classes.has('erva')) {
          for (const x of vivos()) {
            const cura = Math.min(atributos(x).hpMax - x.hp, 15);
            x.hp += cura;
            alvos.push({ quem: { h: x.userId }, cura });
          }
        }
        evento({ tipo: 'combo', de: { h: ainda[0].userId }, membros: ainda.map((h) => h.userId), alvos });
      };

      const ferirHeroi = (alvo: Heroi, dano: number): Alvo & { protegido?: boolean } => {
        let h = alvo;
        let protegido = false;
        // o Escudo protegendo leva o golpe no lugar de quem está atrás dele, com metade
        const escudo = vivos().find((x) => x.protegendo && x !== alvo);
        if (escudo) {
          h = escudo;
          protegido = true;
        }
        const a = atributos(h);
        let d = dano - a.def * 0.5;
        if (h.defendendo || h.protegendo) d *= 0.5;
        const final = Math.max(1, Math.round(d));
        h.hp = Math.max(0, h.hp - final);
        return { quem: { h: h.userId }, dano: final, ko: h.hp <= 0, protegido };
      };

      const agirInimigo = (i: Inimigo) => {
        if (i.hp <= 0 || !vivos().length) return;
        if (i.tonto) {
          i.tonto = false;
          return evento({ tipo: 'tonto', de: { i: i.id }, alvos: [] });
        }
        if (i.chefe && i.preparando) {
          i.preparando = false;
          // o sopro: a turma inteira (o "proteger" não segura fogo que vem de todo lado: só o defender)
          const alvos = vivos().map((h) => {
            const a = atributos(h);
            let d = variar(i.atk * 0.85) - a.def * 0.5;
            if (h.defendendo || h.protegendo) d *= 0.5;
            const final = Math.max(1, Math.round(d));
            h.hp = Math.max(0, h.hp - final);
            return { quem: { h: h.userId }, dano: final, ko: h.hp <= 0 } as Alvo;
          });
          return evento({ tipo: 'sopro', de: { i: i.id }, alvos });
        }
        if (i.chefe && rodada % 3 === 2) {
          i.preparando = true;
          return evento({ tipo: 'preparar', de: { i: i.id }, alvos: [] });
        }
        // o alvo: ao acaso, com o Escudo chamando mais atenção
        const turma = vivos();
        const pesos = turma.map((h) => (h.classe === 'escudo' ? 2 : 1));
        let r = aleatorio() * pesos.reduce((s, p) => s + p, 0);
        let alvo = turma[turma.length - 1];
        for (let k = 0; k < turma.length; k++) {
          r -= pesos[k];
          if (r < 0) {
            alvo = turma[k];
            break;
          }
        }
        const { protegido, ...a } = ferirHeroi(alvo, variar(i.atk));
        evento({ tipo: 'inimigo', de: { i: i.id }, alvos: [a], protegido });
      };

      const resolver = () => {
        if (fase !== 'escolha') return;
        eventos = [];
        // o que vale desde o começo da rodada: defender e proteger
        for (const h of vivos()) {
          const a = atributos(h);
          h.defendendo = h.escolha?.acao === 'defender';
          h.protegendo = h.escolha?.acao === 'habilidade' && h.classe === 'escudo' && h.en >= a.custo;
          if (h.defendendo) evento({ tipo: 'defender', de: { h: h.userId }, alvos: [] });
          if (h.protegendo) evento({ tipo: 'habilidade', de: { h: h.userId }, alvos: [] });
        }
        // o combo: quem o escolheu e tem energia; com dois ou mais, age na vez do mais rápido
        const noCombo = vivos().filter((h) => h.escolha?.acao === 'combo' && h.en >= CUSTO_DO_COMBO);
        const combo = noCombo.length >= 2 ? noCombo : [];
        const alvoDoCombo = combo.length ? (combo.find((h) => !ehRobo(h.userId))?.escolha?.alvo ?? combo[0].escolha!.alvo) : null;
        // a ordem: pela velocidade, com um pouco de sorte
        const fila: { vel: number; agir: () => void }[] = [];
        let comboNaFila = false;
        for (const h of vivos()) {
          if (combo.includes(h)) {
            if (comboNaFila) continue;
            comboNaFila = true;
            fila.push({ vel: Math.max(...combo.map((x) => atributos(x).vel)) + aleatorio() * 3, agir: () => agirCombo(combo, alvoDoCombo) });
            continue;
          }
          fila.push({ vel: atributos(h).vel + aleatorio() * 3, agir: () => agirHeroi(h) });
        }
        for (const i of inimigosVivos()) fila.push({ vel: i.vel + aleatorio() * 3, agir: () => agirInimigo(i) });
        embaralhar(fila, aleatorio).sort((a, b) => b.vel - a.vel);
        for (const f of fila) {
          if (!inimigosVivos().length || !vivos().length) break;
          f.agir();
        }
        // a energia volta um pouco a cada rodada (mais a quem se defendeu)
        for (const h of vivos()) h.en = Math.min(atributos(h).enMax, h.en + (h.defendendo ? 2 : 1));
        resolucao++;
        fase = 'acao';
        ctx.agendar(ACAO_FOLGA_MS + eventos.length * EVENTO_MS, depoisDaAcao);
        ctx.avisar();
      };

      const depoisDaAcao = () => {
        if (fase !== 'acao') return;
        if (!vivos().length || rodada >= RODADAS_MAX) return fim(false);
        if (inimigosVivos().length) return novaRodada();
        if (ROTA[parada].tipo === 'chefe') return fim(true);
        // a luta acabou: quem caiu levanta com um pouco de vida, e a energia enche
        for (const h of herois.values()) {
          const a = atributos(h);
          if (h.hp <= 0) h.hp = Math.round(a.hpMax * 0.3);
          h.en = a.enMax;
          h.defendendo = h.protegendo = false;
          h.escolha = null;
        }
        abrirEspolio();
      };

      // ---------------- O ESPÓLIO ----------------
      const abrirEspolio = () => {
        fase = 'espolio';
        espolio = new Map();
        decidiram.clear();
        peloRobo.clear();
        for (const id of ordem) {
          const peca = PECAS[Math.floor(aleatorio() * PECAS.length)];
          // a peça melhora com o caminho: a da neve é melhor que a da floresta
          const valor = peca === 'amuleto' ? 10 + parada * 4 + Math.floor(aleatorio() * 8) : 2 + parada + Math.floor(aleatorio() * 3);
          espolio.set(id, { peca, valor });
        }
        for (const id of ordem) if (ehRobo(id) || !presente(id)) decidirEspolio(id, null);
        ctx.agendar(relogio(TEMPO_DO_ESPOLIO), fecharEspolio);
        if (!conferirEspolio()) ctx.avisar();
      };
      /** `equipar` null: o robô decide (veste se é melhor). */
      const decidirEspolio = (id: number, equipar: boolean | null) => {
        if (decidiram.has(id)) return;
        const h = herois.get(id)!;
        const item = espolio.get(id)!;
        if (equipar === null && !ehRobo(id)) peloRobo.add(id);
        const vestir = equipar ?? item.valor > h.equip[item.peca];
        if (vestir) {
          const antes = atributos(h).hpMax;
          h.equip[item.peca] = item.valor;
          h.hp = Math.max(1, h.hp + atributos(h).hpMax - antes);
        }
        decidiram.add(id);
      };
      const conferirEspolio = () => {
        if (fase !== 'espolio') return false;
        for (const id of humanos) if (!presente(id)) decidirEspolio(id, null);
        if (ordem.every((id) => decidiram.has(id))) {
          parada++;
          irAoMapa();
          return true;
        }
        return false;
      };
      const fecharEspolio = () => {
        if (fase !== 'espolio') return;
        for (const id of ordem) decidirEspolio(id, null);
        conferirEspolio();
      };

      // ---------------- O FIM ----------------
      const fim = (ganhou: boolean) => {
        fase = 'fim';
        venceu = ganhou;
        const ficaram = humanos.filter(presente);
        const linhas = ordem
          .map((id) => ({ userId: id, username: ctx.nome(id), pontos: herois.get(id)!.pontos }))
          .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
        // a posição só entre quem é gente e ficou até o fim (empatados dividem); robôs e quem saiu ficam sem
        const contam = linhas.filter((l) => ficaram.includes(l.userId));
        resultado = linhas.map((l) => ({
          ...l,
          posicao: contam.includes(l) ? 1 + contam.filter((o) => o.pontos > l.pontos).length : null,
        }));
        // O PÓDIO: o dragão vencido, 2 pessoas ou mais que ficaram, até o 3º, fora do Solo
        if (ganhou && !solo && contam.length >= 2 && servicos) {
          const evento_ = `lendas-${ctx.comunidade ?? 0}-${agora()}`;
          for (const l of resultado) {
            if (l.posicao === null || l.posicao > 3) continue;
            servicos.guardarTrofeu({
              userId: l.userId,
              evento: evento_,
              communityId: ctx.comunidade ?? 0,
              pista: 'lendas',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: contam.map((o) => o.userId).filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar(true);
      };

      // ---------------- O COMEÇO ----------------
      ctx.agendar(relogio(TEMPO_DA_CLASSE), fecharClasses);

      const jogo: Jogo & Record<string, unknown> = {
        publico(quem) {
          const meu = herois.get(quem);
          return {
            partidaId,
            fase,
            parada,
            rota: ROTA.map((p) => ({ id: p.id, tipo: p.tipo })),
            rodada,
            resolucao,
            venceu,
            herois: ordem.map((id) => {
              const h = herois.get(id)!;
              const a = atributos(h);
              return {
                userId: id,
                username: ctx.nome(id),
                avatar: avatares.get(id) ?? null,
                robo: ehRobo(id),
                presente: ehRobo(id) || presente(id),
                classe: h.classe,
                hp: h.hp,
                hpMax: a.hpMax,
                en: h.en,
                enMax: a.enMax,
                atk: a.atk,
                mag: a.mag,
                def: a.def,
                custo: a.custo,
                equip: h.equip,
                pontos: h.pontos,
                // os outros só sabem SE escolheu; a ação de cada um aparece quando a rodada se resolve (como numa mesa)
                escolheu: fase === 'escolha' ? !!h.escolha : fase === 'espolio' ? decidiram.has(id) : !!h.classe,
                peloRobo: peloRobo.has(id),
                // o combo é a exceção: a turma precisa ver quem chamou, para ir junto
                noCombo: fase === 'escolha' && h.escolha?.acao === 'combo',
                alvoDoCombo: fase === 'escolha' && h.escolha?.acao === 'combo' ? h.escolha.alvo : null,
              };
            }),
            inimigos: inimigos.map((i) => ({ id: i.id, tipo: i.tipo, hp: i.hp, hpMax: i.hpMax, chefe: i.chefe, tonto: i.tonto, preparando: i.preparando })),
            eventos,
            minhaEscolha: meu?.escolha ?? null,
            meuEspolio: fase === 'espolio' && meu ? { item: espolio.get(quem) ?? null, atual: meu.equip, decidi: decidiram.has(quem) } : null,
            resultado,
          };
        },

        acao(quem, corpo) {
          const h = herois.get(quem);
          if (!h || ehRobo(quem)) return 'Você está assistindo esta partida.';
          const tipo = corpo.tipo;
          if (tipo === 'classe') {
            if (fase !== 'classes') return 'Agora não dá.';
            const c = corpo.classe as Classe;
            if (!CLASSES.includes(c)) return 'Agora não dá.';
            vestir(h, c);
            if (humanos.every((id) => herois.get(id)!.classe)) fecharClasses();
            else ctx.avisar();
            return null;
          }
          if (tipo === 'acao') {
            if (fase !== 'escolha' || h.hp <= 0) return 'Agora não dá.';
            const acao = corpo.acao as Acao;
            if (!ACOES.includes(acao)) return 'Agora não dá.';
            const alvo = Number.isInteger(corpo.alvo) ? (corpo.alvo as number) : null;
            const a = atributos(h);
            if (acao === 'habilidade' && h.en < a.custo) return 'Sem energia.';
            if (acao === 'combo' && h.en < CUSTO_DO_COMBO) return 'Sem energia.';
            if ((acao === 'atacar' || acao === 'combo' || (acao === 'habilidade' && h.classe === 'flecha')) && !inimigos.some((i) => i.id === alvo && i.hp > 0)) {
              return 'Agora não dá.';
            }
            h.escolha = { acao, alvo };
            peloRobo.delete(quem);
            if (acao === 'combo') atenderCombo(h);
            if (!conferirEscolhas()) ctx.avisar();
            return null;
          }
          if (tipo === 'espolio') {
            if (fase !== 'espolio' || decidiram.has(quem)) return 'Agora não dá.';
            decidirEspolio(quem, corpo.equipar === true);
            if (!conferirEspolio()) ctx.avisar();
            return null;
          }
          return 'Agora não dá.';
        },

        conferir() {
          if (fase === 'classes') conferirClasses();
          else if (fase === 'escolha') conferirEscolhas();
          else if (fase === 'espolio') conferirEspolio();
        },

        // para o teste
        _herois: herois,
        _inimigos: () => inimigos,
      };
      return jogo;
    },
  };
}
