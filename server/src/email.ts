/**
 * O envio de e-mail do Syden.
 *
 * Tem três modos, e o primeiro é o de hoje:
 *
 * 1. **Rascunho** (sem RESEND_API_KEY): nada sai daqui. A mensagem inteira, com o link, vai para o
 *    registro do servidor. Serve para desenvolver e testar o fluxo antes de existir domínio e conta.
 * 2. **Resend com o domínio de teste deles** (`onboarding@resend.dev`): manda de verdade, mas só para o
 *    endereço dono da conta Resend. É o modo para conferir que o e-mail chega bonito na caixa, hoje,
 *    sem comprar domínio.
 * 3. **Resend com domínio próprio**: troca-se EMAIL_FROM e pronto. Nada mais muda.
 *
 * O provedor está atrás de uma função só (`enviarEmail`). Trocar Resend por SES ou Postmark depois é
 * mexer aqui dentro, e em nenhum outro arquivo.
 */
import { config } from './config.js';

export interface Mensagem {
  para: string;
  assunto: string;
  /** A versão em texto puro. É o que aparece no registro no modo rascunho, e no e-mail para quem lê sem HTML. */
  texto: string;
  html: string;
}

export type ResultadoDoEnvio = { enviado: boolean; rascunho: boolean; erro?: string };

/** Escreve no registro do servidor. É trocado por um logger de verdade em app.ts. */
let anotar: (linha: string) => void = (linha) => console.log(linha);
export function ondeAnotar(fn: (linha: string) => void) {
  anotar = fn;
}

export const envioConfigurado = () => Boolean(config.email.resendKey);

export async function enviarEmail(mensagem: Mensagem): Promise<ResultadoDoEnvio> {
  if (!envioConfigurado()) {
    // Modo rascunho: o link vai para o registro, para dar para seguir o fluxo sem provedor nenhum.
    anotar(
      `[e-mail em rascunho — nada foi enviado]\n  para: ${mensagem.para}\n  assunto: ${mensagem.assunto}\n${mensagem.texto
        .split('\n')
        .map((l) => '  ' + l)
        .join('\n')}`,
    );
    return { enviado: false, rascunho: true };
  }

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.email.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: config.email.remetente,
        to: [mensagem.para],
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      anotar(`Falha ao enviar e-mail (${resposta.status}): ${detalhe.slice(0, 300)}`);
      return { enviado: false, rascunho: false, erro: `o serviço de e-mail respondeu ${resposta.status}` };
    }
    return { enviado: true, rascunho: false };
  } catch (e) {
    // Rede fora, tempo esgotado: quem chamou decide o que dizer para a pessoa.
    anotar(`Falha ao enviar e-mail: ${String(e).slice(0, 200)}`);
    return { enviado: false, rascunho: false, erro: 'não foi possível falar com o serviço de e-mail' };
  }
}

// ---------------------------------------------------------------------------------------------------
// As mensagens
// ---------------------------------------------------------------------------------------------------

/** O corpo em HTML: simples de propósito, porque cliente de e-mail estraga o que for sofisticado. */
function moldura(titulo: string, corpo: string, botao: { texto: string; link: string }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f5f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px;padding:32px">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Syden</p>
          <h1 style="margin:0 0 16px;font-size:21px;color:#111827">${titulo}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">${corpo}</p>
          <a href="${botao.link}" style="display:inline-block;background:#5865f2;color:#fff;text-decoration:none;padding:12px 26px;border-radius:9px;font-weight:600;font-size:15px">${botao.texto}</a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6b7280">
            Se o botão não funcionar, copie este endereço no navegador:<br>
            <span style="color:#4b5563;word-break:break-all">${botao.link}</span>
          </p>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">Se não foi você quem pediu, é só ignorar este e-mail.</p>
    </td></tr>
  </table>
</body></html>`;
}

export function mensagemDeVerificacao(nome: string, link: string): Omit<Mensagem, 'para'> {
  return {
    assunto: 'Confirme o seu e-mail no Syden',
    texto: `Olá, ${nome}.\n\nConfirme o seu e-mail para conseguir recuperar a senha depois:\n${link}\n\nO link vale por 24 horas.\nSe não foi você quem pediu, é só ignorar.`,
    html: moldura(
      `Olá, ${nome}`,
      'Confirme este endereço para conseguir recuperar a sua senha caso um dia precise. O link vale por 24 horas.',
      { texto: 'Confirmar meu e-mail', link },
    ),
  };
}

export function mensagemDeRecuperacao(nome: string, link: string): Omit<Mensagem, 'para'> {
  return {
    assunto: 'Recuperar a sua senha do Syden',
    texto: `Olá, ${nome}.\n\nPara escolher uma senha nova, abra este endereço:\n${link}\n\nO link vale por 1 hora e só funciona uma vez.\nSe não foi você quem pediu, ignore: a sua senha continua a mesma.`,
    html: moldura(
      `Olá, ${nome}`,
      'Você pediu para trocar a sua senha. O link abaixo vale por 1 hora e só funciona uma vez.',
      { texto: 'Escolher uma senha nova', link },
    ),
  };
}
