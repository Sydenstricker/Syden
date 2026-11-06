import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Mascote } from '../Mascote';
import type { AcoesDoSalao } from '../Salao';
import { temWebGL } from '../quarto3d/Quarto3D';
import type { CenaDoSalao3D } from './cena';
import { type Epoca, epocaDoDia } from './epocas';
import './salao3d.css';

/** Uma pessoa na call, para o salão 3D: o papel decide o lugar, e o avatar pronto, as cores. */
export interface PessoaNoSalao3DDeFora {
  id: number;
  nome: string;
  papel: 'call' | 'transmitindo' | 'jogando';
  avatar: number | null;
}

/**
 * A época do salão: pela data do aparelho (epocas.ts). SÓ NO SITE DE DESENVOLVIMENTO, para ver antes de dezembro: `?natal` no
 * endereço (ou `window.salao3dNatal = true` antes de abrir o salão) mostra o Natal; `?sem-epoca` (ou `false`) tira.
 */
function epocaAgora(): Epoca | null {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.has('natal')) return 'natal';
    if (q.has('sem-epoca')) return null;
    const w = (window as { salao3dNatal?: boolean }).salao3dNatal;
    if (w === true) return 'natal';
    if (w === false) return null;
  }
  return epocaDoDia();
}

/**
 * A CAIXA DO SALÃO 3D (cena.ts), no início da comunidade. Como o Quarto3D.tsx: o three.js e os modelos vêm num pedaço à parte, só
 * quando o 3D abre; o mascote espera enquanto carrega (sem texto); sem WebGL, um modelo que não veio, o contexto da placa perdido
 * ou 20 s sem ficar pronto, `aoFalhar` e volta o pixel art. As funções são as do salão de pixel art (`acoes`, de
 * InicioDaComunidade.tsx); o recado do balcão é um balão aqui fora, em cima do coelho que o dá.
 */
export function Salao3D({
  noite,
  acoes,
  pessoas,
  aoVivo,
  recado,
  imagem,
  titulo,
  aoFalhar,
}: {
  noite: boolean;
  acoes: AcoesDoSalao;
  pessoas: PessoaNoSalao3DDeFora[];
  aoVivo: { nome: string; sub: string; total: number; aoTrocar: (passo: 1 | -1) => void } | null;
  recado: { titulo: string; texto: string } | null;
  imagem: { url: string; encaixe: string } | null;
  titulo: string;
  aoFalhar: () => void;
}) {
  const t = useT();
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaDoSalao3D | null>(null);
  const modulo = useRef<typeof import('./cena') | null>(null);
  const [pronta, setPronta] = useState(false);
  const [etiqueta, setEtiqueta] = useState<{ id: string; x: number; y: number } | null>(null);
  const [rotulos, setRotulos] = useState<{ id: number; nome: string; x: number; y: number }[]>([]);
  const [recadoAberto, setRecadoAberto] = useState(false);
  const [pontos, setPontos] = useState<{ recado: { x: number; y: number } | null; tv: { x: number; y: number } | null }>({ recado: null, tv: null });
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;
  const falhar = useRef(aoFalhar);
  falhar.current = aoFalhar;
  const temRecado = useRef(!!recado);
  temRecado.current = !!recado;

  const medirPontos = () => {
    const c = cena.current;
    if (!c) return;
    setRotulos(c.rotulos());
    setPontos({ recado: c.pontoDaFuncao('balcao'), tv: c.pontoDaFuncao('tv') });
  };

  useEffect(() => {
    if (!caixa.current) return;
    let viva = true;
    let criada: CenaDoSalao3D | null = null;
    const desistir = (motivo?: unknown) => {
      if (!viva) return;
      if (motivo) console.warn('O salão 3D não abriu; fica o pixel art.', motivo);
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
        modulo.current = m;
        criada = new m.CenaDoSalao3D(
          caixa.current,
          {
            aoFuncao: (id) => {
              // o balcão (ou o coelho dele) abre o balão do recado; o resto é a função do salão
              if (id === 'balcao') setRecadoAberto((a) => !a && temRecado.current);
              acoesRef.current[id as keyof AcoesDoSalao]?.onClick();
            },
            aoPassar: setEtiqueta,
            temFuncao: (id) => !!acoesRef.current[id as keyof AcoesDoSalao],
            aoMudarRotulos: () => requestAnimationFrame(medirPontos),
          },
          epocaAgora(),
        );
        caixa.current.querySelector('canvas')?.addEventListener('webglcontextlost', () => desistir('a placa perdeu o contexto'));
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

  const pessoasJson = JSON.stringify(pessoas.slice(0, 12));
  useEffect(() => {
    const c = cena.current;
    const m = modulo.current;
    if (!c || !m) return;
    c.definirPessoas((JSON.parse(pessoasJson) as PessoaNoSalao3DDeFora[]).map((p) => ({ ...p, cores: m.coresDoAvatar(p.avatar) })));
  }, [pessoasJson, pronta]);

  const tv = aoVivo ? JSON.stringify({ rotulo: t('Ao vivo'), nome: aoVivo.nome, sub: aoVivo.sub }) : null;
  useEffect(() => cena.current?.definirTv(tv ? JSON.parse(tv) : null), [tv, pronta]);

  const imagemJson = JSON.stringify(imagem);
  useEffect(() => cena.current?.definirImagem(JSON.parse(imagemJson)), [imagemJson, pronta]);

  useEffect(() => {
    if (!recado) setRecadoAberto(false);
  }, [recado]);
  useEffect(() => {
    cena.current?.definirRecadoAberto(recadoAberto);
    if (recadoAberto) medirPontos();
  }, [recadoAberto, pronta]);

  const acao = etiqueta ? acoes[etiqueta.id as keyof AcoesDoSalao] : undefined;
  const funcoes = Object.entries(acoes).filter((e): e is [string, NonNullable<(typeof e)[1]>] => !!e[1] && e[0] !== 'janela');
  return (
    <div className="salao3d" aria-label={titulo} role="group">
      <div ref={caixa} className={'salao3d-caixa' + (pronta ? '' : ' escondida')} />
      {!pronta && (
        <div className="quarto3d-espera" aria-hidden="true">
          <Mascote nome="ocioso" tamanho={180} />
        </div>
      )}
      {pronta &&
        rotulos.map((r) => (
          <span key={r.id} className="salao3d-nome" style={{ left: r.x, top: r.y }} aria-hidden="true">
            {r.nome}
          </span>
        ))}
      {pronta && acao && !(recadoAberto && etiqueta?.id === 'balcao') && (
        <span className="quarto3d-etiqueta salao3d-etiqueta" style={{ left: etiqueta!.x, top: etiqueta!.y }} aria-hidden="true">
          {acao.rotulo}
          {acao.sub && <small>{acao.sub}</small>}
        </span>
      )}
      {pronta && recadoAberto && recado && pontos.recado && (
        <div className="salao3d-recado" style={{ left: pontos.recado.x, top: pontos.recado.y }} role="dialog" aria-label={recado.titulo}>
          <button type="button" className="salao3d-recado-fechar" aria-label={t('Fechar')} title={t('Fechar')} onClick={() => setRecadoAberto(false)}>
            ×
          </button>
          <strong>{recado.titulo}</strong>
          <p>{recado.texto}</p>
        </div>
      )}
      {pronta && aoVivo && aoVivo.total > 1 && pontos.tv && (
        <div className="salao3d-canais" style={{ left: pontos.tv.x, top: pontos.tv.y }}>
          <button type="button" aria-label={t('Transmissão anterior')} title={t('Transmissão anterior')} onClick={() => aoVivo.aoTrocar(-1)}>
            ‹
          </button>
          <button type="button" aria-label={t('Próxima transmissão')} title={t('Próxima transmissão')} onClick={() => aoVivo.aoTrocar(1)}>
            ›
          </button>
        </div>
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
