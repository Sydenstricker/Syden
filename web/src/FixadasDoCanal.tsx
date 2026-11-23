import { Pin, PinOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { nomeDe } from './directory';
import { useT } from './i18n';
import { formatTime, MessageText, resumoDaMensagem } from './MessageItem';
import type { Message } from './types';

/**
 * AS MENSAGENS FIXADAS (23/11/2026, a permissão "fixar mensagens" do Discord que faltava): o botão do alfinete no cabeçalho
 * abre a lista do canal, da mais recente para a mais antiga. Quem fixa é quem administra a comunidade; na conversa privada,
 * quem está nela (ver server/src/fixadas-routes.ts).
 *
 * "Ir até a mensagem" só rola até ela se ela estiver carregada na conversa (como a citação da resposta); a lista mostra o
 * texto inteiro, então não é preciso ir até lá para ler.
 */
export function FixadasDoCanal({ channelId, socket, podeFixar }: { channelId: number; socket: Socket; podeFixar: boolean }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Message[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const ler = () => api<Message[]>(`/api/channels/${channelId}/fixadas`).then(setLista, (e) => setErro((e as Error).message));
    void ler();
    const aoMudar = (d: { channelId: number }) => d.channelId === channelId && void ler();
    socket.on('mensagem:fixada', aoMudar);
    const fora = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('pointerdown', fora);
    window.addEventListener('keydown', esc);
    return () => {
      socket.off('mensagem:fixada', aoMudar);
      window.removeEventListener('pointerdown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [aberto, channelId, socket]);

  function irAte(id: number) {
    const el = document.querySelector<HTMLElement>(`[data-mensagem="${id}"]`);
    if (!el) return;
    setAberto(false);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('destacada');
    void el.offsetWidth;
    el.classList.add('destacada');
    window.setTimeout(() => el.classList.remove('destacada'), 1600);
  }

  async function desafixar(id: number) {
    setErro(null);
    try {
      await api(`/api/messages/${id}/fixar`, { method: 'POST', body: { fixar: false } });
      setLista((l) => l?.filter((m) => m.id !== id) ?? l);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="fixadas-ancora" ref={ref}>
      <button className={`header-toggle fixadas-botao${aberto ? ' active' : ''}`} title={t('Mensagens fixadas')} aria-label={t('Mensagens fixadas')} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <Pin size={20} />
      </button>
      {aberto && (
        <div className="fixadas-painel" role="dialog" aria-label={t('Mensagens fixadas')}>
          <h3>{t('Mensagens fixadas')}</h3>
          {erro && <p className="form-error small">{erro}</p>}
          {lista && lista.length === 0 && <p className="fixadas-vazio">{t('Nenhuma mensagem fixada.')}</p>}
          <ul>
            {lista?.map((m) => (
              <li key={m.id} className="fixada">
                <div className="fixada-meta">
                  <strong>{m.author.app ? 'Syden' : nomeDe(m.author)}</strong>
                  <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
                </div>
                {m.content ? <MessageText content={m.content} /> : <p className="fixada-resumo">{resumoDaMensagem({ content: '', anexos: m.attachments.length, enquete: m.poll?.question ?? null }, t)}</p>}
                <div className="fixada-acoes">
                  {document.querySelector(`[data-mensagem="${m.id}"]`) && (
                    <button type="button" className="link-button" onClick={() => irAte(m.id)}>
                      {t('Ir até a mensagem')}
                    </button>
                  )}
                  {podeFixar && (
                    <button type="button" className="icon-plain" title={t('Desafixar mensagem')} aria-label={t('Desafixar mensagem')} onClick={() => void desafixar(m.id)}>
                      <PinOff size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
