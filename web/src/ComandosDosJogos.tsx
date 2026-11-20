/**
 * OS COMANDOS DOS MINI-GAMES, EM FIGURAS (05/11/2026, pedido dele: "use os input prompts nos mini-games para o usuário saber o
 * que precisa clicar"). As teclas, o mouse e os gestos de toque são os Input Prompts da Kenney (CC0,
 * web/src/comandos/License.txt; o crédito nos termos, seção 10), em vetor, com as cores do tema. Com mouse e teclado aparecem as teclas e o mouse; na tela de toque, os gestos (e o que não tem
 * gesto some: lá os botões da tela já são os comandos).
 */

import { TeclaDesenhada as Icone, type Figura } from './TeclaDesenhada';

export type { Figura };

export interface Comando {
  /** As figuras do teclado e do mouse (mais de uma: "Z ou Espaço"). */
  teclas: Figura[];
  /** O gesto na tela de toque; sem ele, o comando não aparece lá. */
  toque?: Figura;
  rotulo: string;
}

export function ComandosDoJogo({ itens }: { itens: Comando[] }) {
  const toque = itens.filter((c) => c.toque);
  return (
    <div className="jogo-comandos" aria-hidden="true">
      <ul className="jogo-comandos-teclado">
        {itens.map((c) => (
          <li key={c.rotulo}>
            <span className="jogo-comando-figuras">
              {/* a mesma figura pode vir duas vezes (o toque duplo da arrancada da Briga) */}
              {c.teclas.map((f, i) => (
                <Icone key={f + i} f={f} />
              ))}
            </span>
            <span className="jogo-comando-rotulo">{c.rotulo}</span>
          </li>
        ))}
      </ul>
      {toque.length > 0 && (
        <ul className="jogo-comandos-toque">
          {toque.map((c) => (
            <li key={c.rotulo}>
              <span className="jogo-comando-figuras">
                <Icone f={c.toque!} />
              </span>
              <span className="jogo-comando-rotulo">{c.rotulo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
