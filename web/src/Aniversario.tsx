import { useEffect, useState } from 'react';
import { api } from './api';
import { nomeDeCanal } from './bidi';
import { idiomaAtual, useT } from './i18n';
import type { Channel, Community } from './types';

// OS ANIVERSÁRIOS (ver server/src/aniversarios-routes.ts): a pessoa informa o dela em Minha conta (dia
// e mês, nunca o ano), e quem administra escolhe o canal e o texto dos parabéns da comunidade.

const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** O aniversário da própria pessoa, em Configurações → Minha conta. */
export function MeuAniversario() {
  const t = useT();
  const idioma = idiomaAtual();
  const [mes, setMes] = useState<number | ''>('');
  const [dia, setDia] = useState<number | ''>('');
  const [guardado, setGuardado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    api<{ mes: number | null; dia: number | null }>('/api/me/aniversario').then((r) => {
      setMes(r.mes ?? '');
      setDia(r.dia ?? '');
      setGuardado(r.mes !== null);
    }, () => null);
  }, []);

  async function salvar(corpo: { dia: number | null; mes: number | null }) {
    setAviso(null);
    try {
      await api('/api/me/aniversario', { method: 'PUT', body: corpo });
      setGuardado(corpo.mes !== null);
      if (corpo.mes === null) {
        setMes('');
        setDia('');
      }
      setAviso({ ok: true, texto: t('Salvo.') });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  }

  // Os meses escritos pelo Intl, na língua de cada um: "outubro", "October", "十月".
  const nomeDoMes = (m: number) => new Intl.DateTimeFormat(idioma, { month: 'long' }).format(new Date(2000, m - 1, 1));
  const dias = mes === '' ? 31 : DIAS_NO_MES[mes - 1];

  return (
    <>
      <h3>{t('Aniversário')}</h3>
      <div className="settings-card">
        <p className="settings-hint">
          {t('Só o dia e o mês, nunca o ano. As comunidades que avisam aniversários dão os parabéns no dia. É opcional, e dá para apagar quando quiser.')}
        </p>
        <div className="agendada-linha">
          <select className="moderacao-tempo" value={dia} aria-label={t('Dia')} onChange={(e) => setDia(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('Dia')}</option>
            {Array.from({ length: dias }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="moderacao-tempo"
            value={mes}
            aria-label={t('Mês')}
            onChange={(e) => {
              const novo = e.target.value ? Number(e.target.value) : '';
              setMes(novo);
              if (novo !== '' && dia !== '' && dia > DIAS_NO_MES[novo - 1]) setDia(DIAS_NO_MES[novo - 1]);
            }}
          >
            <option value="">{t('Mês')}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {nomeDoMes(m)}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary" disabled={mes === '' || dia === ''} onClick={() => void salvar({ dia: dia as number, mes: mes as number })}>
            {t('Salvar')}
          </button>
          {guardado && (
            <button type="button" className="link-button" onClick={() => void salvar({ dia: null, mes: null })}>
              {t('Apagar')}
            </button>
          )}
        </div>
        {aviso && <p className={aviso.ok ? 'settings-hint' : 'form-error'}>{aviso.texto}</p>}
      </div>
    </>
  );
}

/** Os parabéns da comunidade, na seção de mensagens agendadas (só para quem administra). */
export function ParabensDaComunidade({ community }: { community: Community }) {
  const t = useT();
  const [canais, setCanais] = useState<Channel[]>([]);
  const [canalId, setCanalId] = useState<number | ''>('');
  // O texto nasce na língua de quem configura: é nela que a comunidade conversa.
  const [texto, setTexto] = useState(() => t('Hoje é aniversário de {pessoa}! 🎉 Parabéns!'));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    api<Channel[]>(`/api/communities/${community.id}/channels`).then((lista) => setCanais(lista.filter((c) => c.type === 'text')), () => null);
    api<{ canalId: number | null; texto: string | null }>(`/api/communities/${community.id}/aniversarios`).then((r) => {
      setCanalId(r.canalId ?? '');
      if (r.texto) setTexto(r.texto);
    }, () => null);
  }, [community.id]);

  async function salvar() {
    setAviso(null);
    try {
      await api(`/api/communities/${community.id}/aniversarios`, {
        method: 'PUT',
        body: canalId === '' ? { canalId: null } : { canalId, texto },
      });
      setAviso({ ok: true, texto: t('Salvo.') });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  }

  return (
    <>
      <h3>{t('Aniversários')}</h3>
      <div className="settings-card comandos-form">
        <p className="settings-hint">{t('No dia do aniversário de quem informou a data, o Syden publica os parabéns no canal escolhido. Use {pessoa} no lugar do nome.')}</p>
        <select className="moderacao-tempo" value={canalId} aria-label={t('Canal dos parabéns')} onChange={(e) => setCanalId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">{t('Desligado')}</option>
          {canais.map((c) => (
            <option key={c.id} value={c.id}>
              {nomeDeCanal(c.name, true)}
            </option>
          ))}
        </select>
        {canalId !== '' && (
          <textarea className="moderacao-palavras" rows={2} maxLength={500} value={texto} aria-label={t('Texto dos parabéns')} onChange={(e) => setTexto(e.target.value)} />
        )}
        <button type="button" className="btn-primary" onClick={() => void salvar()}>
          {t('Salvar')}
        </button>
        {aviso && <p className={aviso.ok ? 'settings-hint' : 'form-error'}>{aviso.texto}</p>}
      </div>
    </>
  );
}
