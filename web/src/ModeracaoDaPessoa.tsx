import { Clock, MessageSquareWarning, TimerOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { idiomaAtual, useT } from './i18n';
import { duracaoCurta } from './Moderacao';
import type { CommunityMember, Role } from './types';

// ADVERTIR E SILENCIAR, no menu do botão direito sobre uma pessoa (ver server/src/advertencias-routes.ts).
// Só aparece para quem pode agir sobre ela — a mesma regra da remoção: ninguém sobre o dono, nem sobre
// si; administrador sobre membro; sobre outro administrador, só o dono.

interface Advertencia {
  id: number;
  motivo: string;
  autor: string | null;
  criadaEm: string;
}

/** Os tempos de silêncio que o servidor aceita (MINUTOS_DE_SILENCIO), sem o 0 — que é "tirar". */
const TEMPOS = [5, 60, 600, 1440, 10080];

/** "1 h", "1 dia", "1 semana" — o Intl escreve na língua de cada um. */
export function duracao(minutos: number, idioma: string): string {
  if (minutos % 10080 === 0) return new Intl.NumberFormat(idioma, { style: 'unit', unit: 'week', unitDisplay: 'long' }).format(minutos / 10080);
  if (minutos % 1440 === 0) return new Intl.NumberFormat(idioma, { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(minutos / 1440);
  if (minutos % 60 === 0) return new Intl.NumberFormat(idioma, { style: 'unit', unit: 'hour', unitDisplay: 'short' }).format(minutos / 60);
  return duracaoCurta(minutos * 60, idioma);
}

/** O silêncio ainda vale? O vencido some sozinho, sem ninguém precisar tirar. */
export function silencioVale(ate: string | null | undefined): ate is string {
  return !!ate && Date.parse(ate) > Date.now();
}

export function podeAgirSobre(meuPapel: Role, papelDoAlvo: Role, souEu: boolean): boolean {
  if (souEu || papelDoAlvo === 'owner') return false;
  if (meuPapel === 'owner') return true;
  return meuPapel === 'admin' && papelDoAlvo === 'member';
}

export function ModeracaoDaPessoa({
  communityId,
  membro,
  onFeito,
}: {
  communityId: number;
  membro: CommunityMember;
  /** Deu certo: o menu fecha. */
  onFeito: () => void;
}) {
  const t = useT();
  const [advertindo, setAdvertindo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [anteriores, setAnteriores] = useState<Advertencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const idioma = idiomaAtual();
  const silenciado = silencioVale(membro.silenciadoAte) ? membro.silenciadoAte : null;
  const base = `/api/communities/${communityId}/members/${membro.id}`;

  // O histórico aparece junto do campo: advertir de novo sem saber das anteriores é advertir no escuro.
  useEffect(() => {
    if (!advertindo) return;
    api<Advertencia[]>(`${base}/advertencias`).then(setAnteriores, () => setAnteriores([]));
  }, [advertindo, base]);

  async function fazer(caminho: string, metodo: 'POST' | 'PUT', corpo: Record<string, unknown>) {
    setErro(null);
    try {
      await api(caminho, { method: metodo, body: corpo });
      onFeito();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="moderacao-da-pessoa">
      {advertindo ? (
        <div className="person-menu-nota">
          <textarea
            autoFocus
            rows={2}
            value={motivo}
            maxLength={500}
            placeholder={t('Motivo da advertência')}
            aria-label={t('Motivo da advertência')}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="person-menu-nota-rodape">
            <span>{t('A pessoa recebe o motivo')}</span>
            <button className="link-button" disabled={motivo.trim().length < 3} onClick={() => void fazer(`${base}/advertencias`, 'POST', { motivo: motivo.trim() })}>
              {t('Advertir')}
            </button>
          </div>
          {anteriores && anteriores.length > 0 && (
            <ul className="advertencias-anteriores">
              {anteriores.map((a) => (
                <li key={a.id}>
                  <small>{new Date(a.criadaEm).toLocaleDateString(idioma)}</small> {a.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button className="person-menu-item" role="menuitem" onClick={() => setAdvertindo(true)}>
          <span className="person-menu-icone" aria-hidden="true">
            <MessageSquareWarning size={16} />
          </span>
          <span className="person-menu-texto">{t('Advertir…')}</span>
        </button>
      )}

      {silenciado ? (
        <button className="person-menu-item" role="menuitem" onClick={() => void fazer(`${base}/silencio`, 'PUT', { minutos: 0 })}>
          <span className="person-menu-icone" aria-hidden="true">
            <TimerOff size={16} />
          </span>
          <span className="person-menu-texto">
            {t('Tirar o silêncio')}
            <small>{t('Em silêncio até {hora}', { hora: new Date(silenciado).toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short' }) })}</small>
          </span>
        </button>
      ) : (
        <label className="person-menu-volume">
          <span className="moderacao-da-pessoa-rotulo">
            <Clock size={14} aria-hidden="true" /> {t('Silenciar por…')}
          </span>
          <select
            value=""
            aria-label={t('Silenciar {pessoa} por', { pessoa: membro.username })}
            onChange={(e) => e.target.value && void fazer(`${base}/silencio`, 'PUT', { minutos: Number(e.target.value) })}
          >
            <option value="" disabled>
              {t('Escolha o tempo')}
            </option>
            {TEMPOS.map((minutos) => (
              <option key={minutos} value={minutos}>
                {duracao(minutos, idioma)}
              </option>
            ))}
          </select>
        </label>
      )}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}
