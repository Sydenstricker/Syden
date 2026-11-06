import { useState } from 'react';
import { chave, useT } from './i18n';
import type { IdDoJogo } from './minijogos';

/**
 * O FICHÁRIO DE GÊNEROS (05/11/2026, pedido dele: "como estamos com uma lista grande de jogos, seria legal ter um catálogo de
 * gêneros, como um fichário, para o usuário escolher o que ele quer"). Em cima da estante, uma ficha por gênero, como as orelhas
 * de um fichário, e a ficha "Tudo". Um jogo pode estar em mais de um gênero (o Desenha e adivinha é de palavra e de festa). A
 * ficha escolhida fica lembrada no aparelho (é conveniência de quem olha, não estado de ninguém), e só aparecem as fichas que
 * têm jogo na aba de agora.
 *
 * Jogo novo: uma linha em GENEROS_DOS_JOGOS (o teste confere que todo jogo da estante tem gênero).
 */
export type Genero = 'mesa' | 'esporte' | 'acao' | 'raciocinio' | 'palavras' | 'festa' | 'estrategia';

// A ordem é a do fichário: a festa primeiro (pedido dele, 05/11/2026: "uma aba como party-games, outra esportes"). A cor de cada
// ficha mora no CSS (.ficha-<id>), para a aba e a estante embaixo dela serem da mesma cor, como a divisória de um fichário.
export const GENEROS: { id: Genero; emoji: string; nome: string }[] = [
  { id: 'festa', emoji: '🎉', nome: chave('Festa e tabuleiro') },
  { id: 'esporte', emoji: '🏁', nome: chave('Corrida e esporte') },
  { id: 'acao', emoji: '⚡', nome: chave('Ação') },
  { id: 'mesa', emoji: '🎲', nome: chave('Mesa e cartas') },
  { id: 'raciocinio', emoji: '🧩', nome: chave('Raciocínio') },
  { id: 'palavras', emoji: '💬', nome: chave('Palavras e perguntas') },
  { id: 'estrategia', emoji: '🏰', nome: chave('Estratégia') },
];

export const GENEROS_DOS_JOGOS: Partial<Record<IdDoJogo | string, Genero[]>> = {
  domino: ['mesa'],
  truco: ['mesa'],
  damas: ['mesa'],
  'partida-de-xadrez': ['mesa', 'estrategia'],
  gomoku: ['mesa'],
  mancala: ['mesa'],
  naval: ['mesa'],
  corrida: ['esporte'],
  balao: ['esporte', 'acao'],
  jato: ['esporte'],
  barco: ['esporte'],
  carrinhos: ['esporte'],
  golfe: ['esporte'],
  golfe3d: ['esporte'],
  futebol: ['esporte'],
  skate: ['esporte', 'acao'],
  briga: ['acao'],
  chefe: ['acao', 'festa'],
  duelo: ['acao', 'festa'],
  plataforma: ['acao'],
  torre: ['acao'],
  caca: ['acao'],
  transito: ['acao', 'raciocinio'],
  ponte: ['raciocinio'],
  nave: ['acao'],
  cozinha: ['acao'],
  sudoku: ['raciocinio'],
  xadrez: ['raciocinio'],
  blocos: ['raciocinio'],
  tamanho: ['raciocinio', 'festa'],
  stop: ['palavras', 'festa'],
  palavra: ['palavras'],
  monstros: ['palavras'],
  mitologia: ['palavras'],
  paises: ['palavras'],
  desenho: ['palavras', 'festa'],
  festa: ['festa'],
  tabuleiro: ['festa'],
  cidades: ['festa', 'estrategia'],
  lobisomem: ['festa'],
  tocas: ['estrategia'],
};

export const generosDe = (jogo: string): Genero[] => GENEROS_DOS_JOGOS[jogo] ?? [];

const GUARDADO = 'syden:fichario';

/** A ficha escolhida (null = Tudo), lembrada no aparelho. */
export function useFicha() {
  const [ficha, setFicha] = useState<Genero | null>(() => {
    try {
      const v = localStorage.getItem(GUARDADO);
      return GENEROS.some((g) => g.id === v) ? (v as Genero) : null;
    } catch {
      return null;
    }
  });
  const escolher = (g: Genero | null) => {
    setFicha(g);
    try {
      if (g) localStorage.setItem(GUARDADO, g);
      else localStorage.removeItem(GUARDADO);
    } catch {
      // sem armazenamento: só não lembra
    }
  };
  return [ficha, escolher] as const;
}

/** A ficha que vale de verdade: a escolhida, se ela tem jogo aqui; senão, "Tudo" (null). */
export function fichaQueVale(jogos: string[], ficha: Genero | null): Genero | null {
  return ficha && jogos.some((j) => generosDe(j).includes(ficha)) ? ficha : null;
}

/** A classe da cor da ficha (a aba e a estante embaixo dela). */
export const classeDaFicha = (ficha: Genero | null) => `ficha-${ficha ?? 'tudo'}`;

/** As fichas: "Tudo" e os gêneros que têm algum dos `jogos`. Se a ficha guardada não tem jogo aqui, vale "Tudo". */
export function FicharioDeGeneros({ jogos, ficha, aoEscolher }: { jogos: string[]; ficha: Genero | null; aoEscolher: (g: Genero | null) => void }) {
  const t = useT();
  const comJogo = GENEROS.filter((g) => jogos.some((j) => generosDe(j).includes(g.id)));
  const atual = fichaQueVale(jogos, ficha);
  const ficha_ = (id: Genero | null, rotulo: string, emoji: string) => (
    <button
      key={id ?? 'tudo'}
      type="button"
      role="tab"
      aria-selected={atual === id}
      className={`fichario-ficha ${classeDaFicha(id)}${atual === id ? ' ativa' : ''}`}
      onClick={() => aoEscolher(id)}
    >
      <span aria-hidden="true">{emoji}</span> {rotulo}
    </button>
  );
  return (
    <div className={`fichario ${classeDaFicha(atual)}`} role="tablist" aria-label={t('Gêneros')}>
      {ficha_(null, t('Tudo'), '📚')}
      {comJogo.map((g) => ficha_(g.id, t(g.nome), g.emoji))}
    </div>
  );
}

/** Os jogos da ficha (todos, na ficha "Tudo" ou numa ficha que não tem jogo aqui). */
export function naFicha<J extends { id: string }>(jogos: J[], ficha: Genero | null): J[] {
  if (!ficha) return jogos;
  const filtrados = jogos.filter((j) => generosDe(j.id).includes(ficha));
  return filtrados.length ? filtrados : jogos;
}
