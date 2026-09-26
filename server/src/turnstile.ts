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

const VERIFICACAO = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const turnstileLigado = () => Boolean(config.turnstile.secretKey);

/**
 * Confere o comprovante que o navegador mandou. Devolve true quando pode seguir.
 *
 * Se a Cloudflare não responder, DEIXA PASSAR — de propósito. A alternativa seria uma indisponibilidade
 * deles virar "ninguém consegue criar conta no Syden", e um cadastro a mais de robô é um problema menor
 * do que um cadastro a menos de gente. Quem prefere o contrário muda o `return true` do catch.
 */
export async function pessoaDeVerdade(comprovante: string | undefined, endereco: string): Promise<boolean> {
  if (!turnstileLigado()) return true;
  if (!comprovante) return false;

  try {
    const resposta = await fetch(VERIFICACAO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: config.turnstile.secretKey, response: comprovante, remoteip: endereco }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) return true;
    const resultado = (await resposta.json()) as { success?: boolean };
    return resultado.success === true;
  } catch {
    return true;
  }
}
