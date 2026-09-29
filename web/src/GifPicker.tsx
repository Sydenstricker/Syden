import { useCallback, useEffect, useRef, useState } from 'react';
import { type Gif, type RespostaDeGifs, procurarGifs } from './gifs';
import { idiomaAtual, useT } from './i18n';

/**
 * O seletor de GIFs, acima do campo de mensagem.
 *
 * A BUSCA ESPERA A PESSOA PARAR DE DIGITAR. Não é enfeite de desempenho: cada busca gasta uma das 100
 * que o Syden tem por hora, para todo mundo. Buscar a cada tecla de "gatinho" gastaria oito, e quem
 * digita devagar gastaria mais que quem digita rápido — a cota acabaria por causa de um teclado lento.
 *
 * O ACERVO É DE TERCEIROS, e a tela diz isso. É exigência do GIPHY e é honesto: o que aparece aqui não
 * foi escolhido pelo Syden, e quem procura sabe a quem está perguntando.
 */
export function GifPicker({ onPick, onClose }: { onPick: (gif: Gif) => void; onClose: () => void }) {
  const t = useT();
  const [termo, setTermo] = useState('');
  const [resposta, setResposta] = useState<RespostaDeGifs | null>(null);
  const [itens, setItens] = useState<Gif[]>([]);
  const [buscando, setBuscando] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

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

  const buscar = useCallback(async (procurado: string, de: number) => {
    setBuscando(true);
    const r = await procurarGifs(procurado, de, idiomaAtual());
    setResposta(r);
    setItens((anteriores) => (r.estado === 'ok' ? (de === 0 ? r.itens : [...anteriores, ...r.itens]) : de === 0 ? [] : anteriores));
    setBuscando(false);
  }, []);

  // Meio segundo depois da última tecla. Menos que isso volta a gastar cota por letra; mais que isso
  // a pessoa acha que o campo não funcionou e digita de novo.
  useEffect(() => {
    const relogio = setTimeout(() => void buscar(termo, 0), termo ? 500 : 0);
    return () => clearTimeout(relogio);
  }, [termo, buscar]);

  const proxima = resposta?.estado === 'ok' ? resposta.proxima : null;

  return (
    <div className="gif-picker" ref={ref} role="dialog" aria-label={t('Escolher GIF')}>
      <div className="gif-picker-busca">
        <input
          autoFocus
          value={termo}
          placeholder={t('Procurar GIF')}
          aria-label={t('Procurar GIF')}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>

      <div className="gif-picker-rolagem">
        {itens.length > 0 && (
          <div className="gif-picker-grade">
            {itens.map((gif) => (
              <button
                key={gif.id}
                className="gif-picker-item"
                title={gif.descricao || undefined}
                onClick={() => onPick(gif)}
              >
                {/* A proporção vai no estilo para a grade não pular quando cada figura chega: sem
                    isso, escolher um GIF vira acertar um alvo que se mexe. */}
                <img
                  src={gif.previa}
                  alt={gif.descricao}
                  loading="lazy"
                  draggable={false}
                  style={{ aspectRatio: gif.previaLargura && gif.previaAltura ? `${gif.previaLargura} / ${gif.previaAltura}` : undefined }}
                />
              </button>
            ))}
          </div>
        )}

        {buscando && itens.length === 0 && <p className="gif-picker-recado">{t('Procurando…')}</p>}

        {!buscando && itens.length === 0 && resposta?.estado === 'ok' && (
          <p className="gif-picker-recado">{t('Nenhum GIF para essa busca.')}</p>
        )}
        {resposta?.estado === 'sem-cota' && (
          <p className="gif-picker-recado">{t('Muita gente procurando GIF agora. Tente de novo daqui a pouco.')}</p>
        )}
        {resposta?.estado === 'devagar' && (
          <p className="gif-picker-recado">{t('Calma aí: espere alguns segundos antes de procurar de novo.')}</p>
        )}
        {resposta?.estado === 'indisponivel' && (
          <p className="gif-picker-recado">{t('Não deu para falar com o GIPHY agora.')}</p>
        )}

        {proxima !== null && (
          <button className="btn-sutil gif-picker-mais" disabled={buscando} onClick={() => void buscar(termo, proxima)}>
            {buscando ? t('Procurando…') : t('Ver mais')}
          </button>
        )}
      </div>

      {/* O crédito é exigência de quem fornece o acervo, e é justo: nada aqui é do Syden. */}
      <div className="gif-picker-rodape">{t('GIFs pelo GIPHY')}</div>
    </div>
  );
}
