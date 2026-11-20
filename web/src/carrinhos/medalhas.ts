import { FAIXA_DO_RECORDE, IDS_DAS_PISTAS, novoCarro, passo, PASSOS_MAXIMOS, pilotoAutomatico, PISTAS } from './sim';

/**
 * AS MEDALHAS DOS CARRINHOS (20/11/2026), só nos traçados prontos (as pistas do editor não têm): ouro, prata e bronze sobre o
 * tempo do PILOTO AUTOMÁTICO quase perfeito (margem 0,15) na faixa do recorde, nas 5 ou nas 20 voltas. Aqui só se acelera e
 * solta, e o piloto chega perto do melhor possível; por isso os fatores são mais apertados que os do jato e da regata (o piloto
 * de margem 0,3, o dos testes, fica 1,4–2,1% atrás e leva o ouro por pouco). É conta de site (a regra é a mesma do servidor), feita uma vez por
 * pista e voltas, e guardada. Só tela.
 */
export const FATORES_DOS_CARRINHOS = [1.025, 1.08, 1.18] as const;

const guardados = new Map<string, number>();

/** O tempo do piloto (em passos) num traçado pronto, com `voltas` voltas; null nas pistas do editor. */
export function tempoDoPilotoNosCarrinhos(id: string, voltas: number): number | null {
  if (!IDS_DAS_PISTAS.includes(id)) return null;
  const chave = `${id}@${voltas}`;
  let t = guardados.get(chave);
  if (t === undefined) {
    const c = novoCarro(FAIXA_DO_RECORDE, PISTAS[id], voltas);
    while (!c.chegou && c.passo < PASSOS_MAXIMOS) passo(c, pilotoAutomatico(c, 0.15));
    t = c.voltas[voltas - 1] ?? 0;
    guardados.set(chave, t);
  }
  return t || null;
}
