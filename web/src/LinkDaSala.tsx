import { Check, Copy, Link as LinkIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { enderecoDaAula } from './aula';
import { useT } from './i18n';

interface Visita {
  id: number;
  token: string;
  expiraEm: string;
}

interface Copiar {
  (texto: string, qual: string): Promise<void>;
}

const PRAZOS = [1, 2, 3, 6, 12, 24];
const LARGURA = 360;

/**
 * O LINK DA SALA, no ícone de corrente da barra de canais. Um botão só para os dois jeitos de trazer
 * alguém, que antes eram dois ícones em lugares diferentes (o "Link da aula" no alto do palco, decidido
 * em 12/10/2026: "aula é um possível uso"):
 *
 * - **Quem é da turma:** o convite da comunidade com o canal junto. Quem não participa entra na
 *   comunidade e cai na sala; quem já participa só cai nela. Qualquer membro copia (decisão de
 *   03/10/2026: qualquer membro convida) — e quem não administra só tem este, então o clique copia
 *   direto, sem balão.
 * - **Visitante sem conta:** só quem administra. Entra só com o nome, numa conta que some quando o link
 *   vence, sem virar membro (ver server/src/aula-routes.ts — por dentro o nome ainda é "aula").
 *
 * O balão vai por portal com posição fixa: dentro da barra de canais ele seria cortado pela rolagem.
 */
export function LinkDaSala({
  channelId,
  channelName,
  communityId,
  inviteCode,
  podeConvidarVisitante,
}: {
  channelId: number;
  channelName: string;
  communityId: number;
  inviteCode: string | null;
  podeConvidarVisitante: boolean;
}) {
  const t = useT();
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const linkDaTurma = inviteCode
    ? `${window.location.origin}${import.meta.env.BASE_URL}?convite=${encodeURIComponent(inviteCode)}&canal=${channelId}`
    : null;

  async function copiar(texto: string, qual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado((atual) => (atual === qual ? null : atual)), 1500);
    } catch {
      // Sem permissão de copiar: no balão, o endereço do visitante continua à vista para copiar à mão.
    }
  }

  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const largura = Math.min(LARGURA, window.innerWidth - 16);
    setPosicao({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - largura - 8)) });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!balao.current?.contains(alvo) && !botao.current?.contains(alvo)) setAberto(false);
    };
    const tecla = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  if (!linkDaTurma && !podeConvidarVisitante) return null;

  const titulo = copiado === 'turma' && !aberto ? t('Link copiado!') : podeConvidarVisitante ? t('Link da sala') : t('Copiar link');
  return (
    <>
      <button
        ref={botao}
        className={`icon-plain${aberto ? ' ligado' : ''}`}
        title={titulo}
        aria-label={`${titulo}: ${channelName}`}
        aria-expanded={podeConvidarVisitante ? aberto : undefined}
        onClick={() => (podeConvidarVisitante ? setAberto(!aberto) : linkDaTurma && void copiar(linkDaTurma, 'turma'))}
      >
        {copiado === 'turma' && !aberto ? <Check size={14} /> : <LinkIcon size={14} />}
      </button>
      {aberto &&
        posicao &&
        createPortal(
          <div ref={balao} className="link-sala" role="dialog" aria-label={t('Link da sala')} style={{ top: posicao.top, left: posicao.left }}>
            <h3>{t('Link da sala')}</h3>
            {linkDaTurma && (
              <div className="link-sala-turma">
                <p>{t('Para quem é da turma: entra na comunidade e cai direto nesta sala.')}</p>
                <button type="button" className="btn-secondary" onClick={() => void copiar(linkDaTurma, 'turma')}>
                  {copiado === 'turma' ? <Check size={15} /> : <Copy size={15} />} {copiado === 'turma' ? t('Copiado') : t('Copiar link')}
                </button>
              </div>
            )}
            <Visitante channelId={channelId} communityId={communityId} copiado={copiado} copiar={copiar} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** A parte de quem administra: os links de visitante sem conta, com prazo e desligáveis. */
function Visitante({
  channelId,
  communityId,
  copiado,
  copiar,
}: {
  channelId: number;
  communityId: number;
  copiado: string | null;
  copiar: Copiar;
}) {
  const t = useT();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [horas, setHoras] = useState(3);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Visita[]>(`/api/channels/${channelId}/aulas`).then(setVisitas, (e) => setErro((e as Error).message));
  }, [channelId]);

  async function criar() {
    setErro(null);
    try {
      const nova = await api<Visita>(`/api/channels/${channelId}/aulas`, { method: 'POST', body: { horas } });
      setVisitas((lista) => [nova, ...lista]);
      void copiar(enderecoDaAula(nova.token), `visita-${nova.id}`);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function desligar(visita: Visita) {
    await api(`/api/communities/${communityId}/aulas/${visita.id}`, { method: 'DELETE' }).catch(() => {});
    setVisitas((lista) => lista.filter((v) => v.id !== visita.id));
  }

  const hora = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="link-sala-visitante">
      <h4>{t('Visitante sem conta')}</h4>
      <p>{t('Entra só com o nome, sem virar membro, e sai quando o link vence.')}</p>
      <div className="link-sala-criar">
        <label>
          {t('Vale por')}
          <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
            {PRAZOS.map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={() => void criar()}>
          {t('Criar link')}
        </button>
      </div>
      {erro && <p className="form-error">{erro}</p>}
      {visitas.length === 0 ? (
        <p className="link-sala-vazio">{t('Nenhum link valendo.')}</p>
      ) : (
        <ul>
          {visitas.map((visita) => {
            const qual = `visita-${visita.id}`;
            return (
              <li key={visita.id}>
                <input readOnly value={enderecoDaAula(visita.token)} onFocus={(e) => e.target.select()} aria-label={t('Visitante sem conta')} />
                <small>{t('Vale até {hora}', { hora: hora(visita.expiraEm) })}</small>
                <button type="button" className="btn-secondary" onClick={() => void copiar(enderecoDaAula(visita.token), qual)}>
                  {copiado === qual ? <Check size={15} /> : <Copy size={15} />} {copiado === qual ? t('Copiado') : t('Copiar')}
                </button>
                <button type="button" className="link" onClick={() => void desligar(visita)}>
                  {t('Desligar')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
