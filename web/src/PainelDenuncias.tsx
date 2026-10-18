import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { API_URL, api, loadToken } from './api';
import { chave, useT } from './i18n';
import { BarrarConta } from './PainelBarrados';

interface Denuncia {
  id: number;
  at: string;
  reporterName: string;
  kind: 'mensagem' | 'pessoa' | 'transmissao' | 'idade';
  targetName: string | null;
  temImagem: boolean;
  grave: boolean;
  autoridadeEm: string | null;
  autoridadeProtocolo: string | null;
  snapshot: string | null;
  reason: string;
  status: 'aberta' | 'resolvida';
  resolvedBy: string | null;
  resolution: string | null;
}

const TIPO = { mensagem: chave('Mensagem'), pessoa: chave('Pessoa'), transmissao: chave('Transmissão'), idade: chave('Idade') } as const;

/** A imagem do momento da transmissão: pedida com a sessão (a rota é só de quem cuida do Syden), nunca guardada. */
function ImagemDaDenuncia({ id }: { id: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let feito = false;
    let criada: string | null = null;
    fetch(`${API_URL}/api/reports/${id}/imagem`, { headers: { authorization: `Bearer ${loadToken() ?? ''}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b && !feito) setUrl((criada = URL.createObjectURL(b)));
      })
      .catch(() => {});
    return () => {
      feito = true;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [id]);
  return url ? <img className="denuncia-imagem-painel" src={url} alt="" /> : null;
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * A fila de denúncias, para quem cuida do Syden. Resolver exige escrever o que foi feito — é isso que vai
 * para o registro de auditoria e que responde, meses depois, "por que essa conta foi removida?".
 */
export function PainelDenuncias() {
  const t = useT();
  const [denuncias, setDenuncias] = useState<Denuncia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [protocolo, setProtocolo] = useState<Record<number, string>>({});
  const [barrando, setBarrando] = useState<number | null>(null);

  function carregar() {
    api<{ denuncias: Denuncia[] }>('/api/reports')
      .then((r) => setDenuncias(r.denuncias))
      .catch((e) => setErro((e as Error).message));
  }
  useEffect(carregar, []);
  // denúncia nova chegando com o painel aberto (Shell.tsx repassa o 'report:new')
  useEffect(() => {
    window.addEventListener('syden:denuncias', carregar);
    return () => window.removeEventListener('syden:denuncias', carregar);
  }, []);

  async function resolver(id: number) {
    try {
      await api(`/api/reports/${id}/resolver`, { method: 'POST', body: { resolucao: texto } });
      setResolvendo(null);
      setTexto('');
      carregar();
      window.dispatchEvent(new Event('syden:denuncia-resolvida')); // o número ao lado de "Uso do servidor
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function comunicar(id: number) {
    try {
      await api(`/api/reports/${id}/autoridade`, { method: 'POST', body: { protocolo: protocolo[id] ?? '' } });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function marcarGrave(id: number, grave: boolean) {
    try {
      await api(`/api/reports/${id}/grave`, { method: 'POST', body: { grave } });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (erro) return <p className="form-error">{erro}</p>;
  if (!denuncias) return null;

  if (denuncias.length === 0) {
    return (
      <section className="usage-card">
        <h3>
          <Flag size={16} aria-hidden="true" /> {t('Denúncias')}
        </h3>
        <p className="settings-hint">{t('Nenhuma denúncia até agora.')}</p>
      </section>
    );
  }

  return (
    <section className="usage-card">
      <h3>
        <Flag size={16} aria-hidden="true" /> {t('Denúncias')}
      </h3>
      <ul className="denuncias-lista">
        {denuncias.map((d) => (
          <li key={d.id} className={`denuncia-item${d.status === 'resolvida' ? ' resolvida' : ''}${d.grave ? ' grave' : ''}`}>
            <div className="denuncia-topo">
              <strong>
                {d.grave && <span className="denuncia-selo-grave">{t('Grave')} · </span>}
                {t(TIPO[d.kind])}
                {d.targetName && ` de ${d.targetName}`}
              </strong>
              <small>
                {quando(d.at)} · denunciada por {d.reporterName}
              </small>
            </div>
            <p className="denuncia-motivo">{d.reason}</p>
            {d.snapshot && <blockquote className="denuncia-copia">{d.snapshot}</blockquote>}
            {d.temImagem && <ImagemDaDenuncia id={d.id} />}
            {/* O CASO GRAVE (ECA Digital, arts. 27 e 28): remover na hora, guardar a prova e comunicar às autoridades.
                O passo a passo está em docs/autoridades.md; aqui fica o registro de que foi feito. */}
            {d.grave &&
              (d.autoridadeEm ? (
                <p className="settings-hint">
                  {t('Comunicada às autoridades em {quando}: {protocolo}', { quando: quando(d.autoridadeEm), protocolo: d.autoridadeProtocolo ?? '' })}
                </p>
              ) : (
                <div className="denuncia-autoridade">
                  <input
                    value={protocolo[d.id] ?? ''}
                    onChange={(e) => setProtocolo((p) => ({ ...p, [d.id]: e.target.value }))}
                    placeholder={t('Para quem foi comunicado e o protocolo (ex.: SaferNet 123)')}
                  />
                  <button type="button" className="btn-primary" disabled={!(protocolo[d.id] ?? '').trim()} onClick={() => comunicar(d.id)}>
                    {t('Registrar a comunicação')}
                  </button>
                </div>
              ))}
            {!d.autoridadeEm && (
              <button type="button" className="btn-secondary" onClick={() => marcarGrave(d.id, !d.grave)}>
                {d.grave ? t('Não é grave') : t('Marcar como grave')}
              </button>
            )}

            {/* Banir ou suspender por idade direto da denúncia (o nome já vem preenchido). */}
            {d.status === 'aberta' && d.targetName && barrando === d.id && <BarrarConta username={d.targetName} />}
            {d.status === 'aberta' && d.targetName && barrando !== d.id && (
              <button type="button" className="btn-secondary" onClick={() => setBarrando(d.id)}>
                {t('Banir ou suspender {nome}', { nome: d.targetName })}
              </button>
            )}
            {d.status === 'resolvida' ? (
              <p className="settings-hint">
                Resolvida por {d.resolvedBy}: {d.resolution}
              </p>
            ) : resolvendo === d.id ? (
              <div className="denuncia-resolver">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  placeholder={t('O que você fez a respeito?')}
                  autoFocus
                />
                <div className="dialog-actions">
                  <button type="button" className="btn-secondary" onClick={() => setResolvendo(null)}>
                    {t('Cancelar')}
                  </button>
                  <button type="button" className="btn-primary" disabled={!texto.trim()} onClick={() => resolver(d.id)}>
                    {t('Marcar como resolvida')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => setResolvendo(d.id)}>
                {t('Resolver')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
