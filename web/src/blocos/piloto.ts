import { CAIXA, COLUNAS, LINHAS, PARADO, TIPOS, VAZIO, podeTrocar, type Estado } from './sim';

/**
 * O PILOTO AUTOMÁTICO da Horta em cascata: para o teste (web/test/blocos.test.ts) e para o teste de tela (e2e/blocos.mjs,
 * por window.blocosPilotoAutomatico, só no site de desenvolvimento). Ele não é esperto: procura uma troca que faça três
 * iguais na hora, e sobe a pilha quando ela está baixa. Joga pelas mesmas jogadas que a mão, e nada mais.
 */
export function escolherJogada(e: Estado): { tipo: 'troca'; l: number; c: number } | { tipo: 'subir' } | null {
  const C = COLUNAS;
  const parado = (i: number) => e.tipo[i] !== VAZIO && e.estado[i] === PARADO && e.tipo[i] !== CAIXA;
  const tipo = e.tipo.slice();
  const trio = (i: number) => {
    const t = tipo[i];
    if (t === VAZIO || t >= TIPOS) return false;
    const l = Math.floor(i / C);
    const c = i % C;
    const igual = (ll: number, cc: number) => ll >= 0 && ll < LINHAS && cc >= 0 && cc < C && tipo[ll * C + cc] === t && (ll * C + cc === i || parado(ll * C + cc));
    let h = 1;
    for (let k = c - 1; igual(l, k); k--) h++;
    for (let k = c + 1; igual(l, k); k++) h++;
    let v = 1;
    for (let k = l - 1; igual(k, c); k--) v++;
    for (let k = l + 1; igual(k, c); k++) v++;
    return h >= 3 || v >= 3;
  };
  // de baixo para cima: a combinação embaixo faz o resto cair, e às vezes vira cadeia
  for (let l = LINHAS - 1; l >= 0; l--) {
    for (let c = 0; c < C - 1; c++) {
      if (!podeTrocar(e, l, c)) continue;
      const i = l * C + c;
      // as duas apoiadas (a troca sobre um buraco faz cair, e aí o trio não está garantido)
      const apoiada = (k: number) => Math.floor(k / C) === LINHAS - 1 || tipo[k + C] !== VAZIO;
      if (!apoiada(i) || !apoiada(i + 1)) continue;
      [tipo[i], tipo[i + 1]] = [tipo[i + 1], tipo[i]];
      const bom = trio(i) || trio(i + 1);
      [tipo[i], tipo[i + 1]] = [tipo[i + 1], tipo[i]];
      if (bom) return { tipo: 'troca', l, c };
    }
  }
  // a pilha baixa: sobe
  let alto = LINHAS;
  for (let i = 0; i < e.tipo.length; i++) if (e.tipo[i] !== VAZIO) {
    alto = Math.floor(i / C);
    break;
  }
  if (alto > 6 && !e.forcando) return { tipo: 'subir' };
  // sem trio à vista: empurra uma peça alta para o lado mais baixo (alisa a pilha)
  const altura = (c: number) => {
    for (let l = 0; l < LINHAS; l++) if (e.tipo[l * C + c] !== VAZIO) return LINHAS - l;
    return 0;
  };
  for (let c = 0; c < C - 1; c++) {
    const a = altura(c);
    const b = altura(c + 1);
    if (Math.abs(a - b) >= 2) {
      const l = LINHAS - Math.max(a, b);
      if (podeTrocar(e, l, c)) return { tipo: 'troca', l, c };
    }
  }
  return null;
}
