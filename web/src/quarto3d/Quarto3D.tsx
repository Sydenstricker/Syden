import { useEffect, useRef, useState } from 'react';
import { Mascote } from '../Mascote';
import type { AcoesDoQuarto } from '../Quarto';
import type { CenaDoQuarto3D, EstadoDoCoelho } from './cena';
import './quarto3d.css';

/**
 * A CAIXA DO QUARTO 3D (cena.ts), na home e na visita. O three.js e os modelos vêm num pedaço à parte, só quando o quarto 3D
 * abre. Enquanto carrega, o mascote espera (sem texto, como toda espera do Syden). Se não puder existir (sem WebGL, um modelo
 * que não veio, o contexto da placa perdido, ou 20 s sem ficar pronto), `aoFalhar`: quem mostra volta ao pixel art, e a tela
 * nunca fica preta.
 *
 * As funções são as mesmas do quarto de pixel art (`acoes`, de Home.tsx): a cena só diz qual objeto foi usado, depois de o
 * coelho chegar a ele, e a ação mora aqui fora. Para o teclado e o leitor de tela, as mesmas funções em botões escondidos.
 */
export function Quarto3D({
  noite,
  acoes,
  estado,
  avatar,
  titulo,
  aoFalhar,
}: {
  noite: boolean;
  acoes: AcoesDoQuarto;
  estado: EstadoDoCoelho;
  /** O avatar pronto de quem mora (na visita: null é o mascote); sem ele, o MEU coelho. */
  avatar?: number | null;
  titulo: string;
  aoFalhar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaDoQuarto3D | null>(null);
  const [pronta, setPronta] = useState(false);
  const [etiqueta, setEtiqueta] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;
  const falhar = useRef(aoFalhar);
  falhar.current = aoFalhar;
  const agora = useRef({ noite, estado, avatar });
  agora.current = { noite, estado, avatar };

  useEffect(() => {
    if (!caixa.current) return;
    let viva = true;
    let criada: CenaDoQuarto3D | null = null;
    const desistir = (motivo?: unknown) => {
      if (!viva) return;
      if (motivo) console.warn('O quarto 3D não abriu; fica o pixel art.', motivo);
      viva = false;
      criada?.destruir();
      criada = null;
      cena.current = null;
      falhar.current();
    };
    if (!temWebGL()) {
      desistir();
      return;
    }
    const prazo = setTimeout(() => desistir('20 s sem ficar pronto'), 20_000);
    import('./cena')
      .then(async (m) => {
        if (!viva || !caixa.current) return;
        criada = new m.CenaDoQuarto3D(
          caixa.current,
          {
            aoFuncao: (id) => acoesRef.current[id]?.onClick(),
            aoPassar: setEtiqueta,
            temFuncao: (id) => !!acoesRef.current[id],
          },
          agora.current.avatar !== undefined ? m.coresDoAvatar(agora.current.avatar) : undefined,
        );
        criada.definirNoite(agora.current.noite);
        criada.definirEstado(agora.current.estado);
        // a placa pode largar o contexto (o motorista reiniciou, a memória acabou): de volta ao pixel art
        caixa.current.querySelector('canvas')?.addEventListener('webglcontextlost', () => desistir('a placa perdeu o contexto'));
        if (agora.current.avatar === undefined) void m.minhasCoresDoCoelho().then((c) => viva && criada?.definirCores(c));
        await criada.montar();
        if (!viva) return;
        clearTimeout(prazo);
        cena.current = criada;
        setPronta(true);
      })
      .catch(desistir);
    return () => {
      clearTimeout(prazo);
      viva = false;
      criada?.destruir();
      cena.current = null;
    };
  }, []);

  useEffect(() => cena.current?.definirNoite(noite), [noite, pronta]);
  useEffect(() => cena.current?.definirEstado(estado), [estado, pronta]);

  const rotulo = etiqueta ? acoes[etiqueta.id]?.rotulo : undefined;
  const funcoes = Object.entries(acoes).filter((e): e is [string, NonNullable<(typeof e)[1]>] => !!e[1]);
  return (
    <div className="quarto3d" aria-label={titulo} role="group">
      <div ref={caixa} className={'quarto3d-caixa' + (pronta ? '' : ' escondida')} />
      {!pronta && (
        <div className="quarto3d-espera" aria-hidden="true">
          <Mascote nome="ocioso" tamanho={180} />
        </div>
      )}
      {pronta && rotulo && (
        <span className="quarto3d-etiqueta" style={{ left: etiqueta!.x, top: etiqueta!.y }} aria-hidden="true">
          {rotulo}
        </span>
      )}
      {pronta && (
        <div className="quarto3d-so-leitor">
          {funcoes.map(([id, a]) => (
            <button key={id} type="button" onClick={() => cena.current?.usarFuncao(id)}>
              {a.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
