import { Music, Play, Plus, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, mediaUrl } from './api';
import { lerLetra, letraSemTempo, type LinhaDaLetra, linhaAtual, relogio } from './lrc';
import { getSettings } from './settings';
import type { KaraokeSong } from './types';
import { readAsDataUrl } from './upload';
import type { Voice } from './useVoice';

// Karaokê da sala. A música NÃO passa pela chamada: quem aperta "cantar" manda um aviso, e o
// computador de cada um toca a própria cópia do arquivo. Isso mantém a qualidade (a chamada é feita
// para voz, não para música), não gasta a internet de quem pôs a música, e faz a letra andar no tempo
// certo na tela de cada pessoa — cada um acompanha o próprio áudio.

const LIMITE_MB = 12;

function ListaDeMusicas({
  musicas,
  tocando,
  onCantar,
  onApagar,
}: {
  musicas: KaraokeSong[];
  tocando: number | null;
  onCantar: (song: KaraokeSong) => void;
  onApagar: (song: KaraokeSong) => void;
}) {
  if (musicas.length === 0) {
    return <p className="settings-hint">Nenhuma música ainda. Suba um arquivo que você tenha aí para a turma cantar.</p>;
  }
  return (
    <ul className="karaoke-lista">
      {musicas.map((song) => (
        <li key={song.id} className={song.id === tocando ? 'tocando' : undefined}>
          <button className="karaoke-tocar" onClick={() => onCantar(song)} title={`Cantar ${song.title}`}>
            <Play size={14} />
            <span className="karaoke-titulo">{song.title}</span>
            {song.artist && <span className="karaoke-artista">{song.artist}</span>}
            {song.lyrics ? <span className="karaoke-tem-letra">com letra</span> : <span className="karaoke-sem-letra">sem letra</span>}
          </button>
          <button className="icon-plain" title={`Apagar ${song.title}`} aria-label={`Apagar ${song.title}`} onClick={() => onApagar(song)}>
            <Trash2 size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A letra rolando, com a linha do momento acesa. */
function Letra({ linhas, soltas, segundos }: { linhas: LinhaDaLetra[]; soltas: string[]; segundos: number }) {
  const atual = linhaAtual(linhas, segundos);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const aceso = ref.current?.querySelector('.karaoke-linha.agora');
    aceso?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [atual]);

  if (linhas.length === 0) {
    return (
      <div className="karaoke-letra" ref={ref}>
        {soltas.length === 0 ? (
          <p className="settings-hint">Esta música não tem letra. Dá para subir de novo com um arquivo .lrc junto.</p>
        ) : (
          soltas.map((linha, i) => (
            <p key={i} className="karaoke-linha">
              {linha}
            </p>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="karaoke-letra" ref={ref}>
      {linhas.map((linha, i) => (
        <p key={`${linha.em}-${i}`} className={`karaoke-linha${i === atual ? ' agora' : ''}${i < atual ? ' passou' : ''}`}>
          {linha.texto || '♪'}
        </p>
      ))}
    </div>
  );
}

function Subir({ communityId, onPronto }: { communityId: number; onPronto: (song: KaraokeSong) => void }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audio, setAudio] = useState<{ data: string; segundos: number; nome: string } | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolherAudio(arquivo: File) {
    setErro(null);
    if (arquivo.size > LIMITE_MB * 1024 * 1024) return setErro(`O arquivo passa de ${LIMITE_MB} MB.`);
    try {
      const data = await readAsDataUrl(arquivo);
      // A duração vem do próprio arquivo, para a lista poder mostrá-la sem baixar tudo de novo.
      const segundos = await new Promise<number>((pronto) => {
        const a = new Audio(URL.createObjectURL(arquivo));
        a.onloadedmetadata = () => pronto(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
        a.onerror = () => pronto(0);
      });
      setAudio({ data, segundos, nome: arquivo.name });
      if (!title) setTitle(arquivo.name.replace(/\.[^.]+$/, '').slice(0, 80));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function subir() {
    if (!audio) return;
    setBusy(true);
    setErro(null);
    try {
      onPronto(
        await api<KaraokeSong>(`/api/communities/${communityId}/karaoke`, {
          method: 'POST',
          body: { title, artist, audio: audio.data, lyrics, seconds: audio.segundos },
        }),
      );
    } catch (e) {
      setErro((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="karaoke-subir">
      <label className="file-picker btn-secondary">
        <Upload size={15} /> {audio ? audio.nome : 'Escolher a música'}
        <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && void escolherAudio(e.target.files[0])} />
      </label>
      <label className="settings-field">
        Nome
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="ex.: Evidências" />
      </label>
      <label className="settings-field">
        Quem canta
        <input value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={80} placeholder="opcional" />
      </label>
      <label className="file-picker btn-secondary">
        <Plus size={15} /> {lyrics ? 'Trocar a letra' : 'Letra (.lrc ou .txt)'}
        <input
          type="file"
          accept=".lrc,.txt,text/plain"
          hidden
          onChange={async (e) => e.target.files?.[0] && setLyrics(await e.target.files[0].text())}
        />
      </label>
      <p className="settings-hint">
        Suba músicas que você já tem. Um arquivo <code>.lrc</code> faz a letra acender sozinha no tempo certo; um{' '}
        <code>.txt</code> comum mostra a letra parada, para acompanhar.
      </p>
      {erro && <p className="form-error">{erro}</p>}
      <button className="btn-primary" disabled={busy || !audio || title.trim().length < 2} onClick={() => void subir()}>
        {busy ? 'Subindo…' : 'Guardar na comunidade'}
      </button>
    </div>
  );
}

export function Karaoke({ voice, communityId, onClose }: { voice: Voice; communityId: number; onClose: () => void }) {
  const [musicas, setMusicas] = useState<KaraokeSong[] | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api<KaraokeSong[]>(`/api/communities/${communityId}/karaoke`).then(setMusicas, (e) => setErro((e as Error).message));
  }, [communityId]);

  const emCartaz = voice.karaoke;
  const song = emCartaz ? musicas?.find((m) => m.id === emCartaz.songId) : undefined;

  // Toca (ou para) conforme o aviso que chegou na sala.
  useEffect(() => {
    const anterior = audioRef.current;
    if (anterior) {
      anterior.pause();
      audioRef.current = null;
    }
    setSegundos(0);
    if (!emCartaz) return;

    const audio = new Audio(mediaUrl.karaoke(emCartaz.songId));
    audioRef.current = audio;
    audio.volume = getSettings().soundboardVolume;
    const saida = getSettings().audioOutput;
    if (saida && 'setSinkId' in audio) {
      void (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(saida).catch(() => {});
    }
    audio.addEventListener('loadedmetadata', () => {
      // Quem demorou a carregar entra adiantado, para a sala inteira estar no mesmo ponto da música.
      const atraso = (Date.now() - emCartaz.comecouEm) / 1000;
      if (atraso > 0.3 && atraso < (audio.duration || Infinity)) audio.currentTime = atraso;
      void audio.play().catch(() => {});
    });
    const relogioTimer = setInterval(() => setSegundos(audio.currentTime), 120);

    return () => {
      clearInterval(relogioTimer);
      audio.pause();
    };
  }, [emCartaz]);

  // Quem está surdo não ouve o karaokê, como não ouve o soundboard.
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = voice.deafened;
  }, [voice.deafened]);

  async function apagar(alvo: KaraokeSong) {
    try {
      await api(`/api/karaoke/${alvo.id}`, { method: 'DELETE' });
      setMusicas((lista) => (lista ?? []).filter((m) => m.id !== alvo.id));
      if (emCartaz?.songId === alvo.id) void voice.comandarKaraoke(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const linhas = song ? lerLetra(song.lyrics) : [];
  const soltas = song ? letraSemTempo(song.lyrics) : [];

  return (
    <div className="karaoke" role="dialog" aria-label="Karaokê">
      <header className="karaoke-topo">
        <h3>
          <Music size={17} /> Karaokê
        </h3>
        <div className="karaoke-topo-acoes">
          {!emCartaz && (
            <button className="link-button" onClick={() => setSubindo(!subindo)}>
              {subindo ? 'Cancelar' : 'Subir música'}
            </button>
          )}
          <button className="icon-plain" aria-label="Fechar o karaokê" onClick={onClose}>
            ✕
          </button>
        </div>
      </header>

      {erro && <p className="form-error">{erro}</p>}

      {emCartaz ? (
        <>
          <div className="karaoke-agora">
            <div>
              <strong>{song?.title ?? 'Carregando…'}</strong>
              {song?.artist && <span className="karaoke-artista"> · {song.artist}</span>}
              <span className="settings-hint"> · posto por {emCartaz.quem}</span>
            </div>
            <div className="karaoke-tempo">
              {relogio(segundos)}
              {song?.seconds ? ` / ${relogio(song.seconds)}` : ''}
            </div>
            <button className="btn-secondary" onClick={() => void voice.comandarKaraoke(null)}>
              <Square size={14} /> Parar
            </button>
          </div>
          <Letra linhas={linhas} soltas={soltas} segundos={segundos} />
        </>
      ) : subindo ? (
        <Subir
          communityId={communityId}
          onPronto={(nova) => {
            setMusicas((lista) => [...(lista ?? []), nova].sort((a, b) => a.title.localeCompare(b.title)));
            setSubindo(false);
          }}
        />
      ) : (
        <ListaDeMusicas
          musicas={musicas ?? []}
          tocando={null}
          onCantar={(alvo) => void voice.comandarKaraoke(alvo.id)}
          onApagar={(alvo) => void apagar(alvo)}
        />
      )}
    </div>
  );
}
