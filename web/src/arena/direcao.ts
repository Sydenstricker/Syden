/**
 * A DIREÇÃO DO DESENHO NA ARENA (17/11/2026): a mira em 360° mostra a direção mais perto entre as que o desenho do coelho tem.
 * Hoje são as quatro diagonais; quando as quatro retas existirem, entram sem mudar a regra. À parte de coelhos.ts para o teste
 * rodar sem o navegador.
 */

/** As oito direções e para onde cada uma olha (na tela: y para baixo é o sul). */
const R = 0.7071067811865476;
export const OITO: readonly (readonly [string, number, number])[] = [
  ['east', 1, 0],
  ['south-east', R, R],
  ['south', 0, 1],
  ['south-west', -R, R],
  ['west', -1, 0],
  ['north-west', -R, -R],
  ['north', 0, -1],
  ['north-east', R, -R],
];

/**
 * A direção do desenho para quem olha para (mx, my): a mais perto entre as que existem. Sem nenhuma, null (a animação não existe
 * para esse corpo: quem chama cai na outra).
 */
export function direcaoDoDesenho(mx: number, my: number, existem: Iterable<string>): string | null {
  const tem = new Set(existem);
  let melhor: string | null = null;
  let v = -Infinity;
  for (const [nome, dx, dy] of OITO) {
    if (!tem.has(nome)) continue;
    // o empate (olhando bem para o leste, entre o sudeste e o nordeste) vai para o de frente
    const p = mx * dx + my * dy + (dy > 0 ? 1e-6 : 0);
    if (p > v) {
      v = p;
      melhor = nome;
    }
  }
  return melhor;
}
