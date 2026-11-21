import { ChevronLeft, ChevronRight, Lightbulb, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { ALTURA, desenharTabuleiro, faiscasEm, LARGURA, PECA, type Enfeites } from './desenho';
import { COLUNAS, LIMPANDO, LINHAS, PARADO, passo, PASSOS_POR_SEGUNDO, podeTrocar, VAZIO, type Estado } from './sim';
import { LICOES_DA_CADEIA, montarLicao } from './treino';

/**
 * O TREINO DA CADEIA (21/11/2026): uma lição por vez (treino.ts). Tocar numa peça e depois na vizinha do lado troca as duas; a
 * lâmpada mostra a troca da lição. A partida anda aqui, com a regra de sempre, e no fim diz a cadeia que saiu. Sem servidor,
 * sem recorde e sem relógio de pressa.
 */
export function TreinoDaCadeia({ aoVoltar }: { aoVoltar: () => void }) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const [indice, setIndice] = useState(0);
  const [versao, setVersao] = useState(0);
  const [dica, setDica] = useState(false);
  const [resultado, setResultado] = useState<number | null>(null);
  const caixa = useRef<{ e: Estado; l: number; c: number; escolhida: { l: number; c: number } | null; jogou: boolean; parado: number; avisos: Enfeites['avisos']; faiscas: NonNullable<Enfeites['faiscas']> } | null>(null);
  const dicaRef = useRef(dica);
  dicaRef.current = dica;

  useEffect(() => {
    const m = montarLicao(indice);
    caixa.current = { ...m, escolhida: null, jogou: false, parado: 0, avisos: [], faiscas: [] };
    setResultado(null);
    const ctx = tela.current?.getContext('2d');
    if (!ctx) return;
    let id = 0;
    let ultimo = performance.now();
    let acumulado = 0;
    let cadeiaAntes = 1;
    const quadro = () => {
      id = requestAnimationFrame(quadro);
      const k = caixa.current;
      if (!k) return;
      const agora = performance.now();
      acumulado = Math.min(0.25, acumulado + (agora - ultimo) / 1000);
      ultimo = agora;
      while (k.jogou && acumulado >= 1 / PASSOS_POR_SEGUNDO) {
        acumulado -= 1 / PASSOS_POR_SEGUNDO;
        passo(k.e);
        if (k.e.cadeiaAtual > cadeiaAntes && k.e.cadeiaAtual >= 2) {
          tocar('combo');
          k.avisos.push({ texto: `×${k.e.cadeiaAtual}`, x: LARGURA / 2, y: ALTURA / 2, idade: 0 });
          k.faiscas.push(...faiscasEm(LARGURA / 2, ALTURA / 2, 6 * k.e.cadeiaAtual));
        }
        cadeiaAntes = k.e.cadeiaAtual;
        // tudo parado: a jogada acabou, e a tela diz a cadeia
        const parado = k.e.tipo.every((x, i) => x === VAZIO || k.e.estado[i] === PARADO) && k.e.cadeia.every((x) => !x);
        k.parado = parado ? k.parado + 1 : 0;
        if (k.parado > 20) {
          k.jogou = false;
          setResultado(k.e.maiorCadeia);
          tocar(k.e.maiorCadeia >= 2 ? 'medalha' : 'erro');
        }
      }
      if (!k.jogou) acumulado = 0;
      for (const a of k.avisos) a.idade++;
      k.avisos = k.avisos.filter((a) => a.idade < 60);
      for (const f of k.faiscas) {
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.05;
        f.idade++;
      }
      k.faiscas = k.faiscas.filter((f) => f.idade < 40);
      const mostrar = dicaRef.current && !k.jogou && resultadoVazio(k.e);
      desenharTabuleiro(ctx, k.e, {
        cursor: mostrar ? { l: k.l, c: k.c } : null,
        escolhida: k.escolhida,
        avisos: k.avisos,
        contagem: null,
        apagado: false,
        faiscas: k.faiscas,
      });
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  }, [indice, versao]);

  const tocou = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const k = caixa.current;
    const r = tela.current?.getBoundingClientRect();
    if (!k || !r || k.jogou || resultado !== null) return;
    const l = Math.floor((((ev.clientY - r.top) / r.height) * ALTURA) / PECA);
    const c = Math.floor((((ev.clientX - r.left) / r.width) * LARGURA) / PECA);
    if (l < 0 || l >= LINHAS || c < 0 || c >= COLUNAS) return;
    const a = k.escolhida;
    if (a && a.l === l && Math.abs(a.c - c) === 1 && podeTrocar(k.e, l, Math.min(a.c, c))) {
      k.escolhida = null;
      k.jogou = true;
      passo(k.e, [[k.e.passo, 0, l, Math.min(a.c, c)]]);
      tocar('clique');
      return;
    }
    k.escolhida = k.e.tipo[l * COLUNAS + c] === VAZIO ? null : { l, c };
  };

  const recomecar = () => {
    setDica(false);
    setVersao((v) => v + 1);
  };
  const ir = (d: number) => {
    setDica(false);
    setIndice((i) => (i + d + LICOES_DA_CADEIA.length) % LICOES_DA_CADEIA.length);
  };
  const meta = LICOES_DA_CADEIA[indice].cadeia;
  return (
    <div className="blocos-treino" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <p className="minijogo-situacao">
        {t('Lição {n} de {total}', { n: indice + 1, total: LICOES_DA_CADEIA.length })} · {t('Faça uma cadeia ×{n} com uma troca.', { n: meta })}
      </p>
      <canvas ref={tela} className="blocos-tela" width={LARGURA} height={ALTURA} onPointerDown={tocou} />
      {resultado !== null && (
        <p className="minijogo-situacao" style={resultado >= meta ? { color: '#7fd18b' } : undefined}>
          {resultado >= 2 ? t('Cadeia ×{n}!', { n: resultado }) : t('Sem cadeia. Tente outra troca.')}
        </p>
      )}
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={() => ir(-1)} aria-label={t('Anterior')}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className={dica ? 'btn-primary' : 'btn-secondary'} aria-pressed={dica} onClick={() => setDica((d) => !d)} aria-label={t('Mostrar a jogada')} title={t('Mostrar a jogada')}>
          <Lightbulb size={18} aria-hidden="true" />
        </button>
        <button type="button" className="btn-secondary" onClick={recomecar} aria-label={t('De novo')} title={t('De novo')}>
          <RotateCcw size={18} aria-hidden="true" />
        </button>
        <button type="button" className="btn-secondary" onClick={() => ir(1)} aria-label={t('Próxima')}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Voltar')}
        </button>
      </div>
    </div>
  );
}

/** Nada sumindo ainda (a dica só aparece antes da troca). */
function resultadoVazio(e: Estado) {
  return !e.estado.some((s) => s === LIMPANDO);
}
