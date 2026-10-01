import { Download, Scissors, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { type Clipe, corrigirDuracao, type GravacaoEmRolagem, gravarEmRolagem, nomeDoClipe, SEGUNDOS_DO_CLIPE } from './clips';
import { nomeDeCanal } from './bidi';
import { IconButton } from './IconButton';
import type { Channel } from './types';
import { formatBytes, readAsDataUrl } from './upload';
import { useT } from './i18n';

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
  const t = useT();
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
                  {nomeDeCanal(canal.name, true)}
                </option>
              ))}
            </select>
          </label>
        )}

        {erro && <p className="form-error">{erro}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onFechar}>
            <X size={15} /> {t('Descartar')}
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
 * A GRAVAÇÃO EM ROLAGEM, COMO GANCHO — e ela NÃO PODE morar dentro do menu "...".
 *
 * Esta separação é o conserto do defeito que deixava a tesoura inútil. O componente do botão vive
 * dentro de um menu que abre e fecha; a gravação precisa viver enquanto a TRANSMISSÃO existir, que é
 * a premissa inteira da função: ela grava calada no fundo para você poder clipar uma jogada que JÁ
 * aconteceu. Presa ao botão, ela morria a cada fechada de menu e recomeçava do zero — e os "últimos
 * trinta segundos" nunca passavam dos segundos em que o menu esteve aberto.
 *
 * Por isso quem chama este gancho é o palco (VoiceStage), que fica de pé a chamada inteira.
 */
export function useClipe(stream: MediaStream | null) {
  const t = useT();
  const gravacao = useRef<GravacaoEmRolagem | null>(null);
  // O "existe gravação" PRECISA SER ESTADO, e não só o ref: escrever num ref não redesenha nada, e
  // por isso o botão só aparecia três segundos depois, quando o relógio mexia em outro estado.
  const [gravando, setGravando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [clipe, setClipe] = useState<Clipe | null>(null);
  const [pegando, setPegando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    gravacao.current?.parar();
    gravacao.current = null;
    setPronto(false);
    setGravando(false);
    setErro(null);
    if (!stream) return;

    const rolando = gravarEmRolagem(stream);
    gravacao.current = rolando;
    if (!rolando) return;
    setGravando(true);

    // O botão só acende quando já há alguma coisa guardada: apertar antes disso não daria nada.
    const timer = setInterval(() => setPronto(rolando.segundosProntos() >= 3), 1000);
    return () => {
      clearInterval(timer);
      rolando.parar();
      gravacao.current = null;
    };
  }, [stream]);

  /**
   * O BOTÃO NUNCA FICA CALADO, e esta é a terceira tentativa de consertar a tesoura.
   *
   * As duas primeiras acharam defeitos reais — uma corrida dentro de clips.ts, e o menu "..." que se
   * desmontava ao clique — e mesmo assim o relato continuou sendo "cliquei e não aconteceu nada".
   * A lição não é sobre clipes: é que um botão que pode falhar em silêncio vai falhar em silêncio,
   * e aí nem quem usa nem quem conserta fica sabendo de qual das cinco coisas se trata.
   *
   * Agora todo caminho termina numa frase na tela, inclusive o de "ainda não dá". O botão deixou de
   * ser desabilitado por isso: botão apagado é a forma mais educada de não responder.
   */
  const pegar = useCallback(() => {
    if (!gravacao.current) {
      setErro(t('Não há transmissão para clipar agora.'));
      return;
    }
    if (!pronto) {
      setErro(t('Ainda juntando os primeiros segundos. Tente daqui a pouco.'));
      return;
    }
    setPegando(true);
    setErro(null);
    void gravacao.current
      .pegar()
      .then((feito) => {
        if (feito) setClipe(feito);
        else setErro(t('Não deu para fechar o clipe agora. Tente de novo em alguns segundos.'));
      })
      .catch((falha) => {
        // O console recebe o erro de verdade. Sem isto, a próxima vez que alguém disser "não
        // aconteceu nada" vamos estar exatamente onde estamos agora: adivinhando.
        console.warn('[syden] o clipe falhou', falha);
        setErro(t('Não deu para fechar o clipe agora. Tente de novo em alguns segundos.'));
      })
      .finally(() => setPegando(false));
  }, [pronto, t]);

  /**
   * O AVISO SOME SOZINHO depois de cinco segundos.
   *
   * Sem isto ele fica na tela até a pessoa conseguir clipar — ou seja, some exatamente quando já não
   * importa. Cinco segundos é o tempo de ler uma frase e tentar de novo, que é o que o aviso pede.
   */
  useEffect(() => {
    if (!erro) return;
    const relogio = setTimeout(() => setErro(null), 5000);
    return () => clearTimeout(relogio);
  }, [erro]);

  return {
    /** Há transmissão e o navegador sabe gravá-la. */
    disponivel: Boolean(stream) && gravando,
    pronto,
    pegando,
    erro,
    clipe,
    pegar,
    fechar: useCallback(() => setClipe(null), []),
  };
}

export type EstadoDoClipe = ReturnType<typeof useClipe>;

/** Só o botão. Mora dentro do menu "...", e pode ser desmontado sem levar a gravação junto. */
export function ClipButton({ clipe }: { clipe: EstadoDoClipe }) {
  const t = useT();
  if (!clipe.disponivel) return null;

  return (
    <IconButton
      label={
        clipe.pronto
          ? t('Clipar os últimos {segundos} segundos', { segundos: SEGUNDOS_DO_CLIPE })
          : t('Gravando… daqui a pouco dá para clipar')
      }
      // SÓ "pegando" DESABILITA. Enquanto a gravação junta os primeiros segundos o botão continua
      // clicável, e clicar diz o que está acontecendo — ver o comentário em useClipe.
      disabled={clipe.pegando}
      onClick={clipe.pegar}
    >
      <Scissors />
    </IconButton>
  );
}

/**
 * A prévia e o aviso de erro, desenhados FORA do menu.
 *
 * Eles iam no mesmo lugar do botão, lá dentro do menu "...". Um diálogo `position: fixed` dentro de
 * um menu depende de nenhum ancestral ter transform, filter ou contain — e o dia em que um tiver, o
 * diálogo passa a se posicionar em relação a ele e vai parar fora da tela, sem erro nenhum. O portal
 * tira a dúvida: o diálogo é filho do `body`, como os outros do Syden.
 */
export function PreviaDoClipe({ clipe, de, canais }: { clipe: EstadoDoClipe; de: string; canais: Channel[] }) {
  // O AVISO ERA UM <p> SOLTO NO FIM DO BODY, e isso é um defeito que eu mesmo pus aqui: sem
  // posicionamento nenhum, ele era desenhado depois de toda a aplicação, fora da tela, invisível.
  // Um aviso que não se vê é a mesma coisa que não avisar — e o sintoma é idêntico ao do botão
  // quebrado que ele estava tentando explicar.
  if (clipe.erro) {
    return createPortal(
      <div className="clipe-aviso" role="status">
        {clipe.erro}
      </div>,
      document.body,
    );
  }
  if (!clipe.clipe) return null;
  return createPortal(
    <Previa blob={clipe.clipe.blob} segundos={clipe.clipe.segundos} de={de} canais={canais} onFechar={clipe.fechar} />,
    document.body,
  );
}
