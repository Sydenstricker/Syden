import { ChevronLeft, Medal, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { idiomaAtual, useT } from './i18n';

/**
 * O BOLÃO DA COMUNIDADE (pedido dele, 14/11/2026; as regras em server/src/bolao-routes.ts). Só pontos, sem dinheiro.
 * Qualquer membro cria um bolão; quem o criou e quem administra cadastram os jogos e lançam o placar. Cada um palpita até
 * a hora do jogo, e os palpites dos outros só aparecem depois dela. Abre por um atalho embaixo do salão, como o calendário.
 */
interface Bolao {
  id: number;
  titulo: string;
  jogos: number;
}
interface Palpite {
  userId: number;
  nome: string;
  golsCasa: number;
  golsFora: number;
  pontos: number | null;
}
interface Jogo {
  id: number;
  casa: string;
  fora: string;
  quando: string;
  golsCasa: number | null;
  golsFora: number | null;
  comecou: boolean;
  meu: { golsCasa: number; golsFora: number; pontos: number | null } | null;
  palpites: Palpite[] | null;
  quantosPalpitaram: number;
}
interface Detalhe {
  bolao: Bolao;
  jogos: Jogo[];
  ranking: { userId: number; nome: string; pontos: number; exatos: number }[];
  podeEditar: boolean;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const primeiraMaiuscula = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
/** O número de um campo de gols: vazio é "não preenchido". */
const numero = (s: string) => (s.trim() === '' ? null : Number(s));

export function Bolao({ communityId, socket, aoFechar }: { communityId: number; socket?: Socket | null; aoFechar: () => void }) {
  const t = useT();
  const [boloes, setBoloes] = useState<Bolao[] | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [aba, setAba] = useState<'jogos' | 'classificacao'>('jogos');
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [titulo, setTitulo] = useState('');

  useEffect(() => {
    let vivo = true;
    api<{ boloes: Bolao[] }>(`/api/communities/${communityId}/boloes`)
      .then((r) => vivo && setBoloes(r.boloes))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
  }, [communityId, versao]);

  useEffect(() => {
    if (aberto === null) return setDetalhe(null);
    let vivo = true;
    api<Detalhe>(`/api/communities/${communityId}/boloes/${aberto}`)
      .then((r) => vivo && setDetalhe(r))
      .catch((e) => {
        if (!vivo) return;
        setErro((e as Error).message);
        setAberto(null);
      });
    return () => {
      vivo = false;
    };
  }, [communityId, aberto, versao]);

  // alguém criou um bolão, um jogo ou lançou um placar: relê
  useEffect(() => {
    if (!socket) return;
    const mudou = (d: { communityId: number }) => d.communityId === communityId && setVersao((v) => v + 1);
    socket.on('bolao:mudou', mudou);
    return () => {
      socket.off('bolao:mudou', mudou);
    };
  }, [socket, communityId]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (aberto !== null) setAberto(null);
      else aoFechar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar, aberto]);

  async function chamar(caminho: string, metodo: string, corpo?: unknown) {
    setErro(null);
    try {
      const r = await api(`/api/communities/${communityId}/boloes${caminho}`, { method: metodo, body: corpo });
      setVersao((v) => v + 1);
      return r;
    } catch (e) {
      setErro((e as Error).message);
      return null;
    }
  }

  async function criarBolao(e: React.FormEvent) {
    e.preventDefault();
    const novo = (await chamar('', 'POST', { titulo })) as Bolao | null;
    if (novo) {
      setTitulo('');
      setAba('jogos');
      setAberto(novo.id);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog calendario bolao" role="dialog" aria-modal="true" aria-labelledby="bolao-titulo">
        <div className="calendario-topo">
          <h2 id="bolao-titulo">
            {aberto !== null && (
              <button type="button" className="icon-plain" onClick={() => setAberto(null)} aria-label={t('Voltar')} title={t('Voltar')}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            )}
            <Medal size={18} aria-hidden="true" /> {aberto !== null && detalhe ? detalhe.bolao.titulo : t('Bolão')}
          </h2>
          <button type="button" className="icon-plain" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {aberto === null ? (
          <>
            <ul className="calendario-lista">
              {boloes && boloes.length === 0 && <li className="calendario-vazio">{t('Nenhum bolão ainda.')}</li>}
              {boloes?.map((b) => (
                <li key={b.id} className="bolao-item">
                  <button
                    type="button"
                    className="bolao-abrir"
                    onClick={() => {
                      setAba('jogos');
                      setAberto(b.id);
                    }}
                  >
                    <span className="calendario-nome">{b.titulo}</span>
                    <span className="calendario-quando">{t('Jogos: {n}', { n: b.jogos })}</span>
                  </button>
                </li>
              ))}
            </ul>
            <form className="calendario-novo" onSubmit={(e) => void criarBolao(e)}>
              <strong>{t('Novo bolão')}</strong>
              <div className="calendario-novo-linha">
                <input value={titulo} maxLength={60} onChange={(e) => setTitulo(e.target.value)} placeholder={t('Nome do bolão')} aria-label={t('Nome do bolão')} required />
                <button type="submit" className="btn-primary" disabled={!titulo.trim()}>
                  {t('Criar')}
                </button>
              </div>
              <span className="bolao-regra">{t('Só pontos: placar exato vale 10, o vencedor com o saldo certo 5, e só o vencedor 3.')}</span>
            </form>
          </>
        ) : !detalhe ? null : (
          <>
            <div className="bolao-abas" role="tablist">
              <button type="button" role="tab" aria-selected={aba === 'jogos'} className={aba === 'jogos' ? 'ativa' : ''} onClick={() => setAba('jogos')}>
                {t('Jogos')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={aba === 'classificacao'}
                className={aba === 'classificacao' ? 'ativa' : ''}
                onClick={() => setAba('classificacao')}
              >
                {t('Classificação')}
              </button>
            </div>

            {aba === 'jogos' ? (
              <>
                <ul className="calendario-lista">
                  {detalhe.jogos.length === 0 && <li className="calendario-vazio">{t('Nenhum jogo ainda.')}</li>}
                  {detalhe.jogos.map((j) => (
                    <JogoDoBolao key={j.id} jogo={j} podeEditar={detalhe.podeEditar} chamar={(c, m, corpo) => chamar(`/${aberto}/jogos/${j.id}${c}`, m, corpo)} />
                  ))}
                </ul>
                {detalhe.podeEditar && <NovoJogo aoCriar={(corpo) => chamar(`/${aberto}/jogos`, 'POST', corpo)} />}
                {detalhe.podeEditar && (
                  <button
                    type="button"
                    className="bolao-apagar"
                    onClick={() => {
                      if (confirm(t('Apagar este bolão, com os jogos e os palpites?'))) void chamar(`/${aberto}`, 'DELETE').then((r) => r && setAberto(null));
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" /> {t('Apagar bolão')}
                  </button>
                )}
              </>
            ) : (
              <ol className="calendario-lista bolao-ranking">
                {detalhe.ranking.length === 0 && <li className="calendario-vazio">{t('A classificação aparece quando sair o primeiro placar.')}</li>}
                {detalhe.ranking.map((r, i) => (
                  <li key={r.userId}>
                    <span className="bolao-posicao">{i + 1}º</span>
                    <span className="calendario-nome">{r.nome}</span>
                    <span className="calendario-quando">{t('Exatos: {n}', { n: r.exatos })}</span>
                    <strong>{t('{n} pts', { n: r.pontos })}</strong>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        {erro && <span className="form-error small">{erro}</span>}
      </div>
    </div>
  );
}

function JogoDoBolao({
  jogo,
  podeEditar,
  chamar,
}: {
  jogo: Jogo;
  podeEditar: boolean;
  chamar: (caminho: string, metodo: string, corpo?: unknown) => Promise<unknown>;
}) {
  const t = useT();
  const idioma = idiomaAtual();
  const quando = new Date(jogo.quando);
  const fmt = new Intl.DateTimeFormat(idioma, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  // o campo começa no palpite (antes) ou no placar (depois, para quem lança)
  const inicial = jogo.comecou ? (jogo.golsCasa !== null ? jogo : null) : jogo.meu;
  const [casa, setCasa] = useState(inicial ? String(inicial.golsCasa) : '');
  const [fora, setFora] = useState(inicial ? String(inicial.golsFora) : '');
  const [salvo, setSalvo] = useState(false);
  const [verPalpites, setVerPalpites] = useState(false);
  useEffect(() => {
    setCasa(inicial ? String(inicial.golsCasa) : '');
    setFora(inicial ? String(inicial.golsFora) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogo.comecou, jogo.golsCasa, jogo.golsFora, jogo.meu?.golsCasa, jogo.meu?.golsFora]);

  const editavel = !jogo.comecou || podeEditar;
  const c = numero(casa), f = numero(fora);
  const valido = c !== null && f !== null && Number.isInteger(c) && Number.isInteger(f) && c >= 0 && f >= 0 && c <= 99 && f <= 99;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    const r = await chamar(jogo.comecou ? '/resultado' : '/palpite', 'PUT', { golsCasa: c, golsFora: f });
    if (r) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1500);
    }
  }

  const campo = (valor: string, mudar: (v: string) => void, rotulo: string) =>
    editavel ? (
      <input
        className="bolao-gols"
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        aria-label={rotulo}
      />
    ) : (
      <span className="bolao-gols">{valor === '' ? '–' : valor}</span>
    );

  return (
    <li className="bolao-jogo">
      <div className="bolao-jogo-topo">
        <span className="calendario-quando">{primeiraMaiuscula(fmt.format(quando))}</span>
        {podeEditar && (
          <button
            type="button"
            className="icon-plain expression-delete"
            onClick={() => confirm(t('Apagar este jogo?')) && void chamar('', 'DELETE')}
            aria-label={t('Apagar jogo')}
            title={t('Apagar jogo')}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      <form className="bolao-placar" onSubmit={(e) => void salvar(e)}>
        <span className="bolao-time casa">{jogo.casa}</span>
        {campo(casa, setCasa, t('Gols de {time}', { time: jogo.casa }))}
        <span aria-hidden="true">×</span>
        {campo(fora, setFora, t('Gols de {time}', { time: jogo.fora }))}
        <span className="bolao-time">{jogo.fora}</span>
        {editavel && (
          <button type="submit" className="btn-primary bolao-salvar" disabled={!valido}>
            {salvo ? '✓' : jogo.comecou ? t('Lançar placar') : t('Palpitar')}
          </button>
        )}
      </form>
      <div className="bolao-jogo-rodape">
        {!jogo.comecou ? (
          <span>{jogo.meu ? t('Seu palpite está salvo. Dá para mudar até a hora do jogo.') : t('Palpites: {n}', { n: jogo.quantosPalpitaram })}</span>
        ) : (
          <>
            {jogo.meu ? (
              <span>
                {t('Seu palpite: {casa} × {fora}', { casa: jogo.meu.golsCasa, fora: jogo.meu.golsFora })}
                {jogo.meu.pontos !== null && <strong> · +{jogo.meu.pontos}</strong>}
              </span>
            ) : (
              <span>{jogo.golsCasa === null ? t('Aguardando o placar.') : t('Sem palpite.')}</span>
            )}
            {!!jogo.palpites?.length && (
              <button type="button" className="link-button" onClick={() => setVerPalpites((v) => !v)} aria-expanded={verPalpites}>
                {t('Palpites: {n}', { n: jogo.palpites.length })}
              </button>
            )}
          </>
        )}
      </div>
      {verPalpites && jogo.palpites && (
        <ul className="bolao-palpites">
          {jogo.palpites.map((p) => (
            <li key={p.userId}>
              <span className="calendario-nome">{p.nome}</span>
              <span>
                {p.golsCasa} × {p.golsFora}
              </span>
              {p.pontos !== null && <strong>+{p.pontos}</strong>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NovoJogo({ aoCriar }: { aoCriar: (corpo: { casa: string; fora: string; quando: string }) => Promise<unknown> }) {
  const t = useT();
  const hoje = new Date();
  const [casa, setCasa] = useState('');
  const [fora, setFora] = useState('');
  const [data, setData] = useState(() => `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`);
  const [hora, setHora] = useState('21:30');

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const [a, m, d] = data.split('-').map(Number), [hh, mm] = hora.split(':').map(Number);
    const r = await aoCriar({ casa, fora, quando: new Date(a, m - 1, d, hh || 0, mm || 0).toISOString() });
    if (r) {
      setCasa('');
      setFora('');
    }
  }

  return (
    <form className="calendario-novo" onSubmit={(e) => void criar(e)}>
      <strong>{t('Novo jogo')}</strong>
      <div className="calendario-novo-linha">
        <input value={casa} maxLength={40} onChange={(e) => setCasa(e.target.value)} placeholder={t('Mandante')} aria-label={t('Mandante')} required />
        <input value={fora} maxLength={40} onChange={(e) => setFora(e.target.value)} placeholder={t('Visitante')} aria-label={t('Visitante')} required />
      </div>
      <div className="calendario-novo-linha">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label={t('Data')} required />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label={t('Hora')} required />
        <button type="submit" className="btn-primary" disabled={!casa.trim() || !fora.trim()}>
          {t('Criar')}
        </button>
      </div>
    </form>
  );
}
