/**
 * TOCAS E TORRES: O COMPUTADOR (05/11/2026). Um roteiro simples, de um nível só: cresce (trabalhadores, casas, fazendas),
 * levanta o quartel e a arquearia, avança de era, e ataca EM ONDAS o centro da vila do outro, defendendo a base quando
 * alguém chega perto. Ele joga pelo MESMO caminho da pessoa (`comandar`), e só pensa uma vez por segundo.
 *
 * É determinístico como a simulação (lê só o estado dela), e por isso o piloto automático dos testes é ele mesmo, com um
 * jeito mais ambicioso (`PERFIS.piloto`): mais trabalhadores, catapultas, e o ataque que só para quando o centro cai.
 *
 * Ele sabe onde fica o centro do outro (o mapa é espelhado: não há segredo nisso) e conta o exército inimigo para escolher
 * a tropa da pedra-papel-tesoura; não usa mais nada que a névoa esconderia.
 */
import {
  CENTRO_DE,
  PREDIOS,
  POP_MAX,
  UNIDADES,
  centroDe,
  comandar,
  ePredio,
  eFonte,
  podeConstruir,
  podePagar,
  populacao,
  TAMANHO,
  type Dono,
  type Recurso,
  type Sim,
  type TipoPredio,
  type TipoUnidade,
  type Unidade,
  ERA2,
  alcancavel,
  passavel,
  acessivel,
  temVaga,
} from './sim';

export interface Perfil {
  trabalhadores: number;
  quartelCom: number;
  arqueariaCom: number;
  eraCom: number;
  torres: number;
  catapultas: number;
  /** O passo do primeiro ataque, e quantos soldados ele pede. */
  primeiroAtaque: number;
  onda: number;
  /** Passos entre uma onda e outra. */
  intervalo: number;
  /** Só treina tropa com tantos trabalhadores (ou com o inimigo na porta). */
  exercitoCom: number;
  /** Durante o ataque, com menos que isto, volta para casa. */
  recuo: number;
}

export const PERFIS: Record<'computador' | 'piloto', Perfil> = {
  computador: { trabalhadores: 16, quartelCom: 9, arqueariaCom: 12, eraCom: 14, torres: 1, catapultas: 1, primeiroAtaque: 4800, onda: 7, intervalo: 1500, recuo: 2, exercitoCom: 11 },
  piloto: { trabalhadores: 22, quartelCom: 9, arqueariaCom: 11, eraCom: 15, torres: 1, catapultas: 3, primeiroAtaque: 5400, onda: 12, intervalo: 600, recuo: 3, exercitoCom: 15 },
};

export type IA = (sim: Sim) => void;

export function criarIA(dono: Dono, perfil: Perfil = PERFIS.computador): IA {
  let atacando = false;
  let proximaOnda = perfil.primeiroAtaque;
  const inimigo = (1 - dono) as Dono;
  const alvoFinal = { x: CENTRO_DE[inimigo].gx + 1.5, y: CENTRO_DE[inimigo].gy + 1.5 };

  return (sim: Sim) => {
    if (sim.vencedor !== null || (sim.passo + dono * 5) % 10 !== 0) return;
    const j = sim.jogadores[dono];
    const centro = sim.predios.find((p) => p.dono === dono && p.tipo === 'centro');
    if (!centro) return;
    const meus = sim.unidades.filter((u) => u.dono === dono);
    const trab = meus.filter((u) => u.tipo === 'trabalhador');
    const exercito = meus.filter((u) => UNIDADES[u.tipo].combate);
    const predios = sim.predios.filter((p) => p.dono === dono);
    const tem = (t: TipoPredio, pronto = false) => predios.filter((p) => p.tipo === t && (!pronto || p.pronto));
    const pop = populacao(sim, dono);
    const naFila = predios.reduce((s, p) => s + p.fila.length, 0);
    const c = centroDe(centro);
    // guardar para a era: quando chega a hora, a tropa espera
    const querEra = j.era === 1 && trab.length >= perfil.eraCom && tem('quartel', true).length > 0 && centro.pesquisa === 0;

    // ---- a era ----
    if (querEra && podePagar(sim, dono, ERA2.custo)) comandar(sim, dono, { t: 'era', predio: centro.id });

    // ---- trabalhadores ----
    const trabNaFila = centro.fila.filter((t) => t === 'trabalhador').length;
    if (trab.length + trabNaFila < perfil.trabalhadores && centro.fila.length < 2 && centro.pesquisa === 0 && pop.usada + naFila < pop.max && podePagar(sim, dono, UNIDADES.trabalhador.custo))
      comandar(sim, dono, { t: 'treinar', predio: centro.id, unidade: 'trabalhador' });

    // ---- construir ----
    const ocupados = new Set<number>();
    const construir = (tipo: TipoPredio, lugar: { gx: number; gy: number } | null, quantos = 1) => {
      if (!lugar || !podePagar(sim, dono, PREDIOS[tipo].custo)) return false;
      const livres = trab
        .filter((u) => u.ordem.tipo !== 'construir' && !ocupados.has(u.id))
        .sort((a, b) => dist2(a, lugar.gx, lugar.gy) - dist2(b, lugar.gx, lugar.gy) || a.id - b.id)
        .slice(0, quantos);
      if (!livres.length) return false;
      for (const u of livres) ocupados.add(u.id);
      comandar(sim, dono, { t: 'construir', ids: livres.map((u) => u.id), tipo, gx: lugar.gx, gy: lugar.gy });
      return true;
    };
    const meio = TAMANHO / 2;
    const frente = { x: c.x + Math.sign(meio - c.x) * 7, y: c.y + Math.sign(meio - c.y) * 7 };
    const atras = { x: c.x - Math.sign(meio - c.x) * 6, y: c.y - Math.sign(meio - c.y) * 6 };
    const emObra = (t: TipoPredio) => tem(t).filter((p) => !p.pronto).length;

    if (pop.max < POP_MAX && pop.usada + naFila >= pop.max - 3 && emObra('casa') === 0) construir('casa', lugarPara(sim, dono, 'casa', c, 3, atras));
    const fazendas = tem('fazenda').length;
    const querComida = Math.round(trab.length * 0.34);
    if (fazendas < querComida && emObra('fazenda') < 2 && !querEra) construir('fazenda', lugarPara(sim, dono, 'fazenda', c, 3));
    if (trab.length >= perfil.quartelCom && !tem('quartel').length) construir('quartel', lugarPara(sim, dono, 'quartel', c, 4, frente), 2);
    if (trab.length >= perfil.arqueariaCom && !tem('arquearia').length && !querEra) construir('arquearia', lugarPara(sim, dono, 'arquearia', c, 4, frente), 2);
    if (tem('arquearia').length && tem('torre').length < perfil.torres && !querEra) construir('torre', lugarParaTorre(sim, dono, c));

    // ---- os trabalhadores parados vão trabalhar, na proporção; e quem colhe o que sobra muda para o que falta ----
    const conta: Record<Recurso, number> = { comida: 0, madeira: 0, ouro: 0 };
    const naFonte = new Map<number, number>();
    for (const u of trab) {
      const r = recursoDe(sim, u);
      if (r) conta[r]++;
      if (u.ordem.tipo === 'coletar' || u.ordem.tipo === 'entregar') {
        const f = u.ordem.alvo ?? u.ordem.volta;
        if (f !== undefined) naFonte.set(f, (naFonte.get(f) ?? 0) + 1);
      }
    }
    const mandar = (u: Unidade, r: Recurso) => {
      let alvo = 0;
      if (r === 'comida') {
        const f = tem('fazenda', true).find((p) => (naFonte.get(p.id) ?? 0) < 1);
        if (f) alvo = f.id;
      } else alvo = fontePerto(sim, r === 'madeira' ? 'arvore' : 'ouro', c.x, c.y, dono);
      if (!alvo) return false;
      naFonte.set(alvo, (naFonte.get(alvo) ?? 0) + 1);
      const antes = recursoDe(sim, u);
      if (antes) conta[antes]--;
      conta[r]++;
      comandar(sim, dono, { t: 'alvo', ids: [u.id], alvo });
      return true;
    };
    const prop: Record<Recurso, number> =
      j.era === 2 ? { comida: 0.34, madeira: 0.33, ouro: 0.33 } : tem('quartel').length ? { comida: 0.36, madeira: 0.36, ouro: 0.28 } : { comida: 0.38, madeira: 0.47, ouro: 0.15 };
    for (const u of trab.filter((x) => x.ordem.tipo === 'parado' && !ocupados.has(x.id))) {
      const total = conta.comida + conta.madeira + conta.ouro + 1;
      const ordem: Recurso[] = (['comida', 'madeira', 'ouro'] as Recurso[]).sort((a, b) => conta[a] / total - prop[a] - (conta[b] / total - prop[b]));
      if (!ordem.some((r) => mandar(u, r))) break;
    }
    if (sim.passo % 50 < 10) {
      const est = j.recursos;
      const rico = (['comida', 'madeira', 'ouro'] as Recurso[]).reduce((m, r) => (est[r] > est[m] ? r : m));
      const pobre = (['madeira', 'ouro', 'comida'] as Recurso[]).reduce((m, r) => (est[r] < est[m] ? r : m));
      if (est[rico] > 400 && est[rico] > est[pobre] * 3 + 150) {
        const quem = trab.find((u) => recursoDe(sim, u) === rico && !u.carga && !ocupados.has(u.id));
        if (quem) mandar(quem, pobre);
      }
    }

    // ---- a tropa ----
    const inimigos = sim.unidades.filter((u) => u.dono === inimigo);
    const perto = inimigos.filter((u) => dist2(u, c.x, c.y) < 14 * 14);
    if ((!querEra || exercito.length < 4) && (trab.length >= perfil.exercitoCom || perto.length > 0)) {
      const escolha = tropaContra(inimigos, exercito.length);
      for (const p of [...tem('quartel', true), ...tem('arquearia', true)]) {
        if (p.fila.length >= 2 || pop.usada + naFila >= pop.max) continue;
        let tipo: TipoUnidade | null = null;
        const catapultas = exercito.filter((u) => u.tipo === 'catapulta').length + p.fila.filter((t) => t === 'catapulta').length;
        if (p.tipo === 'quartel' && j.era === 2 && catapultas < perfil.catapultas && exercito.length >= 4) tipo = 'catapulta';
        else if (p.tipo === 'arquearia') tipo = escolha === 'arqueiro' || escolha === null ? 'arqueiro' : null;
        else tipo = escolha === 'arqueiro' ? 'lanceiro' : (escolha ?? 'lanceiro');
        if (!tipo) continue;
        if (p.tipo === 'quartel' && tipo === 'arqueiro') tipo = 'lanceiro';
        if (podePagar(sim, dono, UNIDADES[tipo].custo)) comandar(sim, dono, { t: 'treinar', predio: p.id, unidade: tipo });
      }
    }

    // ---- defender ----
    if (perto.length && !atacando) {
      const alvo = perto[0];
      const livres = exercito.filter((u) => u.ordem.tipo !== 'atacar');
      if (livres.length) comandar(sim, dono, { t: 'mover', ids: livres.map((u) => u.id), x: alvo.x, y: alvo.y, atacando: true });
      return;
    }

    // ---- atacar em ondas ----
    if (atacando) {
      if (exercito.length < perfil.recuo) {
        atacando = false;
        proximaOnda = sim.passo + perfil.intervalo;
        if (exercito.length) comandar(sim, dono, { t: 'mover', ids: exercito.map((u) => u.id), x: c.x, y: c.y + (dono === 0 ? -4 : 4) });
        return;
      }
      // quem parou (o alvo do caminho caiu) segue para o centro; quem chegou de reforço também
      const parados = exercito.filter((u) => u.ordem.tipo === 'parado' || (u.ordem.tipo === 'mover' && !u.ordem.atacando));
      if (parados.length) comandar(sim, dono, { t: 'mover', ids: parados.map((u) => u.id), x: alvoFinal.x, y: alvoFinal.y, atacando: true });
      // o piloto vai direto ao centro com quem está perto dele (as catapultas, de longe)
      const centroInimigo = sim.predios.find((p) => p.dono === inimigo && p.tipo === 'centro');
      if (centroInimigo) {
        const cats = exercito.filter((u) => u.tipo === 'catapulta' && u.ordem.tipo !== 'atacar' && dist2(u, alvoFinal.x, alvoFinal.y) < 12 * 12);
        if (cats.length) comandar(sim, dono, { t: 'alvo', ids: cats.map((u) => u.id), alvo: centroInimigo.id });
      }
      return;
    }
    if (sim.passo >= proximaOnda && exercito.length >= perfil.onda) {
      atacando = true;
      comandar(sim, dono, { t: 'mover', ids: exercito.map((u) => u.id), x: alvoFinal.x, y: alvoFinal.y, atacando: true });
    }
  };
}

const dist2 = (u: { x: number; y: number }, x: number, y: number) => (u.x - x) * (u.x - x) + (u.y - y) * (u.y - y);

function recursoDe(sim: Sim, u: Unidade): Recurso | null {
  if (u.carga) return u.carga.rec;
  if (u.ordem.tipo !== 'coletar' && u.ordem.tipo !== 'entregar') return null;
  const e = sim.porId.get(u.ordem.alvo ?? u.ordem.volta ?? 0);
  if (eFonte(e)) return e.tipo === 'arvore' ? 'madeira' : 'ouro';
  if (ePredio(e) && e.tipo === 'fazenda') return 'comida';
  return null;
}

/** A fonte do tipo mais perto do ponto (pela distância simples: o caminho de verdade é do A*). */
function fontePerto(sim: Sim, tipo: 'arvore' | 'ouro', x: number, y: number, dono: Dono): number {
  let melhor = 0;
  let dist = Infinity;
  // a mina de casa cheia (a capacidade, sim.ts): quem sobra vai a outro recurso, e não à do meio (a de quem chegar, longe e
  // no caminho do inimigo). A do meio só quando a de casa acabou.
  const temCasa = tipo === 'ouro' && sim.fontes.some((f) => f.tipo === 'ouro' && (f.gx + 0.5 - x) ** 2 + (f.gy + 0.5 - y) ** 2 < 14 * 14);
  for (const f of sim.fontes) {
    if (f.tipo !== tipo || !acessivel(sim, f, dono) || !temVaga(sim, dono, f.id)) continue;
    const d = (f.gx + 0.5 - x) * (f.gx + 0.5 - x) + (f.gy + 0.5 - y) * (f.gy + 0.5 - y);
    if (temCasa && d >= 14 * 14) continue;
    if (d < dist) {
      dist = d;
      melhor = f.id;
    }
  }
  return melhor;
}

/** A tropa que ganha da que o outro mais tem; sem exército do outro, uma mistura. */
function tropaContra(inimigos: Unidade[], meus: number): TipoUnidade | null {
  const conta: Partial<Record<TipoUnidade, number>> = {};
  for (const u of inimigos) if (UNIDADES[u.tipo].combate && u.tipo !== 'catapulta') conta[u.tipo] = (conta[u.tipo] ?? 0) + 1;
  let maior: TipoUnidade | null = null;
  for (const t of ['lanceiro', 'arqueiro', 'cavaleiro'] as TipoUnidade[]) if ((conta[t] ?? 0) > (maior ? conta[maior] ?? 0 : 0)) maior = t;
  if (maior === 'cavaleiro') return 'lanceiro';
  if (maior === 'lanceiro') return 'arqueiro';
  if (maior === 'arqueiro') return 'cavaleiro';
  return (['lanceiro', 'arqueiro', 'lanceiro', 'cavaleiro'] as TipoUnidade[])[meus % 4];
}

/**
 * Um lugar para o prédio: perto de `perto`, a até 13 casas do centro e a pelo menos `raioMin` dele, numa casa já vista, com uma
 * casa de folga entre prédios (para os caminhos ficarem abertos) e aonde dá para chegar.
 */
export function lugarPara(sim: Sim, dono: Dono, tipo: TipoPredio, c: { x: number; y: number }, raioMin: number, perto = c): { gx: number; gy: number } | null {
  const tam = PREDIOS[tipo].tam;
  const cand: { gx: number; gy: number; nota: number }[] = [];
  for (let gy = Math.floor(c.y - 14); gy <= c.y + 14; gy++)
    for (let gx = Math.floor(c.x - 14); gx <= c.x + 14; gx++) {
      const mx = gx + tam / 2 - c.x;
      const my = gy + tam / 2 - c.y;
      const r = Math.max(Math.abs(mx), Math.abs(my));
      if (r < raioMin || r > 13) continue;
      if (!podeConstruir(sim, dono, tipo, gx, gy) || !folga(sim, gx, gy, tam)) continue;
      const px = gx + tam / 2 - perto.x;
      const py = gy + tam / 2 - perto.y;
      cand.push({ gx, gy, nota: px * px + py * py });
    }
  cand.sort((a, b) => a.nota - b.nota || a.gy - b.gy || a.gx - b.gx);
  const s0 = saida(sim, dono, c);
  if (!s0) return null;
  for (const k of cand.slice(0, 6)) if (alcancavel(sim, dono, s0.x, s0.y, k.gx, k.gy, k.gx + tam - 1, k.gy + tam - 1)) return k;
  return null;
}

/** Uma casa livre colada no centro da vila, de onde se sai andando. */
function saida(sim: Sim, dono: Dono, c: { x: number; y: number }): { x: number; y: number } | null {
  for (let r = 2; r < 5; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.floor(c.x) + dx;
        const y = Math.floor(c.y) + dy;
        if (x < 0 || y < 0 || x >= TAMANHO || y >= TAMANHO) continue;
        if (passavel(sim, y * TAMANHO + x, dono)) return { x: x + 0.5, y: y + 0.5 };
      }
  return null;
}

function folga(sim: Sim, gx: number, gy: number, tam: number): boolean {
  for (let y = gy - 1; y <= gy + tam; y++)
    for (let x = gx - 1; x <= gx + tam; x++) {
      if (x < 0 || y < 0 || x >= TAMANHO || y >= TAMANHO) return false;
      const g = sim.grade[y * TAMANHO + x];
      if (g !== 0 && (g < 0 || ePredio(sim.porId.get(g)))) return false;
    }
  return true;
}

/** A torre fica entre a base e o meio do mapa, onde o ataque chega. */
function lugarParaTorre(sim: Sim, dono: Dono, c: { x: number; y: number }): { gx: number; gy: number } | null {
  const mx = TAMANHO / 2 - c.x;
  const my = TAMANHO / 2 - c.y;
  const d = Math.sqrt(mx * mx + my * my) || 1;
  const p = { x: c.x + (mx / d) * 6, y: c.y + (my / d) * 6 };
  return lugarPara(sim, dono, 'torre', c, 3, p);
}

