import { Check, Copy, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { idiomaAtual, useT } from './i18n';
import { mandarConvite } from './linkDeConvite';

/**
 * CONVITES COM PRAZO E LIMITE DE USOS (23/11/2026; ver server/src/convites-routes.ts). O link de sempre da comunidade
 * continua o do "Chamar alguém" e do botão da capa, e não expira; aqui qualquer membro gera um link A MAIS, que vence e
 * se gasta como escolher. As listas das validades e dos limites são as mesmas do servidor (VALIDADES, LIMITES_DE_USO).
 */

export interface ConviteAtivo {
  code: string;
  criadoPor: number;
  criadoPorNome: string;
  criadoPorExibicao: string | null;
  expiraEm: string | null;
  usosMax: number | null;
  usos: number;
  criadoEm: string;
}

const VALIDADES = ['30m', '1h', '6h', '12h', '1d', '7d', 'nunca'] as const;
const LIMITES: (number | null)[] = [null, 1, 5, 10, 25, 50, 100];

/** O nome de cada validade, com a frase inteira (quem traduz recebe "30 minutos", e não "{n} minutos" montado). */
function nomeDaValidade(v: (typeof VALIDADES)[number], t: ReturnType<typeof useT>): string {
  switch (v) {
    case '30m':
      return t('30 minutos');
    case '1h':
      return t('1 hora');
    case '6h':
      return t('6 horas');
    case '12h':
      return t('12 horas');
    case '1d':
      return t('1 dia');
    case '7d':
      return t('7 dias');
    default:
      return t('Nunca');
  }
}

/** A lista dos convites que ainda valem. `todos` é a de quem administra: mostra quem criou cada um. */
export function ListaDeConvites({ communityId, todos, vez = 0 }: { communityId: number; todos: boolean; vez?: number }) {
  const t = useT();
  const idioma = idiomaAtual();
  const [lista, setLista] = useState<ConviteAtivo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    api<ConviteAtivo[]>(`/api/communities/${communityId}/convites${todos ? '' : '?meus'}`).then(setLista, (e) => setErro((e as Error).message));
  }, [communityId, vez]);

  async function revogar(c: ConviteAtivo) {
    setErro(null);
    try {
      await api(`/api/communities/${communityId}/convites/${c.code}`, { method: 'DELETE' });
      setLista((l) => l?.filter((x) => x.code !== c.code) ?? l);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function copiar(c: ConviteAtivo) {
    const r = await mandarConvite(c.code, '');
    if (r === 'copiado') {
      setCopiado(c.code);
      setTimeout(() => setCopiado((atual) => (atual === c.code ? null : atual)), 2000);
    }
  }

  return (
    <>
      {erro && <p className="form-error">{erro}</p>}
      {lista && lista.length === 0 && <p className="settings-hint">{t('Nenhum convite ativo.')}</p>}
      <div className="expression-list">
        {lista?.map((c) => {
          const usos =
            c.usosMax !== null
              ? t('{usos} de {max} usos', { usos: c.usos, max: c.usosMax })
              : c.usos === 1
                ? t('1 uso')
                : t('{n} usos', { n: c.usos });
          const validade = c.expiraEm
            ? t('Expira em {data}', { data: new Date(c.expiraEm).toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short' }) })
            : t('Não expira');
          return (
            <div key={c.code} className="expression-row">
              <code className="expression-name">{c.code}</code>
              <span className="expression-author">
                {todos ? `${c.criadoPorExibicao ?? c.criadoPorNome} · ` : ''}
                {usos} · {validade}
              </span>
              <button
                className="icon-plain expression-play"
                title={copiado === c.code ? t('Link copiado!') : t('Copiar link de convite')}
                aria-label={copiado === c.code ? t('Link copiado!') : t('Copiar link de convite')}
                onClick={() => void copiar(c)}
              >
                {copiado === c.code ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                className="icon-plain expression-delete"
                title={t('Revogar convite')}
                aria-label={t('Revogar convite')}
                onClick={() => void revogar(c)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Em Configurações → Membros, para quem administra: todos os convites a mais que ainda valem. */
export function ConvitesDaComunidade({ communityId }: { communityId: number }) {
  const t = useT();
  return (
    <>
      <h3>{t('Convites')}</h3>
      <ListaDeConvites communityId={communityId} todos />
    </>
  );
}

/** A janela do "Configurar convite": escolhe validade e limite, gera o link e o manda como o convite de sempre. */
export function ConfigurarConvite({ communityId, nome, aoFechar }: { communityId: number; nome: string; aoFechar: () => void }) {
  const t = useT();
  const [validade, setValidade] = useState<(typeof VALIDADES)[number]>('7d');
  const [usos, setUsos] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<'copiado' | 'compartilhado' | null>(null);
  const [vez, setVez] = useState(0);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  async function gerar() {
    setOcupado(true);
    setErro(null);
    setPronto(null);
    try {
      const { code } = await api<{ code: string }>(`/api/communities/${communityId}/convites`, { method: 'POST', body: { validade, usos } });
      setVez((v) => v + 1);
      const r = await mandarConvite(code, nome);
      if (r === 'copiado' || r === 'compartilhado') setPronto(r);
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="configurar-convite-titulo"
        onSubmit={(e) => {
          e.preventDefault();
          void gerar();
        }}
      >
        <h2 id="configurar-convite-titulo">{t('Configurar convite')}</h2>
        <p className="settings-hint">{t('Um link a mais, que vence e se gasta como você escolher. O link de sempre continua valendo.')}</p>
        <label>
          {t('Validade')}
          <select value={validade} onChange={(e) => setValidade(e.target.value as (typeof VALIDADES)[number])}>
            {VALIDADES.map((v) => (
              <option key={v} value={v}>
                {nomeDaValidade(v, t)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Limite de usos')}
          <select value={usos ?? ''} onChange={(e) => setUsos(e.target.value === '' ? null : Number(e.target.value))}>
            {LIMITES.map((n) => (
              <option key={n ?? 'sem'} value={n ?? ''}>
                {n === null ? t('Sem limite') : n === 1 ? t('1 uso') : t('{n} usos', { n })}
              </option>
            ))}
          </select>
        </label>
        {erro && <p className="form-error">{erro}</p>}
        {pronto === 'copiado' && <p className="settings-hint">{t('Link copiado!')}</p>}
        <h3>{t('Seus convites')}</h3>
        <ListaDeConvites communityId={communityId} todos={false} vez={vez} />
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={aoFechar}>
            {t('Fechar')}
          </button>
          <button type="submit" disabled={ocupado}>
            {t('Gerar link')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
