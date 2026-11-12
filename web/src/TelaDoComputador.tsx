import { type CSSProperties, useEffect, useState, type ReactNode } from 'react';
import { Power, X } from 'lucide-react';
import { useT, idiomaAtual } from './i18n';

// A TELA DO COMPUTADOR DO QUARTO (11/11/2026, pedido dele: "uma tela como a do Windows 95, em que o usuário clique num ícone
// Mini-games e gere a tela atual"). Uma área de trabalho retrô, NOSSA: sem logo, sem "Iniciar" e sem nada copiado de sistema
// nenhum, só o jeito da época (papel de parede liso, ícones de 32 px, janela com barra de título, barra de baixo com o relógio).
// Só há ícone do que FUNCIONA (a tela não mente): os Mini-games, que abrem a lista de sempre numa janela, e os Troféus. O botão
// de desligar, no canto da barra, fecha o computador; o Esc fecha a janela e, sem janela, o computador.

/** Os ícones em pixel art, 16 × 16, desenhados aqui (cada letra é uma cor; "." é vazio). */
const CORES: Record<string, string> = {
  K: '#1b1b22',
  R: '#d6463c',
  r: '#f08a7e',
  G: '#9a9aa6',
  B: '#3a3f6b',
  b: '#5a609a',
  Y: '#e8c547',
  y: '#f7e28a',
  O: '#b8892a',
  W: '#6b4a2f',
};

const CONTROLE = [
  '................',
  '......KKKK......',
  '.....KrrRRK.....',
  '.....KrRRRK.....',
  '.....KRRRRK.....',
  '......KRRK......',
  '.......KK.......',
  '.......GK.......',
  '.......GK.......',
  '...KKKKGKKKKK...',
  '..KbbbbbbbbbbK..',
  '..KbBBBBBBYYBK..',
  '..KBBBBBBBYYBK..',
  '..KBBBBBBBBBBK..',
  '...KKKKKKKKKK...',
  '................',
];

const TROFEU = [
  '................',
  '...KKKKKKKKKK...',
  '..KKyyYYYYYOKK..',
  '.KYKyYYYYYYOKYK.',
  '.KYKyYYYYYYOKYK.',
  '..KKyYYYYYYOKK..',
  '....KyYYYYOK....',
  '.....KYYYOK.....',
  '......KYOK......',
  '.......KK.......',
  '......KYOK......',
  '......KYOK......',
  '.....KKKKKK.....',
  '....KWWWWWWK....',
  '....KWWWWWWK....',
  '....KKKKKKKK....',
];

function IconeDePixels({ desenho, tamanho = 32 }: { desenho: string[]; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      {desenho.flatMap((linha, y) =>
        [...linha].map((c, x) => (c === '.' ? null : <rect key={x + ',' + y} x={x} y={y} width={1} height={1} fill={CORES[c]} />)),
      )}
    </svg>
  );
}

function useRelogio(): string {
  const formatar = () => new Date().toLocaleTimeString(idiomaAtual(), { hour: '2-digit', minute: '2-digit' });
  const [hora, setHora] = useState(formatar);
  useEffect(() => {
    const id = window.setInterval(() => setHora(formatar()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return hora;
}

export function TelaDoComputador({
  aoDesligar,
  aoAbrirTrofeus,
  escutarEsc,
  children,
}: {
  aoDesligar: () => void;
  aoAbrirTrofeus: () => void;
  /** Falso enquanto outra coisa aberta por cima (o site de parceiro) é dona do Esc. */
  escutarEsc: boolean;
  /** O conteúdo da janela dos Mini-games. */
  children: ReactNode;
}) {
  const t = useT();
  const hora = useRelogio();
  const [janelaAberta, setJanelaAberta] = useState(false);

  useEffect(() => {
    if (!escutarEsc) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (janelaAberta) setJanelaAberta(false);
      else aoDesligar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [escutarEsc, janelaAberta, aoDesligar]);

  return (
    <div className="area-de-trabalho">
      <div className="area-de-trabalho-fundo" style={{ '--marca-do-syden': `url(${import.meta.env.BASE_URL}syden-icon.svg)` } as CSSProperties}>
        <ul className="area-de-trabalho-icones">
          <li>
            <button type="button" data-icone="mini-games" onClick={() => setJanelaAberta(true)}>
              <IconeDePixels desenho={CONTROLE} />
              <span>{t('Mini-games')}</span>
            </button>
          </li>
          <li>
            <button type="button" data-icone="trofeus" onClick={aoAbrirTrofeus}>
              <IconeDePixels desenho={TROFEU} />
              <span>{t('Troféus')}</span>
            </button>
          </li>
        </ul>
        {janelaAberta && (
          <section className="janela-retro" aria-label={t('Mini-games')}>
            <header className="janela-retro-titulo">
              <IconeDePixels desenho={CONTROLE} tamanho={16} />
              <h3>{t('Mini-games')}</h3>
              <button type="button" className="botao-retro janela-retro-fechar" aria-label={t('Fechar')} title={t('Fechar')} onClick={() => setJanelaAberta(false)}>
                <X size={12} strokeWidth={3} aria-hidden="true" />
              </button>
            </header>
            <div className="vila-painel jogos-painel">{children}</div>
          </section>
        )}
      </div>
      <footer className="barra-retro">
        <button type="button" className="botao-retro barra-retro-desligar" aria-label={t('Fechar')} title={t('Fechar')} onClick={aoDesligar}>
          <Power size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
        {janelaAberta && (
          <span className="botao-retro barra-retro-janela afundado">
            <IconeDePixels desenho={CONTROLE} tamanho={16} />
            {t('Mini-games')}
          </span>
        )}
        <time className="barra-retro-relogio">{hora}</time>
      </footer>
    </div>
  );
}
