import { useEffect, useState } from 'react';
import { api } from './api';
import { nomeDeCanal } from './bidi';
import { idiomaAtual, useT } from './i18n';
import type { Channel, Community } from './types';

// OS SORTEIOS, nas configurações da comunidade (só para quem administra). Quem participa não passa por
// aqui: reage com 🎉 no anúncio que o Syden publica. Ver server/src/sorteios-routes.ts.

interface Sorteio {
  id: number;
  channelId: number;
  premio: string;
  vencedores: number;
  terminaEm: string;
  encerrado: boolean;
  ganhadores: string[];
  participantes: number;
}

/** "2026-10-07T09:00" para o campo de data e hora, na hora local de quem está mexendo. */
function paraOCampo(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function SorteiosSection({ community }: { community: Community }) {
  const t = useT();
  const idioma = idiomaAtual();
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [canais, setCanais] = useState<Channel[]>([]);
  const [canalId, setCanalId] = useState<number | ''>('');
  const [premio, setPremio] = useState('');
  const [vencedores, setVencedores] = useState(1);
  const [quando, setQuando] = useState(() => paraOCampo(new Date(Date.now() + 24 * 60 * 60_000)));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Sorteio[]>(`/api/communities/${community.id}/sorteios`).then(setSorteios, () => setSorteios([]));
    api<Channel[]>(`/api/communities/${community.id}/channels`).then((lista) => {
      const deTexto = lista.filter((c) => c.type === 'text');
      setCanais(deTexto);
      setCanalId((atual) => (atual === '' && deTexto[0] ? deTexto[0].id : atual));
    }, () => null);
  }, [community.id]);

  const quandoPorExtenso = (iso: string) => new Date(iso).toLocaleString(idioma, { dateStyle: 'short', timeStyle: 'short' });

  async function criar() {
    setErro(null);
    try {
      const fim = new Date(quando);
      // Os textos vão prontos, na língua de quem cria. A hora do anúncio leva o fuso: quem lê pode estar
      // em outro. {vencedores} e {premio} do resultado ficam para o servidor preencher na hora.
      // (dateStyle não aceita timeZoneName junto: o Intl recusa a combinação, por isso os campos um a um.)
      const hora = fim.toLocaleString(idioma, { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      const novo = await api<Sorteio>(`/api/communities/${community.id}/sorteios`, {
        method: 'POST',
        body: {
          channelId: canalId,
          premio,
          vencedores,
          terminaEm: fim.toISOString(),
          anuncio: t('🎉 Sorteio: {premio}! Reaja com 🎉 para participar. O resultado sai em {quando}.', { premio: premio.trim(), quando: hora }),
          textoResultado: t('🎉 Resultado do sorteio de {premio}: {vencedores}. Parabéns!'),
          textoVazio: t('O sorteio de {premio} terminou sem participantes.'),
        },
      });
      setSorteios((lista) => [novo, ...lista]);
      setPremio('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function agir(sorteio: Sorteio, acao: 'encerrar' | 'sortear-de-novo') {
    setErro(null);
    try {
      const atualizado = await api<Sorteio>(`/api/communities/${community.id}/sorteios/${sorteio.id}/${acao}`, { method: 'POST' });
      setSorteios((lista) => lista.map((s) => (s.id === atualizado.id ? atualizado : s)));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const nomeDoCanal = (id: number) => {
    const canal = canais.find((c) => c.id === id);
    return canal ? nomeDeCanal(canal.name, true) : '…';
  };

  return (
    <>
      <h2>{t('Sorteios')}</h2>
      <p className="settings-lead">{t('O Syden anuncia o prêmio no canal, e quem quiser participar reage com 🎉. Na hora marcada, ele sorteia entre quem reagiu e publica o resultado.')}</p>

      {sorteios.length > 0 && (
        <ul className="comandos-lista">
          {sorteios.map((sorteio) => (
            <li key={sorteio.id}>
              <div className="comandos-cabeca">
                <strong>
                  <bdi>{sorteio.premio}</bdi>
                </strong>
                {sorteio.encerrado ? (
                  <button type="button" className="link-button" onClick={() => void agir(sorteio, 'sortear-de-novo')}>
                    {t('Sortear de novo')}
                  </button>
                ) : (
                  <button type="button" className="link-button" onClick={() => void agir(sorteio, 'encerrar')}>
                    {t('Encerrar agora')}
                  </button>
                )}
              </div>
              <p className="comandos-resposta">
                <bdi>{nomeDoCanal(sorteio.channelId)}</bdi> ·{' '}
                {sorteio.encerrado ? t('Terminou em {quando}', { quando: quandoPorExtenso(sorteio.terminaEm) }) : t('Termina em {quando}', { quando: quandoPorExtenso(sorteio.terminaEm) })} ·{' '}
                {t('Participantes: {n}', { n: sorteio.participantes })}
              </p>
              {sorteio.encerrado && (
                <p className="comandos-resposta">
                  {sorteio.ganhadores.length > 0 ? t('Quem ganhou: {nomes}', { nomes: sorteio.ganhadores.join(', ') }) : t('Ninguém participou.')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>{t('Novo sorteio')}</h3>
      <form
        className="settings-card comandos-form"
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
      >
        <input className="moderacao-palavras" maxLength={200} value={premio} placeholder={t('Prêmio')} aria-label={t('Prêmio')} onChange={(e) => setPremio(e.target.value)} />
        <div className="agendada-linha">
          <select className="moderacao-tempo" value={canalId} aria-label={t('Canal')} onChange={(e) => setCanalId(Number(e.target.value))}>
            {canais.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeDeCanal(c.name, true)}
              </option>
            ))}
          </select>
          <input type="datetime-local" className="moderacao-tempo" value={quando} aria-label={t('Termina em')} onChange={(e) => setQuando(e.target.value)} />
          <label className="settings-hint">
            {t('Ganhadores')}{' '}
            <input
              type="number"
              className="moderacao-tempo"
              min={1}
              max={20}
              value={vencedores}
              onChange={(e) => setVencedores(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={!premio.trim() || canalId === ''}>
          {t('Começar o sorteio')}
        </button>
      </form>
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}
