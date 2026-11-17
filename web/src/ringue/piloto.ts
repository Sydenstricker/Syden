/**
 * O PILOTO AUTOMÁTICO DO RINGUE (os testes e o e2e; no site, só no de desenvolvimento, por window.ringuePilotoAutomatico). Ele
 * lê os AVISOS como quem joga leria: o brilho na luva (soca para interromper), o lado de onde o golpe vem (esquiva para o outro,
 * abaixa ou defende no fim do aviso), a finta (não reage: ela nunca brilha), e bate na brecha. Devolve os comandos do passo.
 */
import { BAIXO, CIMA, DIR, ESQ, FORTE, LIVRA_BAIXO, LIVRA_DIR, LIVRA_ESQ, SOCO_D, SOCO_E, type Luta } from './sim';

/** Quantos passos antes do golpe sair ele reage (um reflexo de ~0,2 s). */
const REAGE = 13;

export function comandoDoPiloto(l: Luta): number {
  const j = l.j;
  const a = l.a;
  // apertar é a passagem de solto para apertado: o que já está apertado solta primeiro
  const apertar = (bit: number) => ((l.prev & bit) !== 0 ? 0 : bit);
  if (l.fase !== 'luta') return 0;
  if (l.queda === 'jogador') return l.passo % 4 < 2 ? apertar(SOCO_E) : 0;
  if (l.queda !== null) return 0;
  if (j.estado !== 'pronto' && j.estado !== 'guarda') return 0;
  const soco = () => {
    // alterna as mãos
    const lado = l.passo % 28 < 14 ? SOCO_E : SOCO_D;
    return apertar(lado) || apertar(lado === SOCO_E ? SOCO_D : SOCO_E);
  };
  if (a.estado === 'aviso' && a.golpe) {
    const g = a.golpe;
    const resta = g.aviso - a.t;
    if (g.brilho && a.t >= g.brilho[0] && a.t <= g.brilho[1] && resta > 8 && j.cansado === 0) return soco();
    if (resta <= REAGE) {
      if ((g.livra & LIVRA_ESQ) !== 0) return apertar(ESQ);
      if ((g.livra & LIVRA_DIR) !== 0) return apertar(DIR);
      if ((g.livra & LIVRA_BAIXO) !== 0) return apertar(BAIXO);
      return CIMA;
    }
    return 0;
  }
  if (a.estado === 'finta') return 0;
  if (j.cansado > 0) return 0;
  if (a.estado === 'aberto' || a.estado === 'atordoado' || a.estado === 'provoca') {
    if (j.estrelas >= 2 || (j.estrelas >= 1 && a.vida <= 30)) return apertar(FORTE);
    return soco();
  }
  if (a.estado === 'guarda' && a.guarda !== 0 && a.dura - a.t > 16) {
    // a guarda de um lado deixa o outro aberto
    return apertar(a.guarda < 0 ? SOCO_D : SOCO_E);
  }
  return 0;
}
