import { useEffect, useRef, useState, type PointerEvent as EventoDoPonteiro } from 'react';
import { idiomaAtual, useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import { FRASE_DA_MEDIDA, OBJETOS, primeiraForma, tamanhoLegivel, type EstadoTamanho, type Partida } from './minijogos';

const ESTIMANDO_MS = 25_000;
const REVELANDO_MS = 7_000;
/** O palco tem esta altura; o maior dos dois ocupa ela quase inteira (a folga é para a linha do palpite). */
const ALTURA_DO_PALCO = 220;
const ALTURA_DO_MAIOR = 196;
/** O menor nunca some: abaixo disto ele vira um ponto que ainda se vê. */
const MENOR_NA_TELA = 6;
/** O palpite vai de 1/50 a 50 vezes a referência (o servidor corta no mesmo lugar). */
const LIMITE = Math.log(50);
/** Arrastar 120 pixels dobra (ou divide por dois) o objeto. */
const PIXELS_PARA_DOBRAR = 120;
/** O palpite vai ao servidor enquanto a pessoa mexe, mas não a cada pixel. */
const ESPERA_PARA_MANDAR = 400;

const limitar = (log: number) => Math.min(LIMITE, Math.max(-LIMITE, log));

/**
 * O "QUAL É O TAMANHO?" (o Size It Up do Syden; regras em server/src/minijogos.ts). À esquerda a referência,
 * com o tamanho dito; à direita o objeto, que cada um aumenta e diminui na própria tela — arrastando para
 * cima e para baixo, com a roda do mouse ou pela barra — até achar que acertou. Na revelação o objeto vai
 * para o tamanho de verdade, e o palpite de cada um fica marcado.
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
  // Na revelação o objeto mostra o tamanho de verdade, e o palco cabe também o meu palpite (a linha tracejada).
  const mostrado = revelando && estado.real !== null ? estado.real : palpite;
  const maior = Math.max(1, mostrado, revelando ? palpite : 0);
  const altura = (razao: number) => Math.max(MENOR_NA_TELA, (ALTURA_DO_MAIOR * razao) / maior);
  const ref = estado.referencia;
  const obj = estado.objeto;
  const medida = (cm: number, frase: string) => t(frase, { tamanho: tamanhoLegivel(cm, locale) });
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
        className={`tamanho-palco${travado ? '' : ' mexe'}`}
        style={{ height: ALTURA_DO_PALCO }}
        onPointerDown={segurar}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onWheel={(e) => mudar(log - Math.sign(e.deltaY) * 0.08)}
      >
        <div className="tamanho-coluna">
          <span className="tamanho-figura" style={{ fontSize: altura(1) }} aria-hidden="true">
            {OBJETOS[ref.id]?.emoji ?? '❓'}
          </span>
        </div>
        <div className="tamanho-coluna">
          {revelando && (
            <span className="tamanho-palpite" style={{ bottom: altura(palpite) }} aria-hidden="true" />
          )}
          <span className={`tamanho-figura alvo${revelando ? ' revelado' : ''}`} style={{ fontSize: altura(mostrado) }} aria-hidden="true">
            {OBJETOS[obj.id]?.emoji ?? '❓'}
          </span>
        </div>
      </div>

      <div className="tamanho-legendas">
        <div>
          <span className="minijogo-objeto">{OBJETOS[ref.id] ? primeiraForma(t(OBJETOS[ref.id].nome)) : ref.id}</span>
          <span className="minijogo-tamanho">{medida(ref.cm, FRASE_DA_MEDIDA[ref.medida])}</span>
        </div>
        <div>
          <span className="minijogo-objeto">{OBJETOS[obj.id] ? primeiraForma(t(OBJETOS[obj.id].nome)) : obj.id}</span>
          {/* Enquanto estima, o número acompanha o palpite: quem pensa em metros também joga. */}
          <span className={`minijogo-tamanho${revelando ? ' de-verdade' : ''}`}>
            {revelando && obj.cm !== undefined
              ? medida(obj.cm, FRASE_DA_MEDIDA[obj.medida])
              : t(FRASE_DA_MEDIDA[obj.medida], { tamanho: `≈ ${tamanhoLegivel(ref.cm * palpite, locale)}` })}
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
