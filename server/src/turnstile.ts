/**
 * Turnstile: a verificação de "isto é uma pessoa?" da Cloudflare, usada no cadastro.
 *
 * É o único freio que funciona contra um ENXAME. Os freios por endereço seguram um robô paciente num
 * IP só; contra centenas de máquinas diferentes, cada uma criando duas contas, eles não veem nada de
 * errado. O Turnstile olha o comportamento do navegador, não o endereço.
 *
 * Fica DESLIGADO enquanto não houver chave configurada, e nesse estado o cadastro funciona como sempre.
 * Isso é de propósito: o projeto tem que rodar do zero, num computador qualquer, sem conta na Cloudflare.
 *
 * As duas chaves saem do painel da Cloudflare, em Turnstile → Add widget:
 *   TURNSTILE_SITE_KEY   vai para o site (é pública, aparece no HTML)
 *   TURNSTILE_SECRET_KEY fica só no servidor
 */
import { config } from './config.js';
import * as db from './db.js';

const VERIFICACAO = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const turnstileLigado = () => Boolean(config.turnstile.secretKey);

export type Veredito = 'pessoa' | 'recusado' | 'indisponivel';

/**
 * Confere o comprovante que o navegador mandou.
 *
 * **Se a Cloudflare não responder, NÃO deixa passar.** Foi decisão do dono do Syden, e a troca é esta: a
 * Cloudflare cai muito pouco, então o risco de barrar gente de verdade é pequeno — enquanto deixar passar
 * durante uma queda abriria exatamente a janela que um enxame procura. O preço é que uma indisponibilidade
 * deles trava o cadastro aqui; por isso o caso é separado de "recusado", vira evento no painel de saúde,
 * e quem tenta se cadastrar recebe "tente daqui a pouco" em vez de "você parece um robô".
 */
export async function pessoaDeVerdade(comprovante: string | undefined, endereco: string): Promise<Veredito> {
  if (!turnstileLigado()) return 'pessoa';
  if (!comprovante) return 'recusado';

  try {
    const resposta = await fetch(VERIFICACAO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: config.turnstile.secretKey, response: comprovante, remoteip: endereco }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) {
      db.addHealthEvent('turnstile', `A verificação da Cloudflare respondeu ${resposta.status}; o cadastro está barrado.`);
      return 'indisponivel';
    }
    const resultado = (await resposta.json()) as { success?: boolean };
    return resultado.success === true ? 'pessoa' : 'recusado';
  } catch (erro) {
    db.addHealthEvent('turnstile', `A verificação da Cloudflare não respondeu (${String(erro).slice(0, 80)}); o cadastro está barrado.`);
    return 'indisponivel';
  }
}
