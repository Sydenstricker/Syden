import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { nomeDeCanal } from './bidi';
import { useT } from './i18n';
import type { Cargo, Channel, Community } from './types';

// CARGOS AUTOMÁTICOS (pacote MEE6, 12/10/2026; ver server/src/cargos-automaticos-routes.ts), nas configurações da
// comunidade, só para quem administra. Duas partes: os cargos que toda pessoa nova recebe ao entrar, e os painéis
// de "escolha seus cargos", em que reagir com um emoji dá o cargo ligado a ele.

interface Painel {
  id: number;
  channelId: number;
  messageId: number;
  canal: string;
  opcoes: { emoji: string; cargoId: number }[];
}

const MAXIMO_DE_OPCOES = 10;

export function CargosAutomaticosSection({ community }: { community: Community }) {
  const t = useT();
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [canais, setCanais] = useState<Channel[]>([]);
  const [deEntrada, setDeEntrada] = useState<number[]>([]);
  const [paineis, setPaineis] = useState<Painel[]>([]);
  const [canalId, setCanalId] = useState<number | ''>('');
  const [texto, setTexto] = useState('');
  const [opcoes, setOpcoes] = useState<{ emoji: string; cargoId: number | '' }[]>([{ emoji: '', cargoId: '' }]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Cargo[]>(`/api/communities/${community.id}/cargos`).then(setCargos, () => setCargos([]));
    api<Channel[]>(`/api/communities/${community.id}/channels`).then(
      (lista) => {
        const deTexto = lista.filter((c) => c.type === 'text');
        setCanais(deTexto);
        setCanalId((atual) => (atual === '' && deTexto[0] ? deTexto[0].id : atual));
      },
      () => setCanais([]),
    );
    api<{ paineis: Painel[]; deEntrada: number[] }>(`/api/communities/${community.id}/cargos-automaticos`).then(
      (r) => {
        setPaineis(r.paineis);
        setDeEntrada(r.deEntrada);
      },
      () => {},
    );
  }, [community.id]);

  const nomeDoCargo = (id: number) => cargos.find((c) => c.id === id)?.nome ?? '?';

  async function alternarEntrada(cargoId: number, marcado: boolean) {
    setErro(null);
    const novos = marcado ? [...deEntrada, cargoId] : deEntrada.filter((id) => id !== cargoId);
    setDeEntrada(novos);
    try {
      const r = await api<{ deEntrada: number[] }>(`/api/communities/${community.id}/cargos-de-entrada`, { method: 'PUT', body: { cargoIds: novos } });
      setDeEntrada(r.deEntrada);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function publicar() {
    setErro(null);
    try {
      const r = await api<{ paineis: Painel[] }>(`/api/communities/${community.id}/paineis-de-cargo`, {
        method: 'POST',
        body: { channelId: canalId, texto, opcoes: opcoes.filter((o) => o.emoji.trim() && o.cargoId !== '') },
      });
      setPaineis(r.paineis);
      setTexto('');
      setOpcoes([{ emoji: '', cargoId: '' }]);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function apagar(painel: Painel) {
    setErro(null);
    try {
      const r = await api<{ paineis: Painel[] }>(`/api/communities/${community.id}/paineis-de-cargo/${painel.id}`, { method: 'DELETE' });
      setPaineis(r.paineis);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (cargos.length === 0) {
    return (
      <>
        <h2>{t('Cargos automáticos')}</h2>
        <p className="settings-lead">{t('Crie os cargos da comunidade primeiro, em Membros. Depois volte aqui para entregá-los sozinhos.')}</p>
      </>
    );
  }

  const prontas = opcoes.filter((o) => o.emoji.trim() && o.cargoId !== '').length;

  return (
    <>
      <h2>{t('Cargos automáticos')}</h2>

      <h3>{t('Cargo de quem entra')}</h3>
      <p className="settings-hint">{t('Toda pessoa nova recebe estes cargos ao entrar na comunidade.')}</p>
      <div className="settings-card moderacao-regras">
        {cargos.map((cargo) => (
          <label key={cargo.id} className="cargo-separado">
            <input type="checkbox" checked={deEntrada.includes(cargo.id)} onChange={(e) => void alternarEntrada(cargo.id, e.target.checked)} />
            <span className="cargo-auto-cor" style={{ background: cargo.cor }} aria-hidden="true" />
            {cargo.nome}
          </label>
        ))}
      </div>

      <h3>{t('Cargos por reação')}</h3>
      <p className="settings-hint">
        {t('O Syden publica uma mensagem no canal com um emoji para cada cargo. Quem reage ganha o cargo; quem tira a reação, perde.')}
      </p>
      {paineis.length > 0 && (
        <ul className="tickets-lista">
          {paineis.map((painel) => (
            <li key={painel.id}>
              <div>
                <strong>{nomeDeCanal(painel.canal, true)}</strong>
                <small>{painel.opcoes.map((o) => `${o.emoji} ${nomeDoCargo(o.cargoId)}`).join(' · ')}</small>
              </div>
              <button type="button" className="icon-plain expression-delete" aria-label={t('Apagar o painel')} onClick={() => void apagar(painel)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="settings-card cargo-auto-form"
        onSubmit={(e) => {
          e.preventDefault();
          void publicar();
        }}
      >
        <select className="moderacao-tempo" value={canalId} aria-label={t('Canal')} onChange={(e) => setCanalId(Number(e.target.value))}>
          {canais.map((c) => (
            <option key={c.id} value={c.id}>
              {nomeDeCanal(c.name, true)}
            </option>
          ))}
        </select>
        <textarea
          className="moderacao-palavras"
          rows={3}
          maxLength={1500}
          value={texto}
          placeholder={t('Escolha os seus cargos reagindo aqui embaixo!')}
          aria-label={t('Texto do painel')}
          onChange={(e) => setTexto(e.target.value)}
        />
        {opcoes.map((opcao, i) => (
          <div key={i} className="cargo-auto-opcao">
            <input
              value={opcao.emoji}
              maxLength={34}
              placeholder="🎮"
              aria-label={t('Emoji {n}', { n: i + 1 })}
              onChange={(e) => setOpcoes(opcoes.map((o, j) => (j === i ? { ...o, emoji: e.target.value } : o)))}
            />
            <select
              className="moderacao-tempo"
              value={opcao.cargoId}
              aria-label={t('Cargo {n}', { n: i + 1 })}
              onChange={(e) => setOpcoes(opcoes.map((o, j) => (j === i ? { ...o, cargoId: Number(e.target.value) } : o)))}
            >
              <option value="">{t('Escolha o cargo')}</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        ))}
        {opcoes.length < MAXIMO_DE_OPCOES && (
          <button type="button" className="link-button" onClick={() => setOpcoes([...opcoes, { emoji: '', cargoId: '' }])}>
            <Plus size={14} aria-hidden="true" /> {t('Mais um emoji')}
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={!texto.trim() || canalId === '' || prontas === 0}>
          {t('Publicar o painel')}
        </button>
      </form>
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}
