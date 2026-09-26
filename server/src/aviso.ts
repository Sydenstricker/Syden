/**
 * O recado do Syden para todo mundo: "vai ter manutenção às 22h", "a voz está instável", "voltamos".
 *
 * Existe porque avisar amigo por amigo não escala e não parece sério. A pessoa que entra no meio de uma
 * manutenção hoje só vê o Syden se comportando mal e conclui que ele é ruim — o aviso transforma isso
 * numa coisa combinada.
 *
 * **Fica em `kv`, não numa tabela nova.** É UM recado de cada vez: uma tabela com uma linha só seria
 * cerimônia. E fica no BANCO, e não numa variável de ambiente, porque precisa poder ser ligado e
 * desligado pela tela, sem reiniciar o servidor — justamente no momento em que o servidor está sendo
 * mexido é que menos se quer reiniciá-lo de novo.
 *
 * O texto vai para QUEM NÃO TEM CONTA também (a tela de entrada), então nunca pode conter nada de
 * ninguém: quem escreve é quem administra o Syden, e o que ele escrever aparece para o mundo.
 */
import * as db from './db.js';

const CHAVE = 'aviso-geral';

export type TomDoAviso = 'manutencao' | 'problema' | 'recado';

export interface Aviso {
  /** O que aparece na faixa. Vazio nunca chega aqui: aviso sem texto é aviso apagado. */
  texto: string;
  tom: TomDoAviso;
  /**
   * Quando o aviso para de aparecer sozinho (ISO), ou null para ficar até alguém apagar.
   *
   * É o campo que mais importa na prática: a manutenção acaba às 23h e quem administra vai dormir. Sem
   * hora de fim, a faixa vermelha amanhece na tela de todo mundo dizendo que o Syden está em manutenção
   * quando ele está perfeito — e aí ninguém mais acredita na faixa.
   */
  ate: string | null;
  /** Quando começa a aparecer (ISO), ou null para já. Serve para avisar de véspera. */
  de: string | null;
}

export const TONS: TomDoAviso[] = ['manutencao', 'problema', 'recado'];

/** Um pedido vindo da tela virando aviso, ou uma queixa dizendo o que está errado. */
export function lerAviso(corpo: unknown): { aviso: Aviso } | { erro: string } {
  const c = corpo as Partial<Record<keyof Aviso, unknown>> | null;
  const texto = typeof c?.texto === 'string' ? c.texto.trim() : '';
  if (texto.length < 4) return { erro: 'Escreva o recado.' };
  if (texto.length > 300) return { erro: 'O recado precisa caber em 300 letras.' };

  const tom = c?.tom;
  if (typeof tom !== 'string' || !TONS.includes(tom as TomDoAviso)) return { erro: 'Escolha o tipo do recado.' };

  const data = (valor: unknown, campo: string): { ok: string | null } | { erro: string } => {
    if (valor === null || valor === undefined || valor === '') return { ok: null };
    if (typeof valor !== 'string') return { erro: `A ${campo} está num formato que não dá para ler.` };
    const quando = new Date(valor);
    if (Number.isNaN(quando.getTime())) return { erro: `A ${campo} está num formato que não dá para ler.` };
    return { ok: quando.toISOString() };
  };

  const de = data(c?.de, 'hora de começar');
  if ('erro' in de) return { erro: de.erro };
  const ate = data(c?.ate, 'hora de terminar');
  if ('erro' in ate) return { erro: ate.erro };

  // Terminar antes de começar deixaria um aviso que nunca aparece — e quem escreveu iria embora
  // achando que avisou.
  if (de.ok && ate.ok && ate.ok <= de.ok) return { erro: 'A hora de terminar tem que ser depois da de começar.' };

  return { aviso: { texto, tom: tom as TomDoAviso, de: de.ok, ate: ate.ok } };
}

/** O aviso que está valendo NESTE instante, ou null. Vencido some sozinho, sem ninguém precisar apagar. */
export function avisoDeAgora(agora = new Date()): Aviso | null {
  const bruto = db.getKv(CHAVE);
  if (!bruto) return null;
  let aviso: Aviso;
  try {
    aviso = JSON.parse(bruto) as Aviso;
  } catch {
    return null;
  }
  if (!aviso?.texto) return null;
  const quando = agora.toISOString();
  if (aviso.de && quando < aviso.de) return null;
  if (aviso.ate && quando >= aviso.ate) return null;
  return aviso;
}

/** O aviso guardado, valendo ou não. É o que a tela de quem administra precisa ver para poder editar. */
export function avisoGuardado(): Aviso | null {
  const bruto = db.getKv(CHAVE);
  if (!bruto) return null;
  try {
    const aviso = JSON.parse(bruto) as Aviso;
    return aviso?.texto ? aviso : null;
  } catch {
    return null;
  }
}

export function guardarAviso(aviso: Aviso) {
  db.setKv(CHAVE, JSON.stringify(aviso));
}

export function apagarAviso() {
  db.setKv(CHAVE, '');
}
