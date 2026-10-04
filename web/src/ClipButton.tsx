import { Download, Scissors, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import {
  type Clipe,

  corteVazio,
  duracaoDoClipe,
  type GravacaoEmRolagem,
  gravarEmRolagem,
  nomeDoClipe,
  montarClipe,
  recortarClipe,
  SEGUNDOS_DO_CLIPE,
} from './clips';
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
  vozesDaSala,
  de,
  canais,
  onFechar,
}: {
  blob: Blob;
  segundos: number;
  vozesDaSala: Blob | null;
  de: string;
  canais: Channel[];
  onFechar: () => void;
}) {
  const t = useT();
  const [canalId, setCanalId] = useState(canais[0]?.id ?? 0);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const url = useEnderecoDoArquivo(blob);

  // O AJUSTE FINO. `duracao` só é conhecida depois de o navegador varrer o arquivo (webm gravado
  // aqui não traz a duração escrita dentro), e até lá não há régua para arrastar.
  const video = useRef<HTMLVideoElement>(null);
  const [duracao, setDuracao] = useState(0);
  const [inicio, setInicio] = useState(0);
  const [fim, setFim] = useState(0);
  const [volume, setVolume] = useState(1);
  const [cortando, setCortando] = useState<number | null>(null);
  // null = ainda não dá para dizer. Só se sabe depois de o arquivo tocar um pouco.
  const [temSom, setTemSom] = useState<boolean | null>(null);
  // Marcada quando HÁ vozes gravadas: o clipe com a reação da galera é o que a pessoa quase sempre
  // quer, e quem preferir só o jogo desmarca. Sem trilha de voz, a caixinha nem aparece.
  const [comVozes, setComVozes] = useState(true);

  /**
   * A PRÉVIA NÃO É MAIS `muted`, e isso é metade do conserto do "clipe sem som".
   *
   * Ela tocava calada porque `autoPlay` sem `muted` é barrado pelo navegador. O efeito colateral era
   * pior que a conveniência: quem clipava via o vídeo rodando sem som e concluía que o clipe tinha
   * saído mudo — sem ter como distinguir isso de um arquivo realmente mudo. Agora ela não toca
   * sozinha, e quem aperta play ouve o que o arquivo tem.
   */
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let vivo = true;
    void duracaoDoClipe(el).then((total) => {
      if (!vivo) return;
      setDuracao(total);
      setFim(total);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Tocar dentro do pedaço escolhido: sair dele volta para o começo da seleção. */
  function aoAndar() {
    const el = video.current;
    if (!el || duracao === 0) return;
    // O navegador conta quantos bytes de som ele decodificou. Zero depois de meio segundo tocando é
    // a resposta honesta para "este arquivo tem som?" — melhor que adivinhar pelo tipo do arquivo.
    const bytes = (el as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount;
    if (temSom === null && typeof bytes === 'number' && el.currentTime > 0.5) setTemSom(bytes > 0);
    if (el.currentTime >= fim - 0.02) el.currentTime = inicio;
    if (el.currentTime < inicio - 0.02) el.currentTime = inicio;
  }

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const cabeNoChat = blob.size <= LIMITE_DO_CHAT;
  const nome = nomeDoClipe(de);

  /**
   * O ARQUIVO QUE VAI: o original quando ninguém mexeu em nada, o recorte quando mexeram.
   *
   * Regravar um webm custa o tempo do pedaço e perde uma geração de qualidade. Quem não cortou nem
   * mexeu no volume não tem por que pagar nenhum dos dois — então o caminho sem edição manda os bytes
   * exatos que saíram da gravação.
   */
  async function arquivoFinal(): Promise<Blob> {
    // A DURAÇÃO PODE NÃO TER CHEGADO quando a pessoa clica (ela é medida varrendo o arquivo). Antes,
    // duração zero entregava o arquivo cru — e com ele iam embora as vozes que a caixinha prometia,
    // sem aviso. Agora, com vozes pedidas, o corte acontece de qualquer jeito, até o fim do arquivo.
    const vozes = comVozes ? vozesDaSala : null;
    const corte = { inicio, fim: duracao > 0 ? fim : Infinity, volume, vozes };
    if (!vozes && (duracao === 0 || corteVazio(corte, duracao))) return blob;
    setCortando(0);
    try {
      try {
        return await montarClipe(blob, corte, setCortando);
      } catch (e) {
        // O caminho novo falhou neste navegador (sem codificador, arquivo estranho): o antigo, que
        // regrava em tempo real, é mais lento mas não depende de nada disso.
        console.warn('montarClipe falhou, regravando:', e);
        return await recortarClipe(blob, corte, setCortando);
      }
    } finally {
      setCortando(null);
    }
  }

  async function baixarEditado() {
    try {
      const arquivo = await arquivoFinal();
      const endereco = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = endereco;
      link.download = nome;
      link.click();
      setTimeout(() => URL.revokeObjectURL(endereco), 10_000);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function mandar() {
    setEnviando(true);
    setErro(null);
    try {
      const arquivo = await arquivoFinal();
      // Cortar REGRAVA, e regravação pode sair maior que o original (mais movimento no trecho
      // escolhido = mais bytes por segundo). Conferir de novo aqui é o que evita o envio ser recusado
      // pelo servidor com uma mensagem que não explica nada.
      if (arquivo.size > LIMITE_DO_CHAT) throw new Error(t('O clipe ficou grande demais para o chat. Escolha um trecho menor.'));
      const data = await readAsDataUrl(arquivo);
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
        <video ref={video} className="clipe-video" src={url ?? undefined} controls loop playsInline onTimeUpdate={aoAndar} />
        {vozesDaSala && comVozes && <VozesNaPrevia video={video} vozes={vozesDaSala} />}

        {duracao > 0 && (
          <div className="clipe-ajuste">
            {/* A faixa escolhida, desenhada por cima das duas réguas: é o que dá a leitura de "editor"
                sem precisar de um controle de dois punhos, que nenhum navegador desenha sozinho. */}
            <div className="clipe-regua">
              <div
                className="clipe-selecao"
                style={{ left: `${(inicio / duracao) * 100}%`, right: `${100 - (fim / duracao) * 100}%` }}
              />
              <input
                type="range"
                className="clipe-ponta"
                aria-label={t('Começo')}
                min={0}
                max={duracao}
                step={0.05}
                value={inicio}
                onChange={(e) => {
                  const novo = Math.min(Number(e.target.value), fim - 0.3);
                  setInicio(Math.max(0, novo));
                  if (video.current) video.current.currentTime = Math.max(0, novo);
                }}
              />
              <input
                type="range"
                className="clipe-ponta"
                aria-label={t('Fim')}
                min={0}
                max={duracao}
                step={0.05}
                value={fim}
                onChange={(e) => setFim(Math.max(Number(e.target.value), inicio + 0.3))}
              />
            </div>
            <p className="clipe-tempos">
              <span>{t('Arraste as pontas para escolher o trecho.')}</span>
              <strong>{(fim - inicio).toFixed(1)}s</strong>
            </p>

            <label className="clipe-volume">
              {t('Volume')} <strong>{Math.round(volume * 100)}%</strong>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const novo = Number(e.target.value);
                  setVolume(novo);
                  // Na prévia o elemento só vai até 100%; acima disso quem ganha volume é o arquivo
                  // final, pelo ganho do Web Audio. A prévia não mente: ela mostra o que der.
                  if (video.current) video.current.volume = Math.min(1, novo);
                }}
              />
            </label>
          </div>
        )}

        {vozesDaSala && (
          <label className="clipe-vozes">
            <input type="checkbox" checked={comVozes} onChange={(e) => setComVozes(e.target.checked)} />
            {t('Juntar as vozes da sala')}
          </label>
        )}

        {temSom === false && !comVozes && <p className="clipe-sem-som">{t('Este clipe não tem som.')}</p>}

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

        {/* O CORTE DEMORA O TEMPO DO PEDAÇO, porque o navegador não sabe cortar sem regravar. Dez
            segundos de clipe, dez segundos de espera — e por isso a barra existe: sem ela, o botão
            pareceria travado justamente em quem cortou o trecho maior. */}
        {cortando !== null && (
          <div className="clipe-cortando" role="status">
            <span>{t('Cortando…')}</span>
            <div className="clipe-andamento">
              <div style={{ width: `${Math.round(cortando * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onFechar}>
            <X size={15} /> {t('Descartar')}
          </button>
          <button type="button" className="btn-secondary" disabled={cortando !== null} onClick={() => void baixarEditado()}>
            <Download size={15} /> Guardar no computador
          </button>
          {canais.length > 0 && cabeNoChat && (
            <button
              type="button"
              className="btn-primary"
              disabled={enviando || pronto || cortando !== null}
              onClick={() => void mandar()}
            >
              <Send size={15} /> {pronto ? 'Mandado!' : enviando ? 'Mandando…' : 'Mandar na conversa'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * O endereço de um arquivo na memória, criado e revogado PELO MESMO EFEITO.
 *
 * Criar uma vez (num useRef ou no estado) e revogar na desmontagem parece certo e não é: no modo
 * estrito o React monta, desmonta e monta de novo, e a segunda montagem herdava um endereço já
 * revogado. Medido: a prévia do clipe ficava com o vídeo parado no zero e as vozes sem carregar.
 */
function useEnderecoDoArquivo(arquivo: Blob): string | null {
  const [endereco, setEndereco] = useState<string | null>(null);
  useEffect(() => {
    const novo = URL.createObjectURL(arquivo);
    setEndereco(novo);
    return () => URL.revokeObjectURL(novo);
  }, [arquivo]);
  return endereco;
}

/**
 * AS VOZES TOCAM NA PRÉVIA, junto com o vídeo. Antes elas só entravam no arquivo final, e a prévia
 * tocava o jogo sozinho: quem marcava "Juntar as vozes da sala" e apertava play não ouvia reação
 * nenhuma e concluía que a caixinha não funcionava. A prévia não pode mentir sobre o que vai sair.
 *
 * As duas gravações começaram no mesmo instante (ver gravarEmRolagem), então seguir o tempo do vídeo
 * basta: play, pausa e cada salto da régua levam as vozes junto.
 */
function VozesNaPrevia({ video, vozes }: { video: React.RefObject<HTMLVideoElement | null>; vozes: Blob }) {
  const audio = useRef<HTMLAudioElement>(null);
  const endereco = useEnderecoDoArquivo(vozes);

  useEffect(() => {
    const v = video.current;
    const a = audio.current;
    if (!v || !a) return;
    const alinhar = () => {
      if (Math.abs(a.currentTime - v.currentTime) > 0.25) a.currentTime = v.currentTime;
    };
    // `playing`, e não `play`: `play` chega quando alguém PEDIU para tocar, e o vídeo ainda pode estar
    // carregando. Medido: as vozes andavam 1,4 s com o vídeo parado no zero. `playing` é o vídeo rodando.
    const tocar = () => {
      alinhar();
      void a.play().catch(() => {});
    };
    const pausar = () => a.pause();
    const eventos: [string, () => void][] = [
      ['playing', tocar],
      ['pause', pausar],
      ['waiting', pausar], // o vídeo engasgou: as vozes esperam com ele
      ['seeked', alinhar],
      ['timeupdate', alinhar], // e a cada passo o desvio é corrigido, inclusive na volta do loop
    ];
    for (const [nome, f] of eventos) v.addEventListener(nome, f);
    if (!v.paused && v.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) tocar();
    return () => {
      for (const [nome, f] of eventos) v.removeEventListener(nome, f);
      a.pause();
    };
  }, [video, endereco]);

  return <audio ref={audio} src={endereco ?? undefined} preload="auto" hidden />;
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
export function useClipe(stream: MediaStream | null, vozes?: MediaStream | null) {
  const t = useT();
  const gravacao = useRef<GravacaoEmRolagem | null>(null);
  /*
   * AS VOZES JÁ FORAM POR REF, E ISSO FAZIA A CAIXINHA NUNCA APARECER.
   *
   * O medo era legítimo: a lista de quem está com o microfone ligado muda o tempo todo numa chamada,
   * e se ela entrasse nas dependências do efeito a gravação em rolagem reiniciaria a cada entrada e
   * saída — os "últimos trinta segundos" voltariam a zero toda vez que alguém mutasse.
   *
   * SÓ QUE O REF CHEGAVA TARDE. Quando a transmissão aparece, `stream` deixa de ser nulo e o efeito
   * de baixo roda. No MESMO instante, o gancho das vozes (useVozesDaSala, no palco) ainda está
   * criando o destino do Web Audio: ele é declarado antes, o efeito dele roda antes — e termina
   * chamando `setVozes`, que só se torna visível no RENDER SEGUINTE. Um ref se atualiza durante o
   * render, não durante o efeito. Resultado: `gravarEmRolagem` começava com `null` no lugar das
   * vozes, nunca gravava a segunda trilha, o clipe saía com `vozes: null` e a caixinha "Juntar as
   * vozes da sala" — que só existe quando há vozes gravadas — não aparecia NUNCA.
   *
   * O CONSERTO É PÔR O FLUXO NAS DEPENDÊNCIAS, e o próprio comentário antigo explicava por que isso
   * é seguro: o fluxo de vozes É ESTÁVEL. Ele nasce uma vez por transmissão (useVozesDaSala depende
   * de `[room, ligado]`, e `ligado` é "há transmissão na tela"); o que muda a cada microfone é quem
   * está LIGADO nele, e isso não troca o objeto. Então a gravação reinicia uma vez só, no começo,
   * quando ainda não há nada guardado para perder.
   */
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

    const rolando = gravarEmRolagem(stream, vozes ?? null);
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
  }, [stream, vozes]);

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
    <Previa
      blob={clipe.clipe.blob}
      segundos={clipe.clipe.segundos}
      vozesDaSala={clipe.clipe.vozes}
      de={de}
      canais={canais}
      onFechar={clipe.fechar}
    />,
    document.body,
  );
}
