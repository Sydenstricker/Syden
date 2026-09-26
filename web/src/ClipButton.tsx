import { Download, Scissors, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { type Clipe, corrigirDuracao, type GravacaoEmRolagem, gravarEmRolagem, nomeDoClipe, SEGUNDOS_DO_CLIPE } from './clips';
import { IconButton } from './IconButton';
import type { Channel } from './types';
import { formatBytes, readAsDataUrl } from './upload';

// O botão de clipe e a janelinha que abre depois dele. A gravação em si mora em clips.ts; aqui é só a
// parte que a pessoa vê: um botão que fica aceso enquanto há o que clipar, e uma prévia com dois
// caminhos — guardar no computador ou mandar na conversa.

/** O limite de um arquivo no chat; acima disso o clipe só pode ser baixado. */
const LIMITE_DO_CHAT = 8 * 1024 * 1024;

function Previa({
  blob,
  segundos,
  de,
  canais,
  onFechar,
}: {
  blob: Blob;
  segundos: number;
  de: string;
  canais: Channel[];
  onFechar: () => void;
}) {
  const [canalId, setCanalId] = useState(canais[0]?.id ?? 0);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const url = useRef(URL.createObjectURL(blob));

  useEffect(() => {
    const atual = url.current;
    return () => URL.revokeObjectURL(atual);
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const cabeNoChat = blob.size <= LIMITE_DO_CHAT;
  const nome = nomeDoClipe(de);

  function baixar() {
    const link = document.createElement('a');
    link.href = url.current;
    link.download = nome;
    link.click();
  }

  async function mandar() {
    setEnviando(true);
    setErro(null);
    try {
      const data = await readAsDataUrl(blob);
      await api(`/api/channels/${canalId}/messages`, {
        method: 'POST',
        body: { content: `Clipe de ${de}`, files: [{ name: nome, data, width: null, height: null }] },
      });
      setPronto(true);
      setTimeout(onFechar, 1200);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onFechar}>
      <div className="dialog clipe-dialog" role="dialog" aria-label="Clipe" onClick={(e) => e.stopPropagation()}>
        <h2>
          <Scissors size={18} /> Últimos {segundos} segundos
        </h2>
        <video
          className="clipe-video"
          src={url.current}
          controls
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => corrigirDuracao(e.currentTarget)}
        />
        <p className="settings-hint">
          {formatBytes(blob.size)} · de {de}
          {!cabeNoChat && ' · grande demais para o chat, mas dá para guardar no computador'}
        </p>

        {canais.length > 0 && cabeNoChat && (
          <label className="settings-field">
            Mandar em
            <select value={canalId} onChange={(e) => setCanalId(Number(e.target.value))}>
              {canais.map((canal) => (
                <option key={canal.id} value={canal.id}>
                  #{canal.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {erro && <p className="form-error">{erro}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onFechar}>
            <X size={15} /> Descartar
          </button>
          <button type="button" className="btn-secondary" onClick={baixar}>
            <Download size={15} /> Guardar no computador
          </button>
          {canais.length > 0 && cabeNoChat && (
            <button type="button" className="btn-primary" disabled={enviando || pronto} onClick={() => void mandar()}>
              <Send size={15} /> {pronto ? 'Mandado!' : enviando ? 'Mandando…' : 'Mandar na conversa'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * O botão de clipe. Enquanto houver uma transmissão na tela, ele grava em silêncio os últimos segundos;
 * ao ser apertado, mostra o que guardou.
 */
export function ClipButton({ stream, de, canais }: { stream: MediaStream | null; de: string; canais: Channel[] }) {
  const gravacao = useRef<GravacaoEmRolagem | null>(null);
  const [pronto, setPronto] = useState(false);
  const [clipe, setClipe] = useState<Clipe | null>(null);
  const [pegando, setPegando] = useState(false);

  useEffect(() => {
    gravacao.current?.parar();
    gravacao.current = null;
    setPronto(false);
    if (!stream) return;

    const rolando = gravarEmRolagem(stream);
    gravacao.current = rolando;
    if (!rolando) return;

    // O botão só acende quando já há alguma coisa guardada: apertar antes disso não daria nada.
    const timer = setInterval(() => setPronto(rolando.segundosProntos() >= 3), 1000);
    return () => {
      clearInterval(timer);
      rolando.parar();
      gravacao.current = null;
    };
  }, [stream]);

  if (!stream || !gravacao.current) return null;

  return (
    <>
      <IconButton
        label={pronto ? `Clipar os últimos ${SEGUNDOS_DO_CLIPE} segundos` : 'Gravando… daqui a pouco dá para clipar'}
        disabled={!pronto || pegando}
        onClick={() => {
          setPegando(true);
          void gravacao.current
            ?.pegar()
            .then(setClipe)
            .finally(() => setPegando(false));
        }}
      >
        <Scissors />
      </IconButton>
      {clipe && <Previa blob={clipe.blob} segundos={clipe.segundos} de={de} canais={canais} onFechar={() => setClipe(null)} />}
    </>
  );
}
