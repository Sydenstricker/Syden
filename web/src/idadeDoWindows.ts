import { api } from './api';
import type { Barreira } from './protecao';
import { desktopBridge } from './desktop';

/**
 * A IDADE PELO WINDOWS (20/10/2026; ver "Adolescentes no Syden" no CLAUDE.md). No app, ao abrir, o Syden pergunta ao
 * Windows a faixa de idade da conta (desktop/native/src/idade.cpp) e, SÓ SE A MICROSOFT A VERIFICOU, manda a faixa ao
 * servidor, onde ela vale acima da data informada. A data nunca existe aqui: o Windows não a entrega.
 *
 * Uma vez por conta a cada abertura, que é o bastante para acompanhar quem faz aniversário. No navegador não há ponte, e
 * nada acontece; num Windows sem a função, nem permissão em Informações da conta, ou sem conta Microsoft, também não.
 */
const jaPerguntado = new Set<number>();

export async function enviarIdadeDoWindows(userId: number): Promise<{ faixa: string; barreira: Barreira | null } | null> {
  if (!desktopBridge?.faixaDeIdade || jaPerguntado.has(userId)) return null;
  jaPerguntado.add(userId);
  try {
    const r = await desktopBridge.faixaDeIdade();
    if (r.motivo !== 'ok' || r.verificacao !== 'verificada' || !r.faixa) return null;
    const resposta = await api<{ guardada: boolean; faixa?: string; barreira: Barreira | null }>('/api/me/idade-do-windows', {
      method: 'POST',
      body: { menor: r.faixa.menor, maior: r.faixa.maior, verificacao: r.verificacao },
    });
    return resposta.guardada && resposta.faixa ? { faixa: resposta.faixa, barreira: resposta.barreira } : null;
  } catch {
    return null; // servidor antigo (404) ou sem rede: fica para a próxima abertura
  }
}
