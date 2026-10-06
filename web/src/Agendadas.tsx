import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { ParabensDaComunidade } from './Aniversario';
import { nomeDeCanal } from './bidi';
import { chave, idiomaAtual, useT } from './i18n';
import type { Channel, Community } from './types';

// MENSAGENS AGENDADAS, nas configurações da comunidade (só para quem administra): canal, texto, hora e
// repetição. Na hora marcada, o Syden publica. Ver server/src/agendador.ts.

interface Agendada {
  id: number;
  channelId: number;
  texto: string;
  proximaEm: string;
  repetir: 'nunca' | 'diario' | 'semanal';
}

const REPETICOES: { valor: Agendada['repetir']; rotulo: string }[] = [
  { valor: 'nunca', rotulo: chave('Uma vez') },
  { valor: 'diario', rotulo: chave('Todo dia') },
  { valor: 'semanal', rotulo: chave('Toda semana') },
];

/** "2026-10-07T09:00" para o campo de data e hora, na hora local de quem está mexendo. */
function paraOCampo(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AgendadasSection({ community }: { community: Community }) {
  const t = useT();
  const idioma = idiomaAtual();
  const [agendadas, setAgendadas] = useState<Agendada[]>([]);
  const [canais, setCanais] = useState<Channel[]>([]);
  const [canalId, setCanalId] = useState<number | ''>('');
  const [texto, setTexto] = useState('');
  const [quando, setQuando] = useState(() => paraOCampo(new Date(Date.now() + 60 * 60_000)));
  const [repetir, setRepetir] = useState<Agendada['repetir']>('nunca');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Agendada[]>(`/api/communities/${community.id}/agendadas`).then(setAgendadas, () => setAgendadas([]));
    api<Channel[]>(`/api/communities/${community.id}/channels`).then((lista) => {
      const deTexto = lista.filter((c) => c.type === 'text');
      setCanais(deTexto);
      setCanalId((atual) => (atual === '' && deTexto[0] ? deTexto[0].id : atual));
    }, () => null);
  }, [community.id]);

  async function agendar() {
    setErro(null);
    try {
      // O campo dá a hora LOCAL; o servidor guarda o instante, que é o que vale em qualquer fuso.
      const nova = await api<Agendada>(`/api/communities/${community.id}/agendadas`, {
        method: 'POST',
        body: { channelId: canalId, texto, quando: new Date(quando).toISOString(), repetir },
      });
      setAgendadas((lista) => [...lista, nova].sort((a, b) => a.proximaEm.localeCompare(b.proximaEm)));
      setTexto('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function apagar(agendada: Agendada) {
    setErro(null);
    try {
      await api(`/api/communities/${community.id}/agendadas/${agendada.id}`, { method: 'DELETE' });
      setAgendadas((lista) => lista.filter((a) => a.id !== agendada.id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const nomeDoCanal = (id: number) => {
    const canal = canais.find((c) => c.id === id);
    return canal ? nomeDeCanal(canal.name, true) : '…';
  };
  const rotuloDe = (valor: Agendada['repetir']) => t(REPETICOES.find((r) => r.valor === valor)!.rotulo);

  return (
    <>
      <h2>{t('Mensagens agendadas')}</h2>
      <p className="settings-lead">{t('Na hora marcada, o Syden publica o texto no canal. Dá para repetir todo dia ou toda semana.')}</p>

      {agendadas.length > 0 && (
        <ul className="comandos-lista">
          {agendadas.map((agendada) => (
            <li key={agendada.id}>
              <div className="comandos-cabeca">
                <span className="agendada-quando">
                  <bdi>{nomeDoCanal(agendada.channelId)}</bdi> ·{' '}
                  {new Date(agendada.proximaEm).toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short' })} · {rotuloDe(agendada.repetir)}
                </span>
                <button
                  type="button"
                  className="icon-plain expression-delete"
                  aria-label={t('Apagar a mensagem agendada')}
                  onClick={() => void apagar(agendada)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="comandos-resposta">{agendada.texto}</p>
            </li>
          ))}
        </ul>
      )}

      <h3>{t('Nova mensagem agendada')}</h3>
      <form
        className="settings-card comandos-form"
        onSubmit={(e) => {
          e.preventDefault();
          void agendar();
        }}
      >
        <div className="agendada-linha">
          <select className="moderacao-tempo" value={canalId} aria-label={t('Canal')} onChange={(e) => setCanalId(Number(e.target.value))}>
            {canais.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeDeCanal(c.name, true)}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            className="moderacao-tempo"
            value={quando}
            aria-label={t('Quando')}
            onChange={(e) => setQuando(e.target.value)}
          />
          <select className="moderacao-tempo" value={repetir} aria-label={t('Repetir')} onChange={(e) => setRepetir(e.target.value as Agendada['repetir'])}>
            {REPETICOES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {t(r.rotulo)}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="moderacao-palavras"
          rows={4}
          maxLength={2000}
          value={texto}
          placeholder={t('O que o Syden publica')}
          aria-label={t('Texto da mensagem agendada')}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={!texto.trim() || canalId === ''}>
          {t('Agendar')}
        </button>
      </form>
      {erro && <p className="form-error">{erro}</p>}

      <ParabensDaComunidade community={community} />
    </>
  );
}
