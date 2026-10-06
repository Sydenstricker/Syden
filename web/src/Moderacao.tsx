import { useEffect, useState } from 'react';
import { api } from './api';
import { idiomaAtual, useT } from './i18n';
import { nomeDeCanal } from './bidi';
import type { Channel, Community } from './types';

// A MODERAÇÃO AUTOMÁTICA, nas configurações da comunidade (só para quem administra). As regras moram
// em server/src/automod.ts: palavras proibidas, links e excesso de mensagens, e o modo lento por canal.
// Quem administra não passa por nenhuma delas.

interface Regras {
  palavras: string[];
  links: boolean;
  flood: boolean;
}

/** Os tempos de modo lento que o servidor aceita (MODOS_LENTOS em automod.ts). */
const TEMPOS = [0, 5, 10, 30, 60, 300, 900];

/**
 * "30 s", "5 min" — na língua da pessoa. Quem escreve a unidade é o Intl, e não o código: "min" e "s"
 * não são iguais em toda língua, e uma lista cravada aqui seria português em 70 idiomas.
 */
export function duracaoCurta(segundos: number, idioma: string): string {
  const minutos = segundos >= 60 && segundos % 60 === 0;
  return new Intl.NumberFormat(idioma, { style: 'unit', unit: minutos ? 'minute' : 'second', unitDisplay: 'short' }).format(
    minutos ? segundos / 60 : segundos,
  );
}

export function ModeracaoSection({ community }: { community: Community }) {
  const t = useT();
  const [regras, setRegras] = useState<Regras | null>(null);
  const [texto, setTexto] = useState('');
  const [canais, setCanais] = useState<Channel[]>([]);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    api<Regras>(`/api/communities/${community.id}/moderacao`).then(
      (r) => {
        if (!vivo) return;
        setRegras(r);
        setTexto(r.palavras.join('\n'));
      },
      (e) => vivo && setAviso({ ok: false, texto: (e as Error).message }),
    );
    api<Channel[]>(`/api/communities/${community.id}/channels`).then(
      (lista) => vivo && setCanais(lista.filter((c) => c.type === 'text')),
      () => null,
    );
    return () => {
      vivo = false;
    };
  }, [community.id]);

  async function salvar(proximas: Regras) {
    setAviso(null);
    try {
      const salvas = await api<Regras>(`/api/communities/${community.id}/moderacao`, { method: 'PUT', body: proximas });
      setRegras(salvas);
      setTexto(salvas.palavras.join('\n'));
      setAviso({ ok: true, texto: t('Salvo.') });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  }

  async function mudarModoLento(canal: Channel, segundos: number) {
    setAviso(null);
    try {
      const atualizado = await api<Channel>(`/api/channels/${canal.id}/modo-lento`, { method: 'PUT', body: { segundos } });
      setCanais((lista) => lista.map((c) => (c.id === canal.id ? atualizado : c)));
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  }

  if (!regras) return aviso ? <p className="form-error">{aviso.texto}</p> : null;
  // Uma por linha (ou separadas por vírgula): o jeito que quem cola uma lista de algum lugar já tem.
  const palavrasDoTexto = texto
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <h2>{t('Moderação')}</h2>
      <p className="settings-lead">
        {t('Regras que o Syden aplica sozinho, antes de a mensagem aparecer. Quem administra não passa por elas. A mensagem barrada volta para quem escreveu, com o motivo, e ninguém mais a vê.')}
      </p>

      <h3>{t('Regras')}</h3>
      <div className="settings-card moderacao-regras">
        <label className="cargo-separado">
          <input type="checkbox" checked={regras.links} onChange={(e) => void salvar({ ...regras, palavras: palavrasDoTexto, links: e.target.checked })} />
          {t('Bloquear links nas mensagens')}
        </label>
        <label className="cargo-separado">
          <input type="checkbox" checked={regras.flood} onChange={(e) => void salvar({ ...regras, palavras: palavrasDoTexto, flood: e.target.checked })} />
          {t('Barrar excesso de mensagens (mais de 5 em 10 segundos)')}
        </label>
      </div>

      <h3>{t('Palavras proibidas')}</h3>
      <div className="settings-card">
        <p className="settings-hint">
          {t('Uma por linha. Vale a palavra inteira, sem diferença de acento ou de maiúscula: proibir uma palavra não barra outra mais longa que só a contenha.')}
        </p>
        <textarea
          className="moderacao-palavras"
          rows={6}
          value={texto}
          aria-label={t('Palavras proibidas')}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="button" className="btn-primary" onClick={() => void salvar({ ...regras, palavras: palavrasDoTexto })}>
          {t('Salvar')}
        </button>
      </div>

      <h3>{t('Modo lento')}</h3>
      <div className="settings-card">
        <p className="settings-hint">{t('Quanto tempo cada pessoa espera entre uma mensagem e outra no canal.')}</p>
        <ul className="cargo-lista">
          {canais.map((canal) => (
            <li key={canal.id} className="cargo-linha">
              <bdi className="moderacao-canal">{nomeDeCanal(canal.name, true)}</bdi>
              <select
                className="moderacao-tempo"
                value={canal.modoLento ?? 0}
                aria-label={t('Modo lento de {canal}', { canal: nomeDeCanal(canal.name, true) })}
                onChange={(e) => void mudarModoLento(canal, Number(e.target.value))}
              >
                {TEMPOS.map((segundos) => (
                  <option key={segundos} value={segundos}>
                    {segundos === 0 ? t('Desligado') : duracaoCurta(segundos, idiomaAtual())}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
      {aviso && <p className={aviso.ok ? 'settings-hint' : 'form-error'}>{aviso.texto}</p>}
    </>
  );
}
