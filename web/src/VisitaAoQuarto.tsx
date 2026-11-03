import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_URL, loadToken } from './api';
import { useT } from './i18n';
import { Mascote } from './Mascote';
import { ENDERECO_DO_QUARTO } from './QuartoNovo';
import { Trofeus } from './Trofeus';

/**
 * A VISITA AO QUARTO DE OUTRA PESSOA, no app (03/11/2026, decisão dele: "como uma pessoa visita o perfil de outro na
 * Steam"). Abre pelo cartão de perfil, só quando o servidor diz que dá (trofeus-routes.ts: o modo do quarto e os
 * convites). É a mesma página do quarto, em modo app, com a conta de quem visita e o id de quem mora ali: nada se arrasta
 * nem se guarda, e a única função que vale é a estante de troféus, que mostra o destaque de quem mora no quarto.
 */
export function VisitaAoQuarto({ dono, aoFechar }: { dono: { id: number; nome: string }; aoFechar: () => void }) {
  const t = useT();
  const ref = useRef<HTMLIFrameElement>(null);
  const [pronto, setPronto] = useState(false);
  const [arrumado, setArrumado] = useState(false);
  const [trofeus, setTrofeus] = useState(false);
  const [erro, setErro] = useState(false);

  const enviar = (msg: Record<string, unknown>) => ref.current?.contentWindow?.postMessage({ syden: 'quarto', ...msg }, location.origin);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== ref.current?.contentWindow || e.data?.syden !== 'quarto') return;
      if (e.data.pronto) setPronto(true);
      if (e.data.arrumado) setArrumado(true);
      if (e.data.visitaFalhou) setErro(true);
      if (e.data.acao === 'trofeu') setTrofeus(true);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  useEffect(() => {
    const token = loadToken();
    if (!pronto || !token) return;
    enviar({ funcoes: { trofeu: { rotulo: t('Troféus'), sub: t('Em destaque') } } });
    enviar({ conta: { api: API_URL, token, nome: '', id: 0, visitar: dono.id } });
  }, [pronto]);

  // A página do quarto não respondeu (ela não carregou, ou foi barrada): diz, em vez de esperar para sempre.
  useEffect(() => {
    if (arrumado) return;
    const prazo = setTimeout(() => setErro(true), 25_000);
    return () => clearTimeout(prazo);
  }, [arrumado]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !trofeus && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar, trofeus]);

  return createPortal(
    <div className="dialog-backdrop visita-quarto-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog visita-quarto" role="dialog" aria-modal="true" aria-labelledby="visita-titulo">
        <div className="conquistas-topo">
          <h2 id="visita-titulo">{t('O quarto de {nome}', { nome: dono.nome })}</h2>
          <button type="button" className="icon-plain" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
            <X size={18} />
          </button>
        </div>
        {erro ? (
          <p className="form-error">{t('Este quarto não está aberto para visita.')}</p>
        ) : (
          <div className="quarto-novo-caixa">
            {!arrumado && (
              <div className="visita-quarto-espera" aria-hidden="true">
                <Mascote nome="ocioso" tamanho={180} />
              </div>
            )}
            <div className="quarto-novo" style={arrumado ? undefined : { visibility: 'hidden' }}>
              <iframe ref={ref} src={ENDERECO_DO_QUARTO + '?app'} title={t('O quarto de {nome}', { nome: dono.nome })} />
            </div>
          </div>
        )}
        {trofeus && <Trofeus dono={dono} aoFechar={() => setTrofeus(false)} />}
      </div>
    </div>,
    document.body,
  );
}

/** Abrir uma visita de qualquer lugar (o cartão de perfil fecha ao clicar, e a visita não pode morar nele). */
export const visitarQuarto = (dono: { id: number; nome: string }) =>
  window.dispatchEvent(new CustomEvent('syden:visitar-quarto', { detail: dono }));

/** Quem mostra a visita: um só, no Shell. */
export function VisitasAoQuarto() {
  const [dono, setDono] = useState<{ id: number; nome: string } | null>(null);
  useEffect(() => {
    const abrir = (e: Event) => setDono((e as CustomEvent<{ id: number; nome: string }>).detail);
    window.addEventListener('syden:visitar-quarto', abrir);
    return () => window.removeEventListener('syden:visitar-quarto', abrir);
  }, []);
  return dono ? <VisitaAoQuarto key={dono.id} dono={dono} aoFechar={() => setDono(null)} /> : null;
}
