/**
 * A PROTEÇÃO DE CRIANÇAS E ADOLESCENTES do lado da tela (17/10/2026, ECA Digital). As regras e a decisão moram no
 * servidor (server/src/protecao.ts); aqui estão os tipos e o aviso de que a conta foi barrada no meio do uso (o limite
 * do dia acabou, quem cuida do Syden baniu), que a App escuta para trocar o Syden pela tela da barreira.
 */
import { useSyncExternalStore } from 'react';

export type Faixa = 'crianca' | '13-15' | '16-17' | 'adulto';

export type Barreira =
  | { tipo: 'banido'; motivo: string; em: string; recursoEm: string | null }
  | { tipo: 'suspensa'; motivo: string; em: string; recursoEm: string | null }
  | { tipo: 'nascimento' }
  | { tipo: 'responsavel'; prazoAte: string }
  | { tipo: 'tempo'; limiteMinutos: number };

export interface Regras {
  dmSoAmigos: boolean;
  transmitirSoAmigos: boolean;
  assistirSoAmigos: boolean;
  limiteMinutos: number | null;
}

/** O que GET /api/me/protecao devolve. */
export interface MinhaProtecao {
  faixa: Faixa | null;
  barreira: Barreira | null;
  regras: Regras | null;
  podeMudarRegras: boolean;
  responsavel: { username: string } | null;
  responsavelObrigatorio: boolean;
  /** De 13 a 15 anos, sem responsável: até quando o Syden abre sem ele. */
  prazoResponsavel: string | null;
  codigo: { codigo: string; ate: string } | null;
  usoHoje: number | null;
  amigos: number[];
  responsavelPor: number;
}

/** O que o responsável vê de cada menor (GET /api/responsavel/menores). */
export interface PainelDoMenor {
  menorId: number;
  username: string;
  faixa: Faixa;
  regras: Regras;
  usoHoje: number;
  usoSemana: { dia: string; segundos: number }[];
  adultos: { id: number; username: string; amigo: boolean; conversa: boolean; idadeConhecida: boolean }[];
}

export const ehMenor = (faixa: Faixa | null | undefined) => faixa === '13-15' || faixa === '16-17';

// ---------- o aviso de barreira, para a App inteira ----------

let atual: Barreira | null = null;
const ouvintes = new Set<() => void>();

/** Chamado por quem descobre a barreira no meio do uso: o socket ('barreira') ou um pedido recusado com ela. */
export function avisarBarreira(barreira: Barreira | null) {
  atual = barreira;
  for (const f of ouvintes) f();
}

export function useBarreira(): Barreira | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
  );
}

/** Minutos de uso, para a tela ("1 h 20 min"). */
export function tempoDeUso(segundos: number, t: (texto: string, valores?: Record<string, string | number>) => string): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return t('{n} min', { n: min });
  return t('{h} h {m} min', { h: Math.floor(min / 60), m: min % 60 });
}
