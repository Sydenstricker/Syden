import { useEffect, useRef, useState } from 'react';
import { API_URL, loadToken } from './api';
import { useT } from './i18n';
import type { AcoesDoQuarto } from './Quarto';

/**
 * O QUARTO NOVO, o de móveis soltos que cada pessoa arruma (e2e/pixel-art/quarto/novo/quarto/), dentro do app. Por
 * enquanto SÓ NO DESENVOLVIMENTO: a página é servida pelo Vite (vite.config.ts, "quarto-novo") e não entra no build, e
 * a home publicada continua sendo o Quarto.tsx até ele lançar este (decisão dele, 15/10/2026).
 *
 * O quarto é a própria página do teste, num iframe do mesmo site, em "modo app" (?app): só o quarto. A conversa é por
 * mensagem, e só com a mesma origem:
 * - daqui para lá: as funções (o nome de cada uma já traduzido, as mesmas ações do Quarto.tsx), se é noite, e a conta
 *   (para a arrumação ir ao servidor, /api/quarto);
 * - de lá para cá: que o quarto está pronto, e o clique numa função (o fone, o quadro, o guarda-roupa…).
 */
/** A página do quarto, servida pelo Vite no desenvolvimento (vite.config.ts). */
const ENDERECO = import.meta.env.BASE_URL + 'quarto-novo/?app';

export function QuartoNovo({ noite, acoes }: { noite: boolean; acoes: AcoesDoQuarto }) {
  const t = useT();
  const ref = useRef<HTMLIFrameElement>(null);
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;
  const [pronto, setPronto] = useState(false);

  const enviar = (msg: Record<string, unknown>) => ref.current?.contentWindow?.postMessage({ syden: 'quarto', ...msg }, location.origin);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== ref.current?.contentWindow || e.data?.syden !== 'quarto') return;
      if (e.data.pronto) setPronto(true);
      if (typeof e.data.acao === 'string') acoesRef.current[e.data.acao]?.onClick();
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  // Só o que se mostra de cada função (o clique volta para cá, onde mora a ação).
  const funcoes = JSON.stringify(Object.fromEntries(Object.entries(acoes).map(([id, a]) => [id, { rotulo: a?.rotulo, sub: a?.sub }])));
  useEffect(() => {
    if (pronto) enviar({ funcoes: JSON.parse(funcoes), noite });
  }, [pronto, funcoes, noite]);
  useEffect(() => {
    const token = loadToken();
    if (pronto && token) enviar({ conta: { api: API_URL, token, nome: '', id: 0 } });
  }, [pronto]);

  return (
    <div className="quarto-novo">
      <iframe ref={ref} src={ENDERECO} title={t('Início')} />
    </div>
  );
}
