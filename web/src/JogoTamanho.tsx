import { useEffect, useRef, useState, type PointerEvent as EventoDoPonteiro } from 'react';
import { idiomaAtual, useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import { FIGURAS_DO_TAMANHO } from './figurasDoTamanho';
import { CATEGORIAS_DO_TAMANHO, NA_DIAGONAL, OBJETOS, PARTE_MEDIDA, primeiraForma, SETA_DA_MEDIDA, tamanhoLegivel, type EstadoTamanho, type Medida, type Partida } from './minijogos';

const ESTIMANDO_MS = 25_000;
const REVELANDO_MS = 7_000;
/** O palco tem esta altura; o mais alto ocupa ela quase inteira. */
const ALTURA_DO_PALCO = 240;
const FOLGA_EM_CIMA = 16;
/** Cada objeto fica no meio da sua metade do palco, e não passa dela menos esta folga. */
const FOLGA_DO_LADO = 12;
/** O menor nunca some: abaixo disto ele vira um ponto que ainda se vê. */
const MENOR_NA_TELA = 5;
/** O palpite vai de 1/50 a 50 vezes a referência (o servidor corta no mesmo lugar). */
const LIMITE = Math.log(50);
/** Arrastar 120 pixels dobra (ou divide por dois) o objeto. */
const PIXELS_PARA_DOBRAR = 120;
/** O palpite vai ao servidor enquanto a pessoa mexe, mas não a cada pixel. */
const ESPERA_PARA_MANDAR = 400;

const limitar = (log: number) => Math.min(LIMITE, Math.max(-LIMITE, log));

const figura = (id: string) => `${import.meta.env.BASE_URL}tamanho/${id}.png`;

/**
 * A largura e a altura, em centímetros, de um objeto cuja `medida` vale `cm`. A figura já vem sem borda, então
 * a altura do desenho é a altura do objeto, a largura é o comprimento (ou o diâmetro), e a diagonal é o
 * comprimento do que foi desenhado deitado na diagonal (e PARTE_MEDIDA desconta o que sobra, como o anel).
 */
function emCentimetros(id: string, medida: Medida, cm: number) {
  const [largura, altura] = FIGURAS_DO_TAMANHO[id] ?? [1, 1];
  const medido = (NA_DIAGONAL.has(id) ? Math.hypot(largura, altura) : medida === 'altura' ? altura : largura) * (PARTE_MEDIDA[id] ?? 1);
  return { largura: (largura * cm) / medido, altura: (altura * cm) / medido };
}

/**
 * O "QUAL É O TAMANHO?" (o Size It Up do Syden; regras em server/src/minijogos.ts). À esquerda a referência,
 * com o tamanho dito; à direita o objeto, que cada um aumenta e diminui na própria tela — arrastando para
 * cima e para baixo, com a roda do mouse ou pela barra — até achar que acertou. Na revelação o objeto vai
 * para o tamanho de verdade, e o meu palpite fica por cima, como silhueta (como no Size It Up).
 *
 * O palpite é guardado em LOGARITMO: dobrar e dividir por dois são passos do mesmo tamanho, como o erro que
 * dá os pontos.
 */
export function JogoTamanho({
  estado,
  eu,
  restante,
  agir,
}: {
  estado: EstadoTamanho & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const locale = idiomaAtual();
  const revelando = estado.fase === 'revelando';
  const confirmei = estado.confirmaram.includes(eu);
  // O que eu mexi vale só na rodada em que mexi; na nova, o objeto começa do tamanho da referência (ou do
  // palpite que o servidor guardou, para quem fechou o painel e voltou).
  const [mexido, setMexido] = useState<{ rodada: number; log: number } | null>(null);
  const log = mexido?.rodada === estado.rodada ? mexido.log : Math.log(estado.meuPalpite ?? 1);
  const arrasto = useRef<{ y: number; log: number } | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const [larguraDoPalco, setLarguraDoPalco] = useState(480);
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setLarguraDoPalco(entrada.contentRect.width));
    observador.observe(el);
    return () => observador.disconnect();
  }, [estado.terminada]);
  const envio = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O envio atrasado não pode chegar depois da revelação: o servidor recusaria, e o erro apareceria à toa.
  const fase = useRef(estado.fase);
  fase.current = estado.fase;
  useEffect(
    () => () => {
      if (envio.current) clearTimeout(envio.current);
    },
    [],
  );

  if (estado.terminada) {
    return <Placar eu={eu} linhas={estado.placar.map((l) => ({ ...l, valor: String(l.pontos) }))} />;
  }

  const travado = revelando || confirmei;
  const mudar = (novo: number) => {
    if (travado) return;
    const valor = limitar(novo);
    setMexido({ rodada: estado.rodada, log: valor });
    if (envio.current) clearTimeout(envio.current);
    envio.current = setTimeout(() => {
      if (fase.current === 'estimando') agir({ tipo: 'palpite', razao: Math.exp(valor) });
    }, ESPERA_PARA_MANDAR);
  };
  const confirmar = () => {
    if (envio.current) clearTimeout(envio.current);
    agir({ tipo: 'palpite', razao: Math.exp(log), confirmar: true });
  };

  const palpite = Math.exp(log);
  const ref = estado.referencia;
  const obj = estado.objeto;
  // Os tamanhos de verdade, em centímetros: a referência, o meu palpite e, na revelação, o objeto.
  const daRef = emCentimetros(ref.id, ref.medida, ref.cm);
  const doPalpite = emCentimetros(obj.id, obj.medida, ref.cm * palpite);
  const deVerdade = revelando && obj.cm !== undefined ? emCentimetros(obj.id, obj.medida, obj.cm) : null;
  const todos = [daRef, doPalpite, ...(deVerdade ? [deVerdade] : [])];
  // A escala (pixels por centímetro) é uma só para todos: o palco "afasta a câmera" quando o objeto cresce.
  const metade = larguraDoPalco / 2 - FOLGA_DO_LADO;
  const escala = Math.min(
    (ALTURA_DO_PALCO - FOLGA_EM_CIMA) / Math.max(...todos.map((o) => o.altura)),
    metade / Math.max(...todos.map((o) => o.largura)),
  );
  /** Onde e de que tamanho desenhar, no meio da metade `lado` (0 = esquerda). */
  const caixa = (o: { largura: number; altura: number }, lado: 0 | 1) => {
    const minimo = Math.max(1, MENOR_NA_TELA / Math.min(o.largura * escala, o.altura * escala));
    const largura = o.largura * escala * minimo;
    const altura = o.altura * escala * minimo;
    return { width: largura, height: altura, left: (larguraDoPalco / 4) * (lado === 0 ? 1 : 3) - largura / 2 };
  };
  const medida = (cm: number, como: Medida) => `${SETA_DA_MEDIDA[como]} ${tamanhoLegivel(cm, locale)}`;
  const nomeDe = (userId: number) => estado.placar.find((l) => l.userId === userId)?.username ?? '?';
  const meus = estado.palpites?.find((p) => p.userId === eu);

  const segurar = (e: EventoDoPonteiro<HTMLDivElement>) => {
    if (travado) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { y: e.clientY, log };
  };
  const arrastar = (e: EventoDoPonteiro<HTMLDivElement>) => {
    if (!arrasto.current) return;
    mudar(arrasto.current.log + ((arrasto.current.y - e.clientY) / PIXELS_PARA_DOBRAR) * Math.LN2);
  };
  const soltar = () => {
    arrasto.current = null;
  };

  return (
    <>
      <div
        ref={palco}
        className={`tamanho-palco${travado ? '' : ' mexe'}${revelando ? ' revelando' : ''}`}
        style={{ height: ALTURA_DO_PALCO }}
        onPointerDown={segurar}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onWheel={(e) => mudar(log - Math.sign(e.deltaY) * 0.08)}
      >
        <img className="tamanho-figura" src={figura(ref.id)} alt="" draggable={false} style={caixa(daRef, 0)} />
        <img className="tamanho-figura alvo" src={figura(obj.id)} alt="" draggable={false} style={{ ...caixa(deVerdade ?? doPalpite, 1), zIndex: 1 }} />
        {/* Na revelação, o MEU palpite vira a silhueta do mesmo desenho: o que sobra dela ou o que falta nela é o
            erro, à vista. Palpite maior que o objeto: a silhueta fica ATRÁS, de fundo; menor: na frente, senão
            o objeto a esconderia. */}
        {deVerdade && (
          <span
            className="tamanho-silhueta"
            aria-hidden="true"
            style={{ ...caixa(doPalpite, 1), zIndex: doPalpite.altura > deVerdade.altura ? 0 : 2 }}
          >
            <span style={{ WebkitMaskImage: `url(${figura(obj.id)})`, maskImage: `url(${figura(obj.id)})` }} />
          </span>
        )}
      </div>

      <div className="tamanho-legendas">
        <div>
          <span className="minijogo-objeto">{OBJETOS[ref.id] ? primeiraForma(t(OBJETOS[ref.id].nome)) : ref.id}</span>
          <span className="minijogo-tamanho">{medida(ref.cm, ref.medida)}</span>
        </div>
        <div>
          <span className="minijogo-objeto">{OBJETOS[obj.id] ? primeiraForma(t(OBJETOS[obj.id].nome)) : obj.id}</span>
          {/* Enquanto estima, o número acompanha o palpite: quem pensa em metros também joga. */}
          <span className={`minijogo-tamanho${revelando ? ' de-verdade' : ''}`}>
            {revelando && obj.cm !== undefined
              ? medida(obj.cm, obj.medida)
              : `${SETA_DA_MEDIDA[obj.medida]} ≈ ${tamanhoLegivel(ref.cm * palpite, locale)}`}
          </span>
        </div>
      </div>

      {!revelando && (
        <div className="tamanho-controles">
          <input
            type="range"
            min={-LIMITE}
            max={LIMITE}
            step={0.01}
            value={log}
            disabled={travado}
            aria-label={t('Arraste para aumentar ou diminuir.')}
            onChange={(e) => mudar(Number(e.target.value))}
          />
          <button type="button" className="btn-primary" disabled={travado} onClick={confirmar}>
            {t('Confirmar')}
          </button>
        </div>
      )}

      {revelando && estado.palpites && estado.palpites.length > 0 && (
        <ul className="tamanho-palpites">
          {[...estado.palpites]
            .sort((a, b) => b.pontos - a.pontos)
            .map((p) => (
              <li key={p.userId} className={p.userId === eu ? 'eu' : ''}>
                <span className="minijogo-nome">{nomeDe(p.userId)}</span>
                <span>≈ {tamanhoLegivel(ref.cm * p.palpite, locale)}</span>
                <span className="minijogo-pontos">+{p.pontos}</span>
              </li>
            ))}
        </ul>
      )}

      <Relogio restante={restante} total={revelando ? REVELANDO_MS : ESTIMANDO_MS} />

      <p className="minijogo-situacao" role="status">
        {revelando
          ? meus
            ? t('+{n} pontos', { n: meus.pontos })
            : t('Você não votou nesta.')
          : confirmei
            ? t('Confirmado. {n} de {total} já confirmaram.', {
                n: estado.confirmaram.length,
                total: Math.max(estado.placar.length, estado.confirmaram.length),
              })
            : t('Arraste para aumentar ou diminuir.')}
      </p>
    </>
  );
}

/**
 * A escolha da categoria, antes de começar (como no Size It Up). Sem texto de explicação, como a estante: cada
 * botão mostra três figuras da categoria e o nome dela. Escolher já começa para a sala inteira.
 */
export function EscolhaDeCategoria({ aoEscolher, aoVoltar }: { aoEscolher: (categoria: string) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <>
      <ul className="tamanho-categorias">
        {CATEGORIAS_DO_TAMANHO.map((categoria) => (
          <li key={categoria.id}>
            <button type="button" className="minijogo-jogo" onClick={() => aoEscolher(categoria.id)}>
              <span className="tamanho-categoria-figuras" aria-hidden="true">
                {categoria.figuras.map((id) => (
                  <img key={id} src={figura(id)} alt="" draggable={false} />
                ))}
              </span>
              <span>{t(categoria.nome)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </>
  );
}
