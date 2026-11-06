import { CAMINHOS, copiar, liberar, passo, primeiroDaFila, naFila, travado, type Estado } from './sim';

/**
 * O PILOTO AUTOMÁTICO do Trânsito da toca: serve aos testes (um minuto sem batida) e ao e2e (window.transitoPilotoAutomatico, só no
 * site de desenvolvimento). Olha o futuro: copia a partida, solta o carro e anda uns 2,5 s sem soltar mais ninguém; se ninguém
 * bateu, solta de verdade. As ruas com fila maior (e a ambulância) primeiro.
 */
export function escolhaDoPiloto(e: Estado, horizonte = 150): number {
  if (travado(e)) return -1;
  const candidatas: { entrada: number; peso: number }[] = [];
  for (let entrada = 0; entrada < 4; entrada++) {
    const c = primeiroDaFila(e, entrada);
    if (!c || c.s < CAMINHOS[c.caminho].parada - 0.4) continue;
    candidatas.push({ entrada, peso: naFila(e, entrada) + (c.tipo === 'ambulancia' ? 3 : 0) });
  }
  candidatas.sort((a, b) => b.peso - a.peso || a.entrada - b.entrada);
  for (const { entrada } of candidatas) if (seguro(e, entrada, horizonte)) return entrada;
  return -1;
}

export function seguro(e: Estado, entrada: number, horizonte = 150): boolean {
  const f = copiar(e);
  if (!liberar(f, entrada)) return false;
  const antes = f.batidas;
  for (let i = 0; i < horizonte && !f.terminou; i++) passo(f);
  return f.batidas === antes;
}
