import { ChevronLeft, ImagePlus, Lock, LockOpen, Medal, Trash2, Trophy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api, API_URL } from './api';
import { idiomaAtual, useT } from './i18n';

/**
 * O BOLÃO DA COMUNIDADE (pedido dele, 14/11/2026, refeito em 15/11 no formato que ele queria; as regras em
 * server/src/bolao-routes.ts): uma PERGUNTA com foto ("quando o fulano chega?"), e cada um dá UM palpite de dia e hora
 * pelo calendário. Os palpites dos outros só aparecem quando fecha; quem criou (ou quem administra) lança a resposta, e
 * ganha quem chegou mais perto. Só pontos, sem dinheiro. Abre por um atalho embaixo do salão, como o calendário.
 */
interface Bolao {
  id: number;
  pergunta: string;
  foto: string | null;
  fechaEm: string | null;
  fechado: boolean;
  resposta: string | null;
  palpites: number;
  aberto: boolean;
}
interface Palpite {
  userId: number;
  nome: string;
  quando: string;
  diferencaMs?: number;
  /** Com a resposta: quem chegou mais perto (os empatados na menor distância também). */
  ganhou?: boolean;
}
interface Detalhe {
  bolao: Bolao;
  meu: string | null;
  palpites: Palpite[] | null;
  podeEditar: boolean;
}

/** O teto do servidor para a foto (4 MB), e o maior lado depois de reduzida. */
const FOTO_MAXIMA = 4 * 1024 * 1024;
const LADO_MAXIMO = 1600;

const enderecoDaFoto = (b: Pick<Bolao, 'id' | 'foto'>) => `${API_URL}/api/boloes/${b.id}/foto/${b.foto}`;
const doisDigitos = (n: number) => String(n).padStart(2, '0');
/** Uma data ISO no formato do campo datetime-local (a hora do computador de quem vê). */
const paraOCampo = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
};
/** O valor do campo datetime-local virando ISO, ou null se vazio ou torto. */
const doCampo = (valor: string) => {
  const ms = valor ? new Date(valor).getTime() : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

const comoDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
    leitor.readAsDataURL(blob);
  });

/** A foto escolhida, pronta para subir: inteira, reduzida até 1600 px no lado maior, em WEBP. O GIF passa como veio. */
async function prepararFoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.type === 'image/gif') {
    if (file.size > FOTO_MAXIMA) throw new Error('Cada arquivo pode ter até 4 MB.');
    return comoDataUrl(file);
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível abrir essa imagem.');
  });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob) throw new Error('Não foi possível processar essa imagem.');
  if (blob.size > FOTO_MAXIMA) throw new Error('Cada arquivo pode ter até 4 MB.');
  return comoDataUrl(blob);
}

/** "+30 min", "−2 h", "+3 d": a distância do palpite à resposta, sem texto para traduzir (as unidades vêm do Intl). */
function distancia(ms: number, idioma: string) {
  const abs = Math.abs(ms);
  const minutos = Math.round(abs / 60000);
  const [valor, unidade] =
    minutos < 60 ? [minutos, 'minute'] : minutos < 48 * 60 ? [Math.round((minutos / 60) * 10) / 10, 'hour'] : [Math.round((minutos / 1440) * 10) / 10, 'day'];
  const texto = new Intl.NumberFormat(idioma, { style: 'unit', unit: unidade, unitDisplay: 'short', maximumFractionDigits: 1 }).format(valor);
  return minutos === 0 ? '0' : `${ms > 0 ? '+' : '−'}${texto}`;
}

export function Bolao({
  communityId,
  socket,
  inicial = null,
  aoFechar,
  aoVoltar,
}: {
  communityId: number;
  socket?: Socket | null;
  /** Abrir já num bolão (vindo do calendário). */
  inicial?: number | null;
  aoFechar: () => void;
  /** Vindo do calendário, o "voltar" (e o Esc) do bolão aberto volta ao calendário, e não à lista de bolões. */
  aoVoltar?: () => void;
}) {
  const t = useT();
  const idioma = idiomaAtual();
  const fmt = new Intl.DateTimeFormat(idioma, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const quando = (iso: string) => fmt.format(new Date(iso));
  const [boloes, setBoloes] = useState<Bolao[] | null>(null);
  const [aberto, setAberto] = useState<number | null>(inicial);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

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

  // alguém criou, palpitou pela primeira vez, fechou ou lançou a resposta: relê
  useEffect(() => {
    if (!socket) return;
    const mudou = (d: { communityId: number }) => d.communityId === communityId && setVersao((v) => v + 1);
    socket.on('bolao:mudou', mudou);
    return () => {
      socket.off('bolao:mudou', mudou);
    };
  }, [socket, communityId]);

  // a hora de fechar passou com a janela aberta: relê, para os palpites aparecerem
  useEffect(() => {
    const fecha = detalhe?.bolao.aberto && detalhe.bolao.fechaEm ? Date.parse(detalhe.bolao.fechaEm) - Date.now() : null;
    if (fecha === null || fecha > 24 * 60 * 60 * 1000) return;
    const id = window.setTimeout(() => setVersao((v) => v + 1), Math.max(0, fecha) + 500);
    return () => window.clearTimeout(id);
  }, [detalhe]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      voltar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  /** Do bolão aberto: ao calendário, se veio dele, senão à lista; da lista, fecha. */
  function voltar() {
    if (aberto === null) aoFechar();
    else if (aoVoltar && aberto === inicial) aoVoltar();
    else setAberto(null);
  }

  async function chamar(caminho: string, metodo: string, corpo?: unknown) {
    setErro(null);
    try {
      const r = await api(`/api/communities/${communityId}/boloes${caminho}`, { method: metodo, body: corpo });
      setVersao((v) => v + 1);
      return r ?? true;
    } catch (e) {
      setErro((e as Error).message);
      return null;
    }
  }

  const estado = (b: Bolao) =>
    b.resposta
      ? t('Resposta: {quando}', { quando: quando(b.resposta) })
      : b.aberto
        ? b.fechaEm
          ? t('Fecha em {quando}', { quando: quando(b.fechaEm) })
          : t('Aberto')
        : t('Fechado');

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog calendario bolao" role="dialog" aria-modal="true" aria-labelledby="bolao-titulo">
        <div className="calendario-topo">
          <h2 id="bolao-titulo">
            {aberto !== null && (
              <button type="button" className="icon-plain" onClick={voltar} aria-label={t('Voltar')} title={t('Voltar')}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            )}
            <Medal size={18} aria-hidden="true" /> {t('Bolão')}
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
                  <button type="button" className="bolao-abrir" onClick={() => setAberto(b.id)}>
                    {b.foto && <img className="bolao-miniatura" src={enderecoDaFoto(b)} alt="" loading="lazy" />}
                    <span className="bolao-item-texto">
                      <span className="calendario-nome">{b.pergunta}</span>
                      <span className="calendario-quando">
                        {estado(b)} · {t('Palpites: {n}', { n: b.palpites })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <NovoBolao
              aoCriar={async (corpo) => {
                const novo = (await chamar('', 'POST', corpo)) as Bolao | null;
                if (novo) setAberto(novo.id);
                return !!novo;
              }}
              aoErrar={setErro}
            />
          </>
        ) : !detalhe ? null : (
          <UmBolao
            key={detalhe.bolao.id}
            detalhe={detalhe}
            estado={estado(detalhe.bolao)}
            quando={quando}
            idioma={idioma}
            chamar={(caminho, metodo, corpo) => chamar(`/${detalhe.bolao.id}${caminho}`, metodo, corpo)}
            aoApagar={() => setAberto(null)}
          />
        )}
        {erro && <span className="form-error small">{erro}</span>}
      </div>
    </div>
  );
}

function UmBolao({
  detalhe,
  estado,
  quando,
  idioma,
  chamar,
  aoApagar,
}: {
  detalhe: Detalhe;
  estado: string;
  quando: (iso: string) => string;
  idioma: string;
  chamar: (caminho: string, metodo: string, corpo?: unknown) => Promise<unknown>;
  aoApagar: () => void;
}) {
  const t = useT();
  const { bolao, meu, palpites, podeEditar } = detalhe;
  const ganhadores = palpites?.filter((p) => p.ganhou) ?? [];
  const [palpite, setPalpite] = useState(meu ? paraOCampo(meu) : '');
  const [resposta, setResposta] = useState(bolao.resposta ? paraOCampo(bolao.resposta) : '');
  const [salvo, setSalvo] = useState(false);
  useEffect(() => setResposta(bolao.resposta ? paraOCampo(bolao.resposta) : ''), [bolao.resposta]);

  async function palpitar(e: React.FormEvent) {
    e.preventDefault();
    const iso = doCampo(palpite);
    if (iso && (await chamar('/palpite', 'PUT', { quando: iso }))) {
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 1500);
    }
  }

  return (
    <div className="bolao-um">
      {bolao.foto && <img className="bolao-foto" src={enderecoDaFoto(bolao)} alt="" />}
      <h3 className="bolao-pergunta">{bolao.pergunta}</h3>
      <span className="calendario-quando">
        {estado} · {t('Palpites: {n}', { n: bolao.palpites })}
      </span>

      {bolao.aberto ? (
        <form className="bolao-palpitar" onSubmit={(e) => void palpitar(e)}>
          <label>
            <strong>{t('Seu palpite')}</strong>
            <input type="datetime-local" value={palpite} onChange={(e) => setPalpite(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary" disabled={!doCampo(palpite)}>
            {salvo ? '✓' : t('Palpitar')}
          </button>
          <span className="bolao-regra">
            {meu ? t('Seu palpite está salvo. Dá para mudar até fechar.') : t('Os palpites dos outros aparecem quando fechar.')}{' '}
            {t('Ganha quem chegar mais perto. Só pontos, sem dinheiro.')}
          </span>
        </form>
      ) : (
        <>
        {/* os ganhadores em destaque, logo abaixo da pergunta (pedido dele: "abrir a imagem, os palpites e os ganhadores") */}
        {!!ganhadores.length && (
          <div className="bolao-ganhadores">
            <Trophy size={18} aria-hidden="true" />
            <strong>{t('Quem ganhou: {nomes}', { nomes: ganhadores.map((p) => p.nome).join(', ') })}</strong>
          </div>
        )}
        <ol className="calendario-lista bolao-ranking">
          {!palpites?.length && <li className="calendario-vazio">{t('Ninguém palpitou.')}</li>}
          {palpites?.map((p, i) => (
            <li key={p.userId} className={p.ganhou ? 'bolao-ganhou' : undefined}>
              {bolao.resposta && (
                <span className="bolao-posicao">{p.ganhou ? <Trophy size={15} aria-hidden="true" /> : `${i + 1}º`}</span>
              )}
              <span className="calendario-nome">{p.nome}</span>
              <span className="calendario-quando">{quando(p.quando)}</span>
              {p.diferencaMs !== undefined && <strong className="bolao-distancia">{distancia(p.diferencaMs, idioma)}</strong>}
            </li>
          ))}
        </ol>
        </>
      )}

      {podeEditar && (
        <div className="bolao-cuidar">
          <form
            className="bolao-palpitar"
            onSubmit={(e) => {
              e.preventDefault();
              const iso = doCampo(resposta);
              if (iso) void chamar('/resposta', 'PUT', { resposta: iso });
            }}
          >
            <label>
              <strong>{t('Resposta certa')}</strong>
              <input type="datetime-local" value={resposta} onChange={(e) => setResposta(e.target.value)} required />
            </label>
            <button type="submit" className="btn-primary" disabled={!doCampo(resposta) || doCampo(resposta) === bolao.resposta}>
              {t('Lançar resposta')}
            </button>
          </form>
          <div className="bolao-acoes">
            {!bolao.resposta && (
              <button type="button" className="link-button" onClick={() => void chamar('/fechado', 'PUT', { fechado: bolao.aberto })}>
                {bolao.aberto ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}{' '}
                {bolao.aberto ? t('Fechar palpites') : t('Reabrir palpites')}
              </button>
            )}
            <button
              type="button"
              className="bolao-apagar"
              onClick={() => {
                if (confirm(t('Apagar este bolão, com os palpites?'))) void chamar('', 'DELETE').then((r) => r && aoApagar());
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> {t('Apagar bolão')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NovoBolao({ aoCriar, aoErrar }: { aoCriar: (corpo: { pergunta: string; fechaEm: string | null; imagem: string | null }) => Promise<boolean>; aoErrar: (erro: string) => void }) {
  const t = useT();
  const [pergunta, setPergunta] = useState('');
  const [fechaEm, setFechaEm] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function escolher(file: File | undefined) {
    if (!file) return;
    try {
      setImagem(await prepararFoto(file));
    } catch (e) {
      aoErrar((e as Error).message);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const ok = await aoCriar({ pergunta, fechaEm: doCampo(fechaEm), imagem });
    setEnviando(false);
    if (ok) {
      setPergunta('');
      setFechaEm('');
      setImagem(null);
    }
  }

  return (
    <form className="calendario-novo bolao-novo" onSubmit={(e) => void criar(e)}>
      <strong>{t('Novo bolão')}</strong>
      {imagem ? (
        <div className="bolao-previa">
          <img src={imagem} alt="" />
          <button type="button" className="link-button" onClick={() => setImagem(null)}>
            {t('Tirar a foto')}
          </button>
        </div>
      ) : (
        <button type="button" className="bolao-escolher-foto" onClick={() => arquivo.current?.click()}>
          <ImagePlus size={18} aria-hidden="true" /> {t('Adicionar foto')}
        </button>
      )}
      <input ref={arquivo} type="file" accept="image/*" hidden onChange={(e) => void escolher(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <input
        value={pergunta}
        maxLength={200}
        onChange={(e) => setPergunta(e.target.value)}
        placeholder={t('Qual é a pergunta?')}
        aria-label={t('Qual é a pergunta?')}
        required
      />
      <label className="bolao-fecha">
        <span>{t('Palpites até (opcional)')}</span>
        <input type="datetime-local" value={fechaEm} onChange={(e) => setFechaEm(e.target.value)} />
      </label>
      <button type="submit" className="btn-primary" disabled={!pergunta.trim() || enviando}>
        {t('Criar')}
      </button>
    </form>
  );
}
