import { useSyncExternalStore } from 'react';
import { chave } from './i18n';

/**
 * O TOQUE DE CADA PESSOA E OS GRUPOS (09/11/2026, pedido dele: "silenciar ou deixar tocar por pessoa, assim como colocar
 * pessoas em grupos e associar determinado som para aquele grupo, como grupo de CS, grupo da faculdade").
 *
 * Quando alguém liga numa conversa privada, o toque que soa é, nesta ordem: o escolhido para a PESSOA (botão direito nela →
 * "Toque de ligação"), o do GRUPO em que ela está (botão direito → "Grupo"; os grupos se criam em Configurações →
 * Notificações), ou o padrão. "Silenciar" é um toque também: a ligação chega com o cartão e a barra de tarefas piscando,
 * sem som. As chaves de sempre continuam valendo por cima (a do "Toque de ligação", o "Desativar áudio", o "Não perturbe").
 *
 * Os toques são frases curtas sintetizadas pelo Syden (sounds.ts), como o toque de sempre: não é música, e não há arquivo.
 *
 * Mora em 'syden.toques' e SOBE com as preferências (preferencias.ts), como as anotações: é sobre OUTRAS pessoas (em que
 * grupo cada uma está), e a política de privacidade diz isso. Uma pessoa está em no máximo UM grupo: o grupo decide um
 * som, e duas respostas para a mesma ligação não têm como soar juntas.
 */

export const TOQUES = ['padrao', 'sininho', 'arpejo', 'suave', 'bipe', 'silencio'] as const;
export type Toque = (typeof TOQUES)[number];

/** O nome de cada toque na tela (texto marcado para tradução em quem mostra: t(NOME_DO_TOQUE[x])). */
export const NOME_DO_TOQUE: Record<Toque, string> = {
  padrao: chave('Padrão'),
  sininho: chave('Sininho'),
  arpejo: chave('Arpejo'),
  suave: chave('Suave'),
  bipe: chave('Bipe'),
  silencio: chave('Silenciar'),
};

export interface GrupoDeToque {
  id: string;
  nome: string;
  toque: Toque;
}

interface Guardado {
  grupos: GrupoDeToque[];
  /** por pessoa (id em texto): o grupo e/ou o toque escolhido só para ela */
  pessoas: Record<string, { grupo?: string; toque?: Toque }>;
}

const CHAVE = 'syden.toques';
export const MAXIMO_DE_GRUPOS = 20;
export const LIMITE_DO_NOME_DO_GRUPO = 32;

const eToque = (x: unknown): x is Toque => typeof x === 'string' && (TOQUES as readonly string[]).includes(x);

function ler(): Guardado {
  try {
    const cru = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Guardado>;
    const grupos = Array.isArray(cru.grupos)
      ? cru.grupos.filter((g): g is GrupoDeToque => !!g && typeof g.id === 'string' && typeof g.nome === 'string' && eToque(g.toque))
      : [];
    const pessoas: Guardado['pessoas'] = {};
    if (cru.pessoas && typeof cru.pessoas === 'object') {
      for (const [id, p] of Object.entries(cru.pessoas)) {
        if (!p || typeof p !== 'object') continue;
        const grupo = typeof p.grupo === 'string' && grupos.some((g) => g.id === p.grupo) ? p.grupo : undefined;
        const toque = eToque(p.toque) ? p.toque : undefined;
        if (grupo || toque) pessoas[id] = { ...(grupo && { grupo }), ...(toque && { toque }) };
      }
    }
    return { grupos, pessoas };
  } catch {
    return { grupos: [], pessoas: {} };
  }
}

let atual = ler();
const ouvintes = new Set<() => void>();

function gravar(proximo: Guardado) {
  atual = proximo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(atual));
  } catch {
    // Sem armazenamento: vale até fechar o app.
  }
  void import('./preferencias').then((m) => m.guardarEmBreve());
  for (const o of ouvintes) o();
}

/** Relê do armazenamento (as preferências que chegam do servidor escrevem direto nele). */
export function relerToques() {
  atual = ler();
  for (const o of ouvintes) o();
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function useToques(): Guardado {
  return useSyncExternalStore(assinar, () => atual);
}

/** O toque que soa quando esta pessoa liga: o dela, o do grupo dela, ou o padrão. */
export function toqueDe(userId: number, guardado: Guardado = atual): Toque {
  const p = guardado.pessoas[String(userId)];
  if (p?.toque) return p.toque;
  const grupo = p?.grupo && guardado.grupos.find((g) => g.id === p.grupo);
  return grupo ? grupo.toque : 'padrao';
}

function mudarPessoa(userId: number, mudanca: { grupo?: string | null; toque?: Toque | null }) {
  const chave = String(userId);
  const antes = atual.pessoas[chave] ?? {};
  const depois: { grupo?: string; toque?: Toque } = { ...antes };
  if (mudanca.grupo !== undefined) {
    if (mudanca.grupo) depois.grupo = mudanca.grupo;
    else delete depois.grupo;
  }
  if (mudanca.toque !== undefined) {
    if (mudanca.toque) depois.toque = mudanca.toque;
    else delete depois.toque;
  }
  const pessoas = { ...atual.pessoas };
  if (depois.grupo || depois.toque) pessoas[chave] = depois;
  else delete pessoas[chave];
  gravar({ ...atual, pessoas });
}

/** O toque só desta pessoa (null volta a seguir o grupo ou o padrão). */
export function escolherToqueDaPessoa(userId: number, toque: Toque | null) {
  mudarPessoa(userId, { toque });
}

/** Põe a pessoa num grupo (null tira de todos). */
export function porNoGrupo(userId: number, grupo: string | null) {
  mudarPessoa(userId, { grupo });
}

export function criarGrupo(nome: string, toque: Toque = 'sininho'): GrupoDeToque | null {
  const limpo = nome.trim().slice(0, LIMITE_DO_NOME_DO_GRUPO);
  if (!limpo || atual.grupos.length >= MAXIMO_DE_GRUPOS) return null;
  const grupo = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome: limpo, toque };
  gravar({ ...atual, grupos: [...atual.grupos, grupo] });
  return grupo;
}

export function mudarGrupo(id: string, mudanca: { nome?: string; toque?: Toque }) {
  const nome = mudanca.nome?.trim().slice(0, LIMITE_DO_NOME_DO_GRUPO);
  gravar({
    ...atual,
    grupos: atual.grupos.map((g) => (g.id === id ? { ...g, ...(nome && { nome }), ...(mudanca.toque && { toque: mudanca.toque }) } : g)),
  });
}

/** Apaga o grupo; quem estava nele volta ao padrão (ou ao toque só dele). */
export function apagarGrupo(id: string) {
  const pessoas: Guardado['pessoas'] = {};
  for (const [k, p] of Object.entries(atual.pessoas)) {
    const resto = p.grupo === id ? { ...(p.toque && { toque: p.toque }) } : p;
    if (resto.grupo || resto.toque) pessoas[k] = resto;
  }
  gravar({ grupos: atual.grupos.filter((g) => g.id !== id), pessoas });
}

/** Quantas pessoas estão em cada grupo. */
export function pessoasNoGrupo(id: string, guardado: Guardado = atual): number {
  return Object.values(guardado.pessoas).filter((p) => p.grupo === id).length;
}
