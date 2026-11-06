import { type ReactNode, useEffect, useState } from 'react';
import { escolherEstiloVisual, useEstiloDoQuarto } from './Graficos';
import { useT } from './i18n';
import type { AcoesDoQuarto } from './Quarto';
import type { EstadoNoQuarto } from './QuartoNovo';
import { Quarto3D } from './quarto3d/Quarto3D';
import { escolherTema, ORDEM_DOS_TEMAS, temaEscolhido } from './quarto3d/temas';
import './quarto3d/quarto3d.css';

/**
 * O QUARTO EM DOIS ESTILOS (06/11/2026, pedido dele: "quero esse quarto 3D low poly como PILOTO da nossa funcionalidade de
 * variação estética para o usuário. Quero um ícone no quarto que alterne entre 3D e Pixel Art"). Só o quarto: o salão continua
 * em pixel art ("vamos amadurecer no quarto, que é menor").
 *
 * O botão do canto e a opção "Estilo visual" de Configurações → Gráficos mexem no MESMO valor (Graficos.tsx), e a troca é na
 * hora, sem recarregar. De fábrica o quarto é o de pixel art (`estiloDoQuarto`): o padrão é decisão dele. Se o 3D não puder
 * abrir (sem WebGL, falhou ao carregar), volta o pixel art sozinho, e a escolha guardada fica como está (o botão tenta de novo).
 *
 * O TEMA DO 3D (06/11/2026, pedido dele: "presets para o usuário escolher de base"): o segundo botão, só no 3D, troca o conjunto
 * de modelos (o clássico, do KayKit, e o colorido, do Tiny Treats) da MESMA arrumação, a do pixel art. Lembrado neste aparelho
 * (temas.ts); quem visita vê o quarto da pessoa com o tema que ELE escolheu aqui (o servidor não guarda tema).
 *
 * `children` é o quarto de pixel art como quem mostra já o monta (o novo, o antigo de reserva ou a espera).
 */
export function QuartoComEstilo({
  noite,
  acoes,
  estado,
  avatar,
  titulo,
  dono,
  children,
}: {
  noite: boolean;
  acoes: AcoesDoQuarto;
  estado: EstadoNoQuarto;
  /** Na visita, o avatar pronto de quem mora (null: o mascote). */
  avatar?: number | null;
  titulo: string;
  /** Na visita, o id de quem mora (o 3D lê a arrumação dele). */
  dono?: number;
  children: ReactNode;
}) {
  const t = useT();
  const estilo = useEstiloDoQuarto();
  const [falhou, setFalhou] = useState(false);
  const em3d = estilo === '3d' && !falhou;
  const alternar = () => {
    if (em3d) escolherEstiloVisual('2d');
    else {
      setFalhou(false);
      escolherEstiloVisual('3d');
    }
  };
  const nome = `${t('Estilo visual')}: ${em3d ? '3D' : '2D'}`;
  const [tema, setTema] = useState(temaEscolhido);
  useEffect(() => {
    const ouvir = () => setTema(temaEscolhido());
    window.addEventListener('syden:quarto3d-tema', ouvir);
    return () => window.removeEventListener('syden:quarto3d-tema', ouvir);
  }, []);
  const NOMES_DOS_TEMAS: Record<string, string> = { classico: t('Clássico'), colorido: t('Colorido') };
  const nomeDoTema = `${t('Móveis')}: ${NOMES_DOS_TEMAS[tema] ?? tema}`;
  const proximoTema = () => escolherTema(ORDEM_DOS_TEMAS[(ORDEM_DOS_TEMAS.indexOf(tema as (typeof ORDEM_DOS_TEMAS)[number]) + 1) % ORDEM_DOS_TEMAS.length]);
  return (
    <div className="quarto-com-estilo">
      {em3d ? <Quarto3D noite={noite} acoes={acoes} estado={estado} avatar={avatar} titulo={titulo} dono={dono} tema={tema} aoFalhar={() => setFalhou(true)} /> : children}
      {em3d && (
        <button type="button" className="quarto-tema-botao" aria-label={nomeDoTema} title={nomeDoTema} onClick={proximoTema}>
          {ORDEM_DOS_TEMAS.map((id) => (
            <span key={id} className={id === tema ? 'aceso' : ''}>
              {id === 'classico' ? <FiguraPoltronaReta /> : <FiguraPoltronaRedonda />}
            </span>
          ))}
        </button>
      )}
      <button type="button" className="quarto-estilo-botao" aria-label={nome} title={nome} onClick={alternar}>
        <span className={em3d ? '' : 'aceso'}>
          <FiguraPixel />
        </span>
        <span className={em3d ? 'aceso' : ''}>
          <FiguraCubo />
        </span>
      </button>
    </div>
  );
}

/** Os pixels: um xadrezinho de quadrados, como o pixel art visto de perto. */
export function FiguraPixel() {
  return (
    <svg width="18" height="18" viewBox="0 0 6 6" fill="currentColor" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M0 0h2v2H0zM4 0h2v2H4zM2 2h2v2H2zM0 4h2v2H0zM4 4h2v2H4z" />
    </svg>
  );
}

/** O cubo em três faces, como a câmera do quarto 3D o vê. */
export function FiguraCubo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9z" />
      <path d="M3 7.5 12 12.5l9-5M12 12.5v9" />
    </svg>
  );
}

/** O tema clássico: uma poltrona de cantos retos (o KayKit). */
function FiguraPoltronaReta() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" aria-hidden="true">
      <path d="M6 11V5h12v6M3 11h4v4h10v-4h4v7H3zM5 18v2M19 18v2" />
    </svg>
  );
}

/** O tema colorido: uma poltrona fofa, toda arredondada (o Tiny Treats). */
function FiguraPoltronaRedonda() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4h10a3 3 0 0 1 3 3v3a3 3 0 0 0-3 3v1H7v-1a3 3 0 0 0-3-3V7a3 3 0 0 1 3-3z" />
      <path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
    </svg>
  );
}
