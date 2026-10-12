import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { chave } from './i18n';

/**
 * Os mini-games da sala de voz, do lado do site (o servidor decide tudo: server/src/minijogos.ts).
 *
 * O CATÁLOGO DO "QUAL É MAIOR?": o emoji e o nome de cada objeto, marcados para traduzir. Os TAMANHOS
 * moram só no servidor, que é quem decide quem acertou — e só chegam na revelação. O teste
 * web/test/minijogos.test.ts confere que as duas listas têm os mesmos ids.
 */
export const OBJETOS: Record<string, { emoji: string; nome: string }> = {
  bacteria: { emoji: '🦠', nome: chave('Bactéria') },
  formiga: { emoji: '🐜', nome: chave('Formiga') },
  abelha: { emoji: '🐝', nome: chave('Abelha') },
  morango: { emoji: '🍓', nome: chave('Morango') },
  ovo: { emoji: '🥚', nome: chave('Ovo de galinha') },
  'bola-de-tenis': { emoji: '🎾', nome: chave('Bola de tênis') },
  camundongo: { emoji: '🐭', nome: chave('Camundongo') },
  celular: { emoji: '📱', nome: chave('Celular') },
  lapis: { emoji: '✏️', nome: chave('Lápis') },
  banana: { emoji: '🍌', nome: chave('Banana') },
  'bola-de-futebol': { emoji: '⚽', nome: chave('Bola de futebol') },
  pizza: { emoji: '🍕', nome: chave('Pizza grande') },
  melancia: { emoji: '🍉', nome: chave('Melancia') },
  gato: { emoji: '🐈', nome: chave('Gato') },
  violao: { emoji: '🎸', nome: chave('Violão') },
  pinguim: { emoji: '🐧', nome: chave('Pinguim-imperador') },
  flamingo: { emoji: '🦩', nome: chave('Flamingo') },
  cavalo: { emoji: '🐎', nome: chave('Cavalo') },
  pessoa: { emoji: '🧍', nome: chave('Pessoa adulta') },
  bicicleta: { emoji: '🚲', nome: chave('Bicicleta') },
  porta: { emoji: '🚪', nome: chave('Porta') },
  urso: { emoji: '🐻', nome: chave('Urso-pardo em pé') },
  elefante: { emoji: '🐘', nome: chave('Elefante-africano') },
  moai: { emoji: '🗿', nome: chave('Moai da Ilha de Páscoa') },
  carro: { emoji: '🚗', nome: chave('Carro') },
  girafa: { emoji: '🦒', nome: chave('Girafa') },
  onibus: { emoji: '🚌', nome: chave('Ônibus') },
  'tiranossauro-rex': { emoji: '🦖', nome: chave('Tiranossauro rex') },
  'baleia-azul': { emoji: '🐋', nome: chave('Baleia-azul') },
  aviao: { emoji: '✈️', nome: chave('Avião de passageiros') },
  'piscina-olimpica': { emoji: '🏊', nome: chave('Piscina olímpica') },
  'estatua-da-liberdade': { emoji: '🗽', nome: chave('Estátua da Liberdade') },
  'campo-de-futebol': { emoji: '🏟️', nome: chave('Campo de futebol') },
  foguete: { emoji: '🚀', nome: chave('Foguete Saturno V') },
  'roda-gigante': { emoji: '🎡', nome: chave('London Eye') },
  titanic: { emoji: '🚢', nome: chave('Titanic') },
  'torre-eiffel': { emoji: '🗼', nome: chave('Torre Eiffel') },
  'monte-fuji': { emoji: '🗻', nome: chave('Monte Fuji') },
  everest: { emoji: '🏔️', nome: chave('Monte Everest') },
  lua: { emoji: '🌕', nome: chave('Lua') },
  terra: { emoji: '🌍', nome: chave('Terra') },
  jupiter: { emoji: '🪐', nome: chave('Júpiter') },
  sol: { emoji: '☀️', nome: chave('Sol') },
};

export type Medida = 'altura' | 'comprimento' | 'diametro';

/** "{tamanho} de altura" etc. — o tamanho vai pronto, com a unidade (as unidades são as do SI em toda língua). */
export const FRASE_DA_MEDIDA: Record<Medida, string> = {
  altura: chave('{tamanho} de altura'),
  comprimento: chave('{tamanho} de comprimento'),
  diametro: chave('{tamanho} de diâmetro'),
};

/** O tamanho na unidade que faz sentido: 2 µm, 6,7 cm, 5,5 m, 3.474 km. */
export function tamanhoLegivel(cm: number, locale: string): string {
  const fmt = (n: number, casas = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: casas }).format(n);
  if (cm < 0.1) return `${fmt(cm * 10_000, 0)} µm`;
  if (cm < 1) return `${fmt(cm * 10)} mm`;
  if (cm < 100) return `${fmt(cm)} cm`;
  if (cm < 100_000) return `${fmt(cm / 100)} m`;
  return `${fmt(cm / 100_000, 0)} km`;
}

export interface PartidaPublica {
  jogo: 'tamanho';
  criadaPor: number;
  rodada: number;
  rodadas: number;
  fase: 'votando' | 'revelando' | 'fim';
  par: { id: string; cm?: number; medida?: Medida }[];
  restanteMs: number;
  votaram: number[];
  votos: Record<string, 0 | 1> | null;
  certo: 0 | 1 | null;
  placar: { userId: number; username: string; pontos: number }[];
}

/**
 * A partida da sala, se houver. Como o palco: o servidor avisa a comunidade a cada mudança
 * ('minijogo:mudou') e aqui se busca o estado de novo. `recebidaEm` serve para o relógio da tela contar a
 * partir do que o servidor disse, e não do relógio de cada computador.
 */
export function usarMinijogo(channelId: number | null, socket: Socket | null) {
  const [partida, setPartida] = useState<(PartidaPublica & { recebidaEm: number }) | null>(null);

  const recarregar = useCallback(() => {
    if (channelId === null) return setPartida(null);
    void api<{ partida: PartidaPublica | null }>(`/api/channels/${channelId}/minijogo`)
      .then(({ partida: p }) => setPartida(p ? { ...p, recebidaEm: Date.now() } : null))
      .catch(() => {});
  }, [channelId]);

  useEffect(recarregar, [recarregar]);

  useEffect(() => {
    if (!socket || channelId === null) return;
    const aoMudar = (dados: { channelId: number }) => dados.channelId === channelId && recarregar();
    socket.on('minijogo:mudou', aoMudar);
    // Caiu e voltou: a partida pode ter andado enquanto isso.
    socket.on('connect', recarregar);
    return () => {
      socket.off('minijogo:mudou', aoMudar);
      socket.off('connect', recarregar);
    };
  }, [socket, channelId, recarregar]);

  const comecar = useCallback(
    async () => {
      if (channelId === null) return;
      const { partida: p } = await api<{ partida: PartidaPublica }>(`/api/channels/${channelId}/minijogo`, { method: 'POST', body: { jogo: 'tamanho' } });
      setPartida({ ...p, recebidaEm: Date.now() });
    },
    [channelId],
  );

  const votar = useCallback(
    async (escolha: 0 | 1) => {
      if (channelId === null) return;
      const { partida: p } = await api<{ partida: PartidaPublica }>(`/api/channels/${channelId}/minijogo/voto`, { method: 'POST', body: { escolha } });
      setPartida({ ...p, recebidaEm: Date.now() });
    },
    [channelId],
  );

  const encerrar = useCallback(async () => {
    if (channelId === null) return;
    await api(`/api/channels/${channelId}/minijogo`, { method: 'DELETE' });
    setPartida(null);
  }, [channelId]);

  return { partida, comecar, votar, encerrar };
}

/**
 * Pedido de começar que vem da home ("Qual é maior?" → escolher a sala): a pessoa ainda não está na sala, e
 * o jogo só pode começar depois de ela entrar. Fica guardado aqui até a sala de voz conectar.
 */
let comecarAoEntrar: number | null = null;
export const pedirParaComecarAoEntrar = (channelId: number) => {
  comecarAoEntrar = channelId;
};
export function pegarPedidoDeComecar(channelId: number): boolean {
  if (comecarAoEntrar !== channelId) return false;
  comecarAoEntrar = null;
  return true;
}

/**
 * Os sites para jogar FORA do Syden e transmitir (degrau 1 do caminho combinado em 07/10/2026). Só os que
 * a varredura num Chrome de verdade mostrou SEM anúncio (ver CLAUDE.md, "Mini-games"). Abrem no navegador,
 * fora do Syden: o anúncio e o rastreio de um site de fora nunca entram aqui.
 */
export const SITES_PARA_TRANSMITIR: { nome: string; endereco: string; dica: string }[] = [
  { nome: 'Lichess', endereco: 'https://lichess.org', dica: chave('Xadrez, contra a turma ou contra o computador') },
  { nome: 'Clues by Sam', endereco: 'https://cluesbysam.com', dica: chave('Um mistério de lógica por dia') },
  { nome: 'Wikitrivia', endereco: 'https://wikitrivia.tomjwatson.com', dica: chave('Pôr acontecimentos na ordem do tempo') },
  { nome: 'JKLM.fun', endereco: 'https://jklm.fun', dica: chave('Palavras e perguntas rápidas, todo mundo junto') },
  { nome: 'Neal.fun', endereco: 'https://neal.fun', dica: chave('Brincadeiras curiosas para fazer junto') },
];
