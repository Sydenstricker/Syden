import { AppWindow, Pencil, RotateCw, Undo2 } from 'lucide-react';
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
 * - daqui para lá: as funções (o nome de cada uma já traduzido, as mesmas ações do Quarto.tsx), se é noite, o estado de
 *   quem mora aqui (em call, ausente), a conta (para a arrumação ir ao servidor, /api/quarto) e os comandos da barra de
 *   arrumar;
 * - de lá para cá: que o quarto está pronto (com as figuras da barra), o que está escolhido na arrumação, e o clique numa
 *   função (o fone, o quadro, o guarda-roupa…).
 *
 * A BARRA DE ARRUMAR mostra figuras e não nomes (o recorte de cada objeto da parede, a cor de cada tapete): é o que
 * fica igual nos 80 idiomas sem um texto novo por objeto.
 */
/** A página do quarto, servida pelo Vite no desenvolvimento (vite.config.ts). */
const ENDERECO = import.meta.env.BASE_URL + 'quarto-novo/?app';

/** O que o coelho faz no quarto é o estado de VERDADE de quem mora nele (a tela não mente): em call, vai ao computador;
 *  ausente, dorme; senão, fica à toa. */
export type EstadoNoQuarto = 'atoa' | 'call' | 'ausente';

interface Figuras {
  miniaturas: Record<string, string>;
  cores: Record<string, string>;
  ordem: string[];
}
interface Arrumacao {
  janela: string;
  tapete: string;
  parede: Record<string, boolean>;
}

export function QuartoNovo({ noite, acoes, estado }: { noite: boolean; acoes: AcoesDoQuarto; estado: EstadoNoQuarto }) {
  const t = useT();
  const ref = useRef<HTMLIFrameElement>(null);
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;
  const [pronto, setPronto] = useState(false);
  const [figuras, setFiguras] = useState<Figuras | null>(null);
  const [arrumacao, setArrumacao] = useState<Arrumacao | null>(null);
  const [arrumando, setArrumando] = useState(false);

  const enviar = (msg: Record<string, unknown>) => ref.current?.contentWindow?.postMessage({ syden: 'quarto', ...msg }, location.origin);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== ref.current?.contentWindow || e.data?.syden !== 'quarto') return;
      if (e.data.pronto) {
        setPronto(true);
        if (e.data.figuras) setFiguras(e.data.figuras);
      }
      if (e.data.arrumacao) setArrumacao(e.data.arrumacao);
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
    if (pronto) enviar({ estado });
  }, [pronto, estado]);
  useEffect(() => {
    const token = loadToken();
    if (pronto && token) enviar({ conta: { api: API_URL, token, nome: '', id: 0 } });
  }, [pronto]);

  return (
    <div className="quarto-novo-caixa">
      <div className="quarto-novo">
        <iframe ref={ref} src={ENDERECO} title={t('Início')} />
      </div>
      {pronto && (
        <div className="quarto-novo-barra">
          <button type="button" aria-pressed={arrumando} onClick={() => setArrumando((a) => !a)}>
            <Pencil size={16} aria-hidden="true" /> {arrumando ? t('Pronto') : t('Editar')}
          </button>
          {arrumando && (
            <>
              <button type="button" onClick={() => enviar({ comando: 'girar' })}>
                <RotateCw size={16} aria-hidden="true" /> {t('Girar')}
              </button>
              <button type="button" onClick={() => enviar({ comando: 'janela' })}>
                <AppWindow size={16} aria-hidden="true" /> {t('Janela')}
              </button>
              {figuras && (
                <div className="quarto-novo-grupo" role="group" aria-label={t('Tapete')}>
                  {Object.entries(figuras.cores).map(([id, cor], i) => (
                    <button
                      key={id}
                      type="button"
                      className="quarto-novo-cor"
                      style={{ background: cor }}
                      aria-label={`${t('Tapete')} ${i + 1}`}
                      aria-pressed={arrumacao?.tapete === id}
                      onClick={() => enviar({ comando: 'tapete', cor: id })}
                    />
                  ))}
                </div>
              )}
              {figuras && (
                <div className="quarto-novo-grupo" role="group" aria-label={t('Objetos da parede')}>
                  {figuras.ordem.map((id, i) => (
                    <button
                      key={id}
                      type="button"
                      className="quarto-novo-objeto"
                      aria-label={`${t('Objetos da parede')} ${i + 1}`}
                      aria-pressed={!!arrumacao?.parede[id]}
                      onClick={() => enviar({ comando: 'parede', id })}
                    >
                      <img src={figuras.miniaturas[id]} alt="" />
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => enviar({ comando: 'inicial' })}>
                <Undo2 size={16} aria-hidden="true" /> {t('Voltar ao padrão')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
