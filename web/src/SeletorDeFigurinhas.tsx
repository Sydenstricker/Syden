import { ClipboardPaste, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  criarFigurinha,
  type EfeitosDaFigurinha,
  type Figurinha,
  type FigurinhaPronta,
  listarFigurinhas,
  prepararFigurinha,
  tirarFigurinha,
  urlDaFigurinha,
} from './figurinhas';
import { useT } from './i18n';
import { prepararRecorte, recortarComModelo, recorteDisponivel } from './recorteDeFundo';
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

  // AS IMAGENS À ESPERA DA PRÉVIA (04/11/2026): cada uma passa pela prévia, com "Tirar o fundo" e "Contorno" ligados de
  // fábrica, e a pessoa vê o resultado antes de guardar. GIF não passa (o efeito mataria a animação): vai direto.
  const [fila, setFila] = useState<File[]>([]);
  const [efeitos, setEfeitos] = useState<EfeitosDaFigurinha>({ tirarFundo: true, contorno: true });
  const [previa, setPrevia] = useState<FigurinhaPronta | null>(null);
  const daVez = fila[0] ?? null;

  // O recorte de qualquer fundo (só no app, com o modelo dentro dele): false no navegador. Ele abre o modelo já ao abrir as
  // figurinhas, para a primeira imagem não esperar os ~8 s de abrir.
  const [recorte, setRecorte] = useState(false);
  useEffect(() => {
    void recorteDisponivel().then((tem) => {
      setRecorte(tem);
      if (tem) prepararRecorte();
    });
  }, []);

  useEffect(() => {
    setPrevia(null);
    if (!daVez) return;
    let vivo = true;
    void prepararFigurinha(daVez, { ...efeitos, recortar: recorte ? recortarComModelo : undefined }).then((pronta) => {
      if (!vivo) return;
      if ('erro' in pronta) {
        setErro(mensagemDoErro(pronta.erro));
        setFila((antes) => antes.slice(1));
      } else setPrevia(pronta);
    });
    return () => {
      vivo = false;
    };
  }, [daVez, efeitos, recorte]);

  const mensagemDoErro = (erro: 'tipo' | 'grande') =>
    erro === 'grande' ? t('Essa imagem é grande demais para virar figurinha (até 1 MB).') : t('Use uma imagem PNG, JPG, GIF ou WEBP.');

  async function guardar(pronta: { image: string; width: number; height: number }) {
    const nova = await criarFigurinha({ image: pronta.image, width: pronta.width, height: pronta.height });
    setFigurinhas((antes) => [nova, ...(antes ?? []).filter((f) => f.id !== nova.id)]);
  }

  async function criar(arquivos: FileList | File[] | null) {
    if (!arquivos?.length) return;
    setErro(null);
    const lista = [...arquivos];
    if (entrada.current) entrada.current.value = '';
    setFila((antes) => [...antes, ...lista.filter((a) => a.type !== 'image/gif')]);
    const gifs = lista.filter((a) => a.type === 'image/gif');
    if (!gifs.length) return;
    setEnviando(true);
    try {
      for (const arquivo of gifs) {
        const pronta = await prepararFigurinha(arquivo);
        if ('erro' in pronta) setErro(mensagemDoErro(pronta.erro));
        else await guardar(pronta);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    if (!previa) return;
    setErro(null);
    setEnviando(true);
    try {
      await guardar(previa);
      setFila((antes) => antes.slice(1));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
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
      {daVez ? (
        <div className="figurinhas-previa">
          <div className="figurinhas-previa-figura">{previa ? <img src={previa.image} alt="" /> : <span className="figurinhas-previa-processando" />}</div>
          {previa?.fundo === 'nao-liso' && (
            <p className="figurinhas-previa-aviso">
              {t('O fundo não é de uma cor só, e ficou como veio.')}
              {!recorte && <> {t('No app do Syden, o recorte funciona com qualquer fundo.')}</>}
            </p>
          )}
          {previa?.fundo === 'ia-falhou' && <p className="figurinhas-previa-aviso">{t('O recorte com o modelo falhou, e ficou o recorte simples.')}</p>}
          <label className="figurinhas-previa-chave">
            <input type="checkbox" checked={efeitos.tirarFundo} onChange={(e) => setEfeitos({ ...efeitos, tirarFundo: e.target.checked })} />
            {t('Tirar o fundo')}
          </label>
          <label className="figurinhas-previa-chave">
            <input type="checkbox" checked={efeitos.contorno} onChange={(e) => setEfeitos({ ...efeitos, contorno: e.target.checked })} />
            {t('Contorno')}
          </label>
          {erro && <p className="figurinhas-erro">{erro}</p>}
          <div className="figurinhas-previa-botoes">
            <button type="button" className="btn-secondary" disabled={enviando} onClick={() => setFila((antes) => antes.slice(1))}>
              {t('Cancelar')}
            </button>
            <button type="button" className="btn-primary" disabled={!previa || enviando} onClick={() => void confirmar()}>
              {t('Criar figurinha')}
            </button>
          </div>
        </div>
      ) : (
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
      )}
      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => void criar(e.target.files)} />
    </div>
  );
}
