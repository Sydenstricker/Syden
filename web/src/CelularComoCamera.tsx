import { Smartphone } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { useEffect, useMemo } from 'react';
import type { EstadoDoReceptor } from './cameraDoCelular';
import { IconButton } from './IconButton';
import { chave, useT } from './i18n';
import type { Voice } from './useVoice';

/**
 * O CELULAR COMO CÂMERA, no computador (ver cameraDoCelular.ts): o botão no "Mais" da chamada abre o QR code; o celular
 * aponta, abre a página e a câmera dele entra na chamada no lugar da webcam. O QR code é desenhado aqui, em SVG, pelos
 * módulos que a biblioteca calcula (qrcode-generator, MIT): nada de HTML vindo de fora.
 */
/** Num aparelho só de toque (o próprio celular), o botão não aparece: ele já é o celular. */
export const soToque = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

export function BotaoCelularComoCamera({ voice }: { voice: Voice }) {
  const t = useT();
  if (soToque()) return null;
  return (
    <IconButton label={t('Usar o celular como câmera')} active={voice.celular !== null} onClick={() => (voice.celular ? undefined : voice.abrirCelular())}>
      <Smartphone />
    </IconButton>
  );
}

function CodigoQR({ texto }: { texto: string }) {
  const { lado, caminho } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    return { lado: n + 8, caminho: d };
  }, [texto]);
  // O rótulo é o próprio endereço: quem usa leitor de tela ouve o link e pode abri-lo no celular por outro caminho.
  return (
    <svg className="celular-qr" viewBox={`0 0 ${lado} ${lado}`} shapeRendering="crispEdges" role="img" aria-label={texto}>
      <rect width={lado} height={lado} fill="#fff" />
      <path d={caminho} fill="#000" />
    </svg>
  );
}

const FRASE: Record<Exclude<EstadoDoReceptor['fase'], 'esperando' | 'parou'>, string> = {
  conectando: chave('Ligando o celular ao computador…'),
  'ao-vivo': chave('A câmera do celular está na chamada.'),
  falhou: chave('Não deu para ligar o celular ao computador. Os dois precisam estar na mesma rede Wi-Fi.'),
  fechado: chave('O celular saiu.'),
};

export function JanelaCelularComoCamera({ voice }: { voice: Voice }) {
  const t = useT();
  const estado = voice.celular;
  useEffect(() => {
    if (!estado) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && estado.fase !== 'ao-vivo' && voice.fecharCelular();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [estado, voice]);
  if (!estado) return null;
  // Ao vivo, a janela sai da frente: o que importa é a chamada. O botão da câmera, aceso, é o que desliga o celular.
  if (estado.fase === 'ao-vivo' || estado.fase === 'parou') return null;
  const falhouNoServidor = estado.fase === 'falhou' && estado.motivo === 'servidor';
  return (
    <div className="dialog-backdrop" onClick={voice.fecharCelular}>
      <div className="dialog celular-como-camera" role="dialog" aria-label={t('Usar o celular como câmera')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('Usar o celular como câmera')}</h2>
        {estado.fase === 'esperando' ? (
          <>
            <CodigoQR texto={estado.endereco} />
            <p>{t('Aponte a câmera do celular para o código e abra o endereço que aparecer.')}</p>
            <p className="celular-nota">{t('O celular e o computador precisam estar na mesma rede Wi-Fi.')}</p>
          </>
        ) : (
          <p className="celular-estado" role="status">
            {falhouNoServidor ? t('Não deu para abrir o código agora. Tente de novo.') : t(FRASE[estado.fase])}
          </p>
        )}
        <div className="dialog-actions">
          {(estado.fase === 'falhou' || estado.fase === 'fechado') && (
            <button type="button" onClick={voice.abrirCelular}>
              {t('Tentar de novo')}
            </button>
          )}
          <button type="button" className="link-button" onClick={voice.fecharCelular}>
            {t('Fechar')}
          </button>
        </div>
      </div>
    </div>
  );
}
