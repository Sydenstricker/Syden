import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { esconderAbertura } from './abertura';
import { EmissorDoCelular, type EstadoDoEmissor } from './cameraDoCelular';
import { chave, useT } from './i18n';

/**
 * A PÁGINA DO CELULAR no "celular como câmera" (ver cameraDoCelular.ts): aberta pelo QR code, sem conta. Ela abre a câmera,
 * mostra o que está saindo e manda a imagem ao computador. Dá para virar entre a câmera da frente e a de trás e parar.
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

export function PaginaDoCelular({ par }: { par: { id: string; token: string; segredo: string } }) {
  const t = useT();
  const [estado, setEstado] = useState<EstadoDoEmissor>({ fase: 'ligando' });
  const video = useRef<HTMLVideoElement>(null);
  const emissor = useRef<EmissorDoCelular | null>(null);
  const [frente, setFrente] = useState(false);

  useEffect(() => {
    esconderAbertura();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    // Só a câmera ATUAL mexe na tela: a de uma montagem desfeita (o React monta duas vezes em desenvolvimento) pode
    // terminar de abrir depois, já parada, e deixaria a prévia preta.
    const e: EmissorDoCelular = new EmissorDoCelular(
      par,
      (estado) => {
        if (emissor.current === e) setEstado(estado);
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
  }, [par]);

  const ativo = estado.fase === 'ligando' || estado.fase === 'conectando' || estado.fase === 'ao-vivo';
  return (
    <main className="camera-do-celular">
      {ativo && <video ref={video} className={frente ? 'espelhado' : undefined} autoPlay muted playsInline />}
      <p className={`camera-do-celular-estado${estado.fase === 'ao-vivo' ? ' ao-vivo' : ''}`} role="status">
        {t(FRASE[estado.fase])}
      </p>
      {ativo && (
        <div className="camera-do-celular-botoes">
          <button
            type="button"
            aria-label={t('Câmera')}
            onClick={() => {
              void emissor.current?.virar().then(() => setFrente(!!emissor.current?.frente));
            }}
          >
            <RefreshCw size={22} />
          </button>
          <button type="button" className="parar" onClick={() => emissor.current?.parar()}>
            {t('Parar')}
          </button>
        </div>
      )}
    </main>
  );
}
