import { BellRing } from 'lucide-react';
import { desktopBridge } from './desktop';
import { useT } from './i18n';
import { getSettings } from './settings';

/**
 * O PEDIDO DE NOTIFICAÇÃO, UMA VEZ SÓ (09/11/2026, sugestão de quem usa: a ligação não chegava a quem estava noutra aba
 * ou jogando). No navegador a notificação pede a permissão dele, e ela só era pedida a quem ia a Configurações →
 * Notificações e ligava a chave — muita gente nunca foi, e a ligação morria calada no fundo.
 *
 * O momento é o primeiro em que faz sentido: a pessoa liga, atende, recusa ou perde uma ligação. Um cartão no canto,
 * que não bloqueia nada, explica para que serve, e só o "Permitir" chama a pergunta do navegador (que precisa de um
 * clique para aparecer em vários deles). Respondida ou não, a pergunta NÃO VOLTA ("pergunte uma vez"): a marca fica no
 * aparelho, porque a permissão também é do aparelho. Quem mudar de ideia tem a chave em Configurações.
 *
 * No app de desktop a permissão já vem dada (desktop/src/main.js, setPermissionCheckHandler): o cartão nunca aparece.
 */
const MARCA = 'syden.avisoDeLigacaoPerguntado';

/** Se é hora de oferecer, e já marca que ofereceu: chamado de novo, responde não. */
export function oferecerAvisoDeLigacao(): boolean {
  if (desktopBridge || typeof Notification === 'undefined' || Notification.permission !== 'default') return false;
  // Quem desligou as notificações nas Configurações já disse que não as quer.
  if (!getSettings().notifications) return false;
  try {
    if (localStorage.getItem(MARCA)) return false;
    localStorage.setItem(MARCA, '1');
  } catch {
    // Sem onde guardar a marca, perguntar arriscaria perguntar a cada ligação: melhor não perguntar.
    return false;
  }
  return true;
}

export function PedidoDeAvisoDeLigacao({ aoFechar }: { aoFechar: () => void }) {
  const t = useT();
  return (
    <div className="convite-voz pedido-de-aviso" role="dialog" aria-label={t('Avisar das ligações com o Syden em segundo plano?')}>
      <BellRing size={28} aria-hidden="true" className="pedido-de-aviso-icone" />
      <div className="convite-voz-texto">
        <strong>{t('Avisar das ligações com o Syden em segundo plano?')}</strong>
        <span>{t('O navegador vai pedir permissão. Assim você fica sabendo de ligações e mensagens mesmo em outra aba ou programa.')}</span>
        <div className="convite-voz-botoes">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              aoFechar();
              void Notification.requestPermission().catch(() => {});
            }}
          >
            {t('Permitir notificações')}
          </button>
          <button type="button" className="btn-secondary" onClick={aoFechar}>
            {t('Agora não')}
          </button>
        </div>
      </div>
    </div>
  );
}
