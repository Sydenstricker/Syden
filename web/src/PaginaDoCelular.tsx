import { Flashlight, FlashlightOff, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { esconderAbertura } from './abertura';
import { EmissorDoCelular, type EstadoDoEmissor } from './cameraDoCelular';
import { chave, idiomaAtual, useT } from './i18n';

/**
 * A PÁGINA DO CELULAR no "celular como câmera" (ver cameraDoCelular.ts): aberta pelo QR code, sem conta. Ela abre a câmera,
 * mostra o que está saindo e manda a imagem ao computador. Dá para virar entre a câmera da frente e a de trás e parar.
 *
 * OS CONTROLES DA CÂMERA moram aqui, na mão de quem filma (decisão dele, 24/11/2026, depois da medição num iPhone): o zoom
 * da LENTE (os botões 0,5× · 1× · 2× · 5× que a câmera alcança, e a pinça no vídeo) e a lanterna (só onde existe). O que o
 * aparelho não deixa, não aparece. O foco não entrou: o Safari não deixa mexer nele.
 *
 * O endereço traz o par e o segredo depois do #: assim que a página os lê, eles saem da barra de endereço e do histórico,
 * para não ficarem no celular de quem abriu.
 */
const FRASE: Record<EstadoDoEmissor['fase'], string> = {
  ligando: chave('Abrindo a câmera…'),
  conectando: chave('Ligando o celular ao computador…'),
  'ao-vivo': chave('A câmera do celular está na chamada.'),
  'sem-camera': chave('O navegador não deixou abrir a câmera. Permita a câmera para este site e abra o código de novo.'),
  recusado: chave('Este código já foi usado ou venceu. Peça outro no computador.'),
  falhou: chave('Não deu para ligar o celular ao computador. Os dois precisam estar na mesma rede Wi-Fi.'),
  fechado: chave('Pronto. Pode fechar esta página.'),
};

const ATALHOS_DO_ZOOM = [0.5, 1, 2, 5];

type Controles = ReturnType<EmissorDoCelular['controles']>;

export function PaginaDoCelular({ par }: { par: { id: string; token: string; segredo: string } }) {
  const t = useT();
  const [estado, setEstado] = useState<EstadoDoEmissor>({ fase: 'ligando' });
  const video = useRef<HTMLVideoElement>(null);
  const emissor = useRef<EmissorDoCelular | null>(null);
  const [frente, setFrente] = useState(false);
  const [controles, setControles] = useState<Controles>({ zoom: null, lanterna: false });
  const [zoom, setZoom] = useState(1);
  const [lanterna, setLanterna] = useState(false);

  // Câmera nova (a primeira, ou a virada): a lanterna começa apagada e o zoom no que a câmera diz.
  const lerControles = useCallback(() => {
    const c = emissor.current?.controles() ?? { zoom: null, lanterna: false };
    setControles(c);
    setZoom(c.zoom?.agora ?? 1);
    setLanterna(false);
  }, []);

  useEffect(() => {
    esconderAbertura();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    // Só a câmera ATUAL mexe na tela: a de uma montagem desfeita (o React monta duas vezes em desenvolvimento) pode
    // terminar de abrir depois, já parada, e deixaria a prévia preta.
    const e: EmissorDoCelular = new EmissorDoCelular(
      par,
      (estado) => {
        if (emissor.current !== e) return;
        setEstado(estado);
        if (estado.fase === 'conectando') lerControles();
      },
      (stream) => {
        if (emissor.current === e && video.current) video.current.srcObject = stream;
      },
    );
    emissor.current = e;
    void e.iniciar();
    // A tela não apaga enquanto a câmera manda (onde o navegador deixa).
    let trava: WakeLockSentinel | null = null;
    void navigator.wakeLock?.request('screen').then((w) => (trava = w), () => {});
    const sair = () => e.parar();
    window.addEventListener('pagehide', sair);
    return () => {
      window.removeEventListener('pagehide', sair);
      void trava?.release();
      e.parar();
    };
  }, [par, lerControles]);

  // O zoom vai à câmera no máximo uma vez por quadro (a pinça manda dezenas de mudanças por segundo).
  const pedido = useRef<number | null>(null);
  const pedirZoom = useCallback((n: number) => {
    const z = emissor.current?.controles().zoom;
    if (!z) return;
    const valor = Math.min(z.max, Math.max(z.min, n));
    setZoom(valor);
    if (pedido.current !== null) cancelAnimationFrame(pedido.current);
    pedido.current = requestAnimationFrame(() => {
      pedido.current = null;
      void emissor.current?.zoom(valor);
    });
  }, []);

  // A PINÇA no vídeo: dois dedos afastando ou juntando multiplicam o zoom de quando começaram.
  const pinca = useRef<{ distancia: number; zoom: number } | null>(null);
  const distancia = (toques: React.TouchList) =>
    Math.hypot(toques[0].clientX - toques[1].clientX, toques[0].clientY - toques[1].clientY);

  const ativo = estado.fase === 'ligando' || estado.fase === 'conectando' || estado.fase === 'ao-vivo';
  const numero = new Intl.NumberFormat(idiomaAtual(), { maximumFractionDigits: 1 });
  const z = controles.zoom;
  const atalhos = z ? ATALHOS_DO_ZOOM.filter((a) => a >= z.min - 0.01 && a <= z.max + 0.01) : [];
  // O atalho aceso é o mais perto do zoom de agora; com a pinça entre dois, ele mostra o número de verdade.
  const perto = atalhos.reduce((m, b) => (Math.abs(b - zoom) < Math.abs(m - zoom) ? b : m), atalhos[0] ?? 1);
  // "Lanterna" é também palavra do Desenha e adivinha, cuja tradução guarda as alternativas com "|": vale a primeira.
  const nomeDaLanterna = t('Lanterna').split('|')[0];
  return (
    <main className="camera-do-celular">
      {ativo && (
        <video
          ref={video}
          className={frente ? 'espelhado' : undefined}
          autoPlay
          muted
          playsInline
          style={z ? { touchAction: 'none' } : undefined}
          onTouchStart={(ev) => {
            if (z && ev.touches.length === 2) pinca.current = { distancia: distancia(ev.touches), zoom };
          }}
          onTouchMove={(ev) => {
            if (!pinca.current || ev.touches.length !== 2) return;
            pedirZoom(pinca.current.zoom * (distancia(ev.touches) / pinca.current.distancia));
          }}
          onTouchEnd={(ev) => {
            if (ev.touches.length < 2) pinca.current = null;
          }}
        />
      )}
      <p className={`camera-do-celular-estado${estado.fase === 'ao-vivo' ? ' ao-vivo' : ''}`} role="status">
        {t(FRASE[estado.fase])}
      </p>
      {ativo && atalhos.length > 1 && (
        <div className="camera-do-celular-zoom">
          {atalhos.map((a) => (
            <button key={a} type="button" aria-pressed={a === perto} onClick={() => pedirZoom(a)}>
              {numero.format(a === perto && Math.abs(zoom - a) > 0.05 ? zoom : a)}×
            </button>
          ))}
        </div>
      )}
      {ativo && (
        <div className="camera-do-celular-botoes">
          <button
            type="button"
            aria-label={t('Câmera')}
            onClick={() => {
              void emissor.current?.virar().then(() => {
                setFrente(!!emissor.current?.frente);
                lerControles();
              });
            }}
          >
            <RefreshCw size={22} />
          </button>
          {controles.lanterna && (
            <button
              type="button"
              aria-label={nomeDaLanterna}
              aria-pressed={lanterna}
              className={lanterna ? 'aceso' : undefined}
              onClick={() => {
                const acesa = !lanterna;
                setLanterna(acesa);
                void emissor.current?.lanterna(acesa);
              }}
            >
              {lanterna ? <Flashlight size={22} /> : <FlashlightOff size={22} />}
            </button>
          )}
          <button type="button" className="parar" onClick={() => emissor.current?.parar()}>
            {t('Parar')}
          </button>
        </div>
      )}
    </main>
  );
}
