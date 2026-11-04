import { ClipboardPaste, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { criarFigurinha, type Figurinha, listarFigurinhas, prepararFigurinha, tirarFigurinha, urlDaFigurinha } from './figurinhas';
import { useT } from './i18n';
import { imageFromClipboard, imageFromClipboardEvent } from './upload';

/**
 * O SELETOR DE FIGURINHAS (04/11/2026), acima do campo de mensagem, como o de GIFs: a coleção da pessoa numa grade, o "+"
 * para criar uma nova a partir de uma imagem, e o modo de arrumar para tirar. Clicar numa figurinha já manda.
 *
 * A IMAGEM VAI INTEIRA, sem tela de recorte: quem faz figurinha (como a de WhatsApp) já recorta antes, no app que usou; e a
 * transparência é preservada, que é o que faz a figurinha parecer figurinha.
 */
export function SeletorDeFigurinhas({ onPick, onClose }: { onPick: (f: Figurinha) => void; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [figurinhas, setFigurinhas] = useState<Figurinha[] | null>(null);
  const [maximo, setMaximo] = useState(200);
  const [arrumando, setArrumando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const noTeclado = (evento: KeyboardEvent) => evento.key === 'Escape' && onClose();
    const noPonteiro = (evento: PointerEvent) => {
      if (!ref.current?.parentElement?.contains(evento.target as Node)) onClose();
    };
    window.addEventListener('keydown', noTeclado);
    window.addEventListener('pointerdown', noPonteiro);
    return () => {
      window.removeEventListener('keydown', noTeclado);
      window.removeEventListener('pointerdown', noPonteiro);
    };
  }, [onClose]);

  useEffect(() => {
    listarFigurinhas()
      .then((r) => {
        setFigurinhas(r.figurinhas);
        setMaximo(r.maximo);
      })
      .catch((e) => {
        setFigurinhas([]);
        setErro((e as Error).message);
      });
  }, []);

  // Ctrl+V com o seletor aberto cria a figurinha. Na fase de CAPTURA e parando ali: senão o campo de mensagem, que está
  // com o foco, receberia a mesma imagem como anexo.
  useEffect(() => {
    const aoColar = (evento: ClipboardEvent) => {
      const arquivo = imageFromClipboardEvent(evento);
      if (!arquivo) return;
      evento.preventDefault();
      evento.stopPropagation();
      void criar([arquivo]);
    };
    window.addEventListener('paste', aoColar, true);
    return () => window.removeEventListener('paste', aoColar, true);
  });

  async function criar(arquivos: FileList | File[] | null) {
    if (!arquivos?.length) return;
    setErro(null);
    setEnviando(true);
    try {
      for (const arquivo of [...arquivos]) {
        const pronta = await prepararFigurinha(arquivo);
        if ('erro' in pronta) {
          setErro(pronta.erro === 'grande' ? t('Essa imagem é grande demais para virar figurinha (até 1 MB).') : t('Use uma imagem PNG, JPG, GIF ou WEBP.'));
          continue;
        }
        const nova = await criarFigurinha(pronta);
        setFigurinhas((antes) => [nova, ...(antes ?? []).filter((f) => f.id !== nova.id)]);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function tirar(f: Figurinha) {
    setErro(null);
    try {
      await tirarFigurinha(f.id);
      setFigurinhas((antes) => (antes ?? []).filter((x) => x.id !== f.id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const cheia = (figurinhas?.length ?? 0) >= maximo;
  return (
    <div className="figurinhas-seletor" ref={ref} role="dialog" aria-label={t('Figurinhas')}>
      <div className="figurinhas-topo">
        <strong>{t('Figurinhas')}</strong>
        <button
          type="button"
          className="link-button"
          disabled={enviando || cheia}
          onClick={() => imageFromClipboard().then((f) => criar([f]), (e: Error) => setErro(t(e.message)))}
        >
          <ClipboardPaste size={14} aria-hidden="true" /> {t('Colar imagem')}
        </button>
        {!!figurinhas?.length && (
          <button type="button" className="link-button" onClick={() => setArrumando(!arrumando)}>
            {arrumando ? t('Pronto') : t('Arrumar')}
          </button>
        )}
      </div>
      <div className="figurinhas-rolagem">
        {figurinhas === null ? null : (
          <div className="figurinhas-grade">
            <button
              type="button"
              className="figurinhas-nova"
              disabled={enviando || cheia}
              title={cheia ? t('A sua coleção de figurinhas está cheia. Tire alguma para pôr outra.') : t('Criar figurinha')}
              aria-label={t('Criar figurinha')}
              onClick={() => entrada.current?.click()}
            >
              <Plus size={28} aria-hidden="true" />
            </button>
            {figurinhas.map((f) => (
              <div key={f.id} className="figurinhas-item">
                <button type="button" className="figurinhas-figura" disabled={arrumando} aria-label={t('Mandar figurinha')} onClick={() => onPick(f)}>
                  <img src={urlDaFigurinha(f)} alt="" loading="lazy" draggable={false} />
                </button>
                {arrumando && (
                  <button type="button" className="figurinhas-tirar" aria-label={t('Tirar figurinha')} onClick={() => void tirar(f)}>
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {figurinhas?.length === 0 && !erro && <p className="figurinhas-vazio">{t('Crie figurinhas com as suas imagens, ou salve as que receber numa conversa.')}</p>}
        {erro && <p className="figurinhas-erro">{erro}</p>}
      </div>
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => void criar(e.target.files)} />
    </div>
  );
}
