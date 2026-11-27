import { Dices, Minus, Plus, Save, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { ajustarModificador, linhasParaIniciativa, linhasParaLista, somarDado } from './dadosNotacao';
import { useT } from './i18n';
import { usePessoasNaSala } from './pessoasNaSala';
import type { Message } from './types';

type Aba = 'dados' | 'sorteios';
type Sorteio = 'moeda' | 'numero' | 'escolha' | 'ordem' | 'times' | 'iniciativa';
type Modo = 'normal' | 'vantagem' | 'desvantagem';

const DADOS_RAPIDOS: (number | '%')[] = [4, 6, 8, 10, 12, 20, '%'];

interface Atalho {
  id: number;
  nome: string;
  expressao: string;
}

/**
 * A janela dos dados (27/11/2026; o porquê no CLAUDE.md, "O bot de dados"). Duas abas: a rolagem (expressão, dados de um
 * toque, vantagem, rolagem secreta e os atalhos que a pessoa guardou) e os sorteios (moeda, número, escolha, embaralhar,
 * times e iniciativa, com a gente da sala de voz à mão). Quem sorteia é o servidor; o cartão chega pelo chat.
 */
export function DadosDialog({
  channelId,
  threadId = null,
  onClose,
  onCreated,
}: {
  channelId: number;
  threadId?: number | null;
  onClose: () => void;
  onCreated?: (message: Message) => void;
}) {
  const t = useT();
  const pessoas = usePessoasNaSala();
  const [aba, setAba] = useState<Aba>('dados');
  const [expressao, setExpressao] = useState('');
  const [modo, setModo] = useState<Modo>('normal');
  const [rotulo, setRotulo] = useState('');
  const [secreta, setSecreta] = useState(false);
  const [atalhos, setAtalhos] = useState<Atalho[]>([]);
  const [nomeDoAtalho, setNomeDoAtalho] = useState<string | null>(null);
  const [sorteio, setSorteio] = useState<Sorteio>('moeda');
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('100');
  const [lista, setLista] = useState('');
  const [quantos, setQuantos] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    api<{ atalhos: Atalho[] }>('/api/me/dados-atalhos')
      .then((r) => setAtalhos(r.atalhos))
      .catch(() => {
        // os atalhos são um conforto: sem eles a janela funciona do mesmo jeito
      });
  }, []);

  async function enviar(corpo: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const message = await api<Message>(`/api/channels/${channelId}/dados`, {
        method: 'POST',
        body: { ...corpo, rotulo: rotulo.trim() || undefined, secreta, threadId },
      });
      onCreated?.(message);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const expressaoFinal = expressao.trim() + (modo === 'vantagem' ? ' vantagem' : modo === 'desvantagem' ? ' desvantagem' : '');

  async function guardarAtalho() {
    const nome = (nomeDoAtalho ?? '').trim();
    if (!nome || !expressao.trim()) return;
    try {
      const novo = await api<Atalho>('/api/me/dados-atalhos', { method: 'POST', body: { nome, expressao: expressao.trim() } });
      setAtalhos((lista) => [...lista, novo]);
      setNomeDoAtalho(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function apagarAtalho(id: number) {
    try {
      await api(`/api/me/dados-atalhos/${id}`, { method: 'DELETE' });
      setAtalhos((lista) => lista.filter((a) => a.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function sortear() {
    switch (sorteio) {
      case 'moeda':
        return void enviar({ tipo: 'moeda' });
      case 'numero':
        return void enviar({ tipo: 'numero', min: Number(min), max: Number(max) });
      case 'escolha':
        return void enviar({ tipo: 'escolha', opcoes: linhasParaLista(lista) });
      case 'ordem':
        return void enviar({ tipo: 'ordem', opcoes: linhasParaLista(lista) });
      case 'times':
        return void enviar({ tipo: 'times', nomes: linhasParaLista(lista), quantos });
      case 'iniciativa':
        return void enviar({ tipo: 'iniciativa', entradas: linhasParaIniciativa(lista) });
    }
  }

  const usaLista = sorteio === 'escolha' || sorteio === 'ordem' || sorteio === 'times' || sorteio === 'iniciativa';
  const pronto =
    aba === 'dados'
      ? expressao.trim().length > 0
      : sorteio === 'moeda'
        ? true
        : sorteio === 'numero'
          ? min.trim() !== '' && max.trim() !== ''
          : linhasParaLista(lista).length >= (sorteio === 'iniciativa' ? 1 : 2);

  const NOMES_DOS_SORTEIOS: Record<Sorteio, string> = {
    moeda: t('Cara ou coroa'),
    numero: t('Número'),
    escolha: t('Escolher um'),
    ordem: t('Embaralhar'),
    times: t('Times'),
    iniciativa: t('Iniciativa'),
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dados-dialog" role="dialog" aria-modal="true" aria-labelledby="dados-dialog-title">
        <h2 id="dados-dialog-title">{t('Rolar dados')}</h2>

        <div className="dados-abas" role="tablist">
          {(['dados', 'sorteios'] as Aba[]).map((a) => (
            <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? 'ativa' : ''} onClick={() => setAba(a)}>
              {a === 'dados' ? t('Dados') : t('Sorteios')}
            </button>
          ))}
        </div>

        <div className="dialog-body">
          {aba === 'dados' ? (
            <>
              <label>
                {t('O que rolar')}
                <input
                  autoFocus
                  value={expressao}
                  maxLength={100}
                  placeholder="2d6+3"
                  onChange={(e) => setExpressao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pronto && !busy) {
                      e.preventDefault();
                      void enviar({ tipo: 'dados', expressao: expressaoFinal });
                    }
                  }}
                />
              </label>

              <div className="dados-rapidos" role="group" aria-label={t('Dados')}>
                {DADOS_RAPIDOS.map((f) => (
                  <button key={String(f)} type="button" className="dados-rapido" onClick={() => setExpressao((e) => somarDado(e, f))} aria-label={t('Somar um d{n}', { n: String(f) })}>
                    d{f}
                  </button>
                ))}
                <span className="dados-mod">
                  <button type="button" aria-label={t('Diminuir o modificador')} onClick={() => setExpressao((e) => ajustarModificador(e, -1))}>
                    <Minus size={14} />
                  </button>
                  <span>{t('mod.')}</span>
                  <button type="button" aria-label={t('Aumentar o modificador')} onClick={() => setExpressao((e) => ajustarModificador(e, 1))}>
                    <Plus size={14} />
                  </button>
                </span>
                {expressao && (
                  <button type="button" className="icon-plain" aria-label={t('Limpar')} title={t('Limpar')} onClick={() => setExpressao('')}>
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="dados-modo" role="radiogroup" aria-label={t('Modo')}>
                {(['normal', 'vantagem', 'desvantagem'] as Modo[]).map((m) => (
                  <label key={m} className={modo === m ? 'ativo' : ''}>
                    <input type="radio" name="modo-dado" checked={modo === m} onChange={() => setModo(m)} />
                    {m === 'normal' ? t('Normal') : m === 'vantagem' ? t('Vantagem') : t('Desvantagem')}
                  </label>
                ))}
              </div>

              {atalhos.length > 0 && (
                <div className="dados-atalhos">
                  <span className="poll-dialog-label">{t('Seus atalhos')}</span>
                  <div className="dados-atalhos-lista">
                    {atalhos.map((a) => (
                      <span key={a.id} className="dados-atalho">
                        <button type="button" title={a.expressao} onClick={() => setExpressao(a.expressao)}>
                          {a.nome} <small>{a.expressao}</small>
                        </button>
                        <button type="button" className="icon-plain" aria-label={t('Apagar o atalho {nome}', { nome: a.nome })} onClick={() => void apagarAtalho(a.id)}>
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {nomeDoAtalho === null ? (
                <button type="button" className="link-button dados-guardar" disabled={!expressao.trim()} onClick={() => setNomeDoAtalho('')}>
                  <Save size={14} /> {t('Guardar como atalho')}
                </button>
              ) : (
                <div className="dados-guardar-linha">
                  <input
                    autoFocus
                    value={nomeDoAtalho}
                    maxLength={40}
                    placeholder={t('Nome do atalho (ex.: ataque com a espada)')}
                    onChange={(e) => setNomeDoAtalho(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void guardarAtalho();
                      }
                    }}
                  />
                  <button type="button" className="btn-primary" disabled={!nomeDoAtalho.trim()} onClick={() => void guardarAtalho()}>
                    {t('Guardar')}
                  </button>
                  <button type="button" className="link-button" onClick={() => setNomeDoAtalho(null)}>
                    {t('Cancelar')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="dados-sorteios" role="radiogroup" aria-label={t('Sorteios')}>
                {(Object.keys(NOMES_DOS_SORTEIOS) as Sorteio[]).map((s) => (
                  <label key={s} className={sorteio === s ? 'ativo' : ''}>
                    <input type="radio" name="sorteio" checked={sorteio === s} onChange={() => setSorteio(s)} />
                    {NOMES_DOS_SORTEIOS[s]}
                  </label>
                ))}
              </div>

              {sorteio === 'numero' && (
                <div className="dados-numero">
                  <label>
                    {t('De')}
                    <input type="number" value={min} onChange={(e) => setMin(e.target.value)} />
                  </label>
                  <label>
                    {t('Até')}
                    <input type="number" value={max} onChange={(e) => setMax(e.target.value)} />
                  </label>
                </div>
              )}

              {usaLista && (
                <>
                  <label>
                    {sorteio === 'iniciativa' ? t('Quem entra (um por linha; "Ana +3" soma o modificador)') : sorteio === 'times' ? t('Quem entra (um por linha)') : t('Um por linha')}
                    <textarea value={lista} rows={6} maxLength={4000} onChange={(e) => setLista(e.target.value)} />
                  </label>
                  {pessoas.length > 0 && (
                    <button type="button" className="link-button dados-guardar" onClick={() => setLista(pessoas.join('\n'))}>
                      <Users size={14} /> {t('Trazer quem está na sala de voz ({n})', { n: pessoas.length })}
                    </button>
                  )}
                </>
              )}
              {sorteio === 'times' && (
                <label className="dados-numero">
                  {t('Quantos times')}
                  <input type="number" min={2} max={8} value={quantos} onChange={(e) => setQuantos(Math.min(8, Math.max(2, Number(e.target.value) || 2)))} />
                </label>
              )}
            </>
          )}

          <label>
            {t('Rótulo (opcional)')}
            <input value={rotulo} maxLength={60} placeholder={t('ataque, teste de furtividade…')} onChange={(e) => setRotulo(e.target.value)} />
          </label>
          <label className="poll-dialog-multi">
            <input type="checkbox" checked={secreta} onChange={(e) => setSecreta(e.target.checked)} />
            {t('Rolagem secreta (só você vê, até revelar)')}
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button className="link-button" onClick={onClose}>
            {t('Cancelar')}
          </button>
          <button
            className="btn-primary"
            disabled={!pronto || busy}
            onClick={() => (aba === 'dados' ? void enviar({ tipo: 'dados', expressao: expressaoFinal }) : sortear())}
          >
            <Dices size={16} /> {busy ? t('Rolando…') : aba === 'dados' ? t('Rolar') : t('Sortear')}
          </button>
        </div>
      </div>
    </div>
  );
}
