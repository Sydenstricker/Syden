import { ArrowLeft, ArrowRight, ArrowUp, Hand } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { COR_DO_TIME } from './desenho';
import { ALTA, chute, chuteDoRobo, decidido, defesa, FORTE, FRACA, mergulhoDoGoleiro, type Canto, type Saida } from './penaltis';

/**
 * OS PÊNALTIS DA MINI-COPA (20/11/2026; a regra em ./penaltis.ts). Uma cena pequena em SVG, desenhada por código: o gol, o
 * goleiro e a bola. Na minha vez, os três cantos (setas) e a barra de força que vai e volta: o botão (ou Espaço) chuta. Na vez
 * do robô, as setas dizem para onde pular. Tudo com figura; o texto é só o resultado de cada cobrança.
 */
export function Penaltis({ nivel, aoAcabar }: { nivel: number; aoAcabar: (ganhei: boolean, placar: [number, number]) => void }) {
  const t = useT();
  const [meus, setMeus] = useState<boolean[]>([]);
  const [deles, setDeles] = useState<boolean[]>([]);
  const [canto, setCanto] = useState<Canto>(1);
  /** A última cobrança, para a cena: o canto da bola, o pulo do goleiro e a saída. */
  const [ultima, setUltima] = useState<{ bola: Canto; goleiro: Canto; saida: Saida; minha: boolean } | null>(null);
  const [forca, setForca] = useState(0);
  const forcaRef = useRef(0);
  const aoAcabarRef = useRef(aoAcabar);
  aoAcabarRef.current = aoAcabar;
  const vez: 'chutar' | 'defender' = meus.length === deles.length ? 'chutar' : 'defender';
  const fim = decidido(meus, deles);
  const esperando = ultima !== null;

  // a barra de força: vai e volta em 1,2 s, só enquanto é a minha vez de chutar
  useEffect(() => {
    if (vez !== 'chutar' || esperando || fim !== null) return;
    let id = 0;
    const t0 = performance.now();
    const quadro = (agora: number) => {
      const fase = ((agora - t0) / 1200) % 2;
      const f = fase < 1 ? fase : 2 - fase;
      forcaRef.current = f;
      setForca(f);
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  }, [vez, esperando, fim]);

  // depois de cada cobrança, a cena fica 1,4 s à vista; acabou, avisa
  useEffect(() => {
    if (!ultima) return;
    const id = setTimeout(() => {
      setUltima(null);
      const d = decidido(meus, deles);
      if (d !== null) aoAcabarRef.current(d === 0, [meus.filter(Boolean).length, deles.filter(Boolean).length]);
    }, 1400);
    return () => clearTimeout(id);
  }, [ultima, meus, deles]);

  const chutar = () => {
    if (vez !== 'chutar' || esperando || fim !== null) return;
    const goleiro = mergulhoDoGoleiro(canto, nivel);
    const saida = chute(canto, forcaRef.current, goleiro);
    tocar(saida === 'gol' ? 'buraco' : saida === 'defesa' ? 'impacto' : 'erro');
    setMeus((l) => [...l, saida === 'gol']);
    setUltima({ bola: canto, goleiro, saida, minha: true });
  };
  const pular = (pulo: Canto) => {
    if (vez !== 'defender' || esperando || fim !== null) return;
    const robo = chuteDoRobo();
    const saida = defesa(robo, pulo);
    tocar(saida === 'gol' ? 'erro' : 'acerto');
    setDeles((l) => [...l, saida === 'gol']);
    setUltima({ bola: robo.canto, goleiro: pulo, saida, minha: false });
  };

  // o teclado: setas escolhem o canto (ou pulam), Espaço chuta
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const c: Canto | null = e.key === 'ArrowLeft' ? 0 : e.key === 'ArrowUp' ? 1 : e.key === 'ArrowRight' ? 2 : null;
      if (c !== null) {
        e.preventDefault();
        if (vez === 'chutar') setCanto(c);
        else pular(c);
      } else if (e.key === ' ' && vez === 'chutar') {
        e.preventDefault();
        chutar();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const xDe = (c: Canto) => 60 + c * 90;
  const cantos: { c: Canto; icone: typeof ArrowLeft; nome: string }[] = [
    { c: 0, icone: ArrowLeft, nome: t('Para a esquerda') },
    { c: 1, icone: ArrowUp, nome: t('No meio') },
    { c: 2, icone: ArrowRight, nome: t('Para a direita') },
  ];
  const bolinhas = (l: boolean[], cor: string) => (
    <span className="futebol-penaltis-cobrancas">
      {Array.from({ length: Math.max(5, l.length) }, (_, i) => (
        <span key={i} className={`futebol-penaltis-bolinha${i < l.length ? (l[i] ? ' gol' : ' perdeu') : ''}`} style={{ borderColor: cor }} />
      ))}
    </span>
  );
  const goleiroX = ultima ? xDe(ultima.goleiro) : 150;
  const bolaX = ultima ? xDe(ultima.bola) : vez === 'chutar' ? xDe(canto) : 150;
  const bolaY = ultima ? (ultima.saida === 'fora' ? 4 : 52) : 140;
  return (
    <div className="futebol-penaltis">
      <p className="futebol-fim-titulo">{t('Pênaltis')}</p>
      <div className="futebol-penaltis-placar" aria-label={`${meus.filter(Boolean).length} × ${deles.filter(Boolean).length}`}>
        {bolinhas(meus, COR_DO_TIME[0])}
        {bolinhas(deles, COR_DO_TIME[1])}
      </div>
      <svg viewBox="0 0 300 160" className="futebol-penaltis-cena" aria-hidden="true">
        <rect x="0" y="0" width="300" height="160" fill="#5fa04e" />
        <rect x="15" y="20" width="270" height="70" fill="#e8f0e4" opacity="0.35" />
        <rect x="15" y="20" width="270" height="70" fill="none" stroke="#fff" strokeWidth="5" />
        {vez === 'chutar' && !ultima && <rect x={xDe(canto) - 40} y="22" width="80" height="66" fill="#ffd166" opacity="0.35" />}
        {/* o goleiro: um bloco com orelhas, da cor do outro time quando quem joga chuta, da minha quando defendo */}
        <g transform={`translate(${goleiroX}, 70)`} className="futebol-penaltis-goleiro">
          <rect x="-14" y="-24" width="28" height="36" rx="8" fill={vez === 'chutar' || ultima?.minha ? COR_DO_TIME[1] : COR_DO_TIME[0]} />
          <rect x="-10" y="-40" width="6" height="18" rx="3" fill="#f4efe6" />
          <rect x="4" y="-40" width="6" height="18" rx="3" fill="#f4efe6" />
        </g>
        <circle cx={bolaX} cy={bolaY} r="8" fill="#fff" stroke="#333" strokeWidth="2" className="futebol-penaltis-bola" />
      </svg>
      <p className="minijogo-situacao" role="status">
        {ultima ? (ultima.saida === 'gol' ? t('Gol!') : ultima.saida === 'defesa' ? t('Defendeu!') : t('Fora!')) : ' '}
      </p>
      {vez === 'chutar' && (
        <div className="futebol-penaltis-forca" aria-hidden="true">
          <span className="futebol-penaltis-zona fraca" style={{ width: `${FRACA * 100}%` }} />
          <span className="futebol-penaltis-zona forte" style={{ left: `${FORTE * 100}%`, width: `${(ALTA - FORTE) * 100}%` }} />
          <span className="futebol-penaltis-marca" style={{ left: `${forca * 100}%` }} />
        </div>
      )}
      <div className="futebol-formatos" role="group">
        {vez === 'defender' && <Hand size={18} aria-hidden="true" className="futebol-penaltis-defender" />}
        {cantos.map(({ c, icone: Icone, nome }) => (
          <button
            key={c}
            type="button"
            className={vez === 'chutar' && canto === c ? 'btn-primary' : 'btn-secondary'}
            aria-label={nome}
            title={nome}
            aria-pressed={vez === 'chutar' ? canto === c : undefined}
            disabled={esperando || fim !== null}
            onClick={() => (vez === 'chutar' ? setCanto(c) : pular(c))}
          >
            <Icone size={18} aria-hidden="true" />
          </button>
        ))}
        {vez === 'chutar' && (
          <button type="button" className="btn-primary" disabled={esperando || fim !== null} onClick={chutar}>
            {t('Chutar')}
          </button>
        )}
      </div>
    </div>
  );
}
