/**
 * As preferências de cada pessoa, guardadas no servidor.
 *
 * POR QUE SAIU DO NAVEGADOR. Tudo — tema, idioma, volumes, anotações — vivia só no `localStorage`.
 * Trocar de navegador, formatar a máquina ou sair do web para o aplicativo zerava tudo, e a pessoa
 * não tinha como saber que ia perder. Preferência que só existe num aparelho não é preferência da
 * pessoa: é preferência do aparelho.
 *
 * O QUE **NÃO** SOBE, e a regra é simples: o que identifica um APARELHO fica no aparelho. Os ids de
 * microfone, alto-falante e câmera não existem na outra máquina, e subi-los faria o Syden tentar usar
 * um dispositivo que não está lá — trocando um problema pequeno (reconfigurar uma vez) por um grande
 * (entrar na chamada muda, sem entender por quê). Quem decide o que sobe é o site, na lista de
 * chaves permitidas; aqui o servidor só guarda o que recebe.
 *
 * ISTO CONTÉM DADO PESSOAL DE TERCEIRO. As anotações que alguém escreve sobre outras pessoas sobem
 * junto, por decisão de quem mantém o Syden: elas se perdiam na troca de navegador, e servem para
 * apurar uma denúncia. Mas é preciso dizer o que isso significa — uma anotação sobre o Fulano deixa
 * de morar no computador de quem escreveu e passa a ficar guardada no servidor, e o Fulano não sabe.
 * A política de privacidade foi corrigida junto com esta mudança, e continuar verdadeira é a
 * condição para isto existir.
 */
import * as db from './db.js';

/**
 * Teto do pacote inteiro. As anotações são texto livre e crescem sem limite natural; sem um teto,
 * uma conta sozinha encheria o banco. 64 KB dão milhares de linhas de anotação e ainda são pequenos
 * o bastante para viajar em cada login sem pesar.
 */
export const LIMITE_BYTES = 64 * 1024;

export interface Guardadas {
  preferencias: Record<string, unknown>;
  /** Quando foram guardadas pela última vez. Nulo quando esta conta nunca guardou nada. */
  em: string | null;
}

/**
 * Valida o que chegou antes de guardar.
 *
 * Devolve o motivo em texto quando recusa, porque uma preferência que some sem explicação é o tipo de
 * defeito que ninguém relata — a pessoa só acha que "o Syden esqueceu".
 */
export function conferir(corpo: unknown): { ok: true; texto: string } | { ok: false; erro: string } {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return { ok: false, erro: 'As preferências precisam vir como um objeto.' };
  }
  const texto = JSON.stringify(corpo);
  const bytes = Buffer.byteLength(texto, 'utf8');
  if (bytes > LIMITE_BYTES) {
    return { ok: false, erro: `As preferências passaram de ${Math.round(LIMITE_BYTES / 1024)} KB.` };
  }
  return { ok: true, texto };
}

export function ler(userId: number): Guardadas {
  const linha = db.lerPreferencias(userId);
  if (!linha) return { preferencias: {}, em: null };
  try {
    const lido = JSON.parse(linha.data) as unknown;
    // Um JSON estragado no banco não pode derrubar o login de ninguém: vale o vazio, e a próxima
    // gravação conserta sozinha.
    if (lido === null || typeof lido !== 'object' || Array.isArray(lido)) return { preferencias: {}, em: linha.em };
    return { preferencias: lido as Record<string, unknown>, em: linha.em };
  } catch {
    return { preferencias: {}, em: linha.em };
  }
}

export function guardar(userId: number, texto: string): Guardadas {
  db.guardarPreferencias(userId, texto);
  return ler(userId);
}
