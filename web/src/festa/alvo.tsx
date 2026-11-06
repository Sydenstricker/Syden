import { useEffect, useState } from 'react';
import { chave } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, useRelogio, useTeclas, type PropsDoMicro } from './comum';
import './alvo.css';

// Os mesmos números do servidor (server/src/festa/alvo.ts).
const ALVO_MS = 20000;
const ALVO_VIDA_MS = 1100;
/** Quanto dura o alvo acertado caindo (só desenho: o acerto já foi). */
const CAINDO_MS = 320;

/** As figuras são do Shooting Gallery da Kenney (CC0), em web/public/festa/tiro/ com a licença. */
const FIG = `${import.meta.env.BASE_URL}festa/tiro/`;
const ALVOS = ['target_colored', 'target_red1', 'target_red2', 'target_red3'];
/** O que fica na frente de cada fileira, escondendo a haste: grama, água, grama. */
const FRENTE = ['grass1', 'water1', 'grass1'];

/**
 * Tiro ao alvo: a barraca de tiro da quermesse, com os alvos subindo numa grade 3 × 3; clique, toque, ou as teclas 1 a 9 na
 * ordem de leitura. O acerto é pela CASA inteira (o botão), como sempre foi: o tamanho do desenho não muda o que vale.
 */
function Alvo({ dados, inicio, ativo, enviar, lance }: PropsDoMicro<{ alvos?: { t: number; casa: number }[] }>) {
  const alvos = dados.alvos ?? [];
  /** Cada alvo acertado e quando (na conta da partida), para o desenho dele cair. */
  const [acertos, setAcertos] = useState<Map<number, number>>(() => new Map());
  /** Os furos dos tiros que pegaram na madeira (só desenho, os últimos). */
  const [furos, setFuros] = useState<{ casa: number; x: number; y: number; n: number }[]>([]);
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const naCasa = (casa: number) =>
    alvos.findIndex((a, i) => a.casa === casa && e >= a.t && e < a.t + ALVO_VIDA_MS && !acertos.has(i));
  const caindoNaCasa = (casa: number) => {
    for (const [i, quando] of acertos) if (alvos[i]?.casa === casa && e - quando < CAINDO_MS) return i;
    return -1;
  };
  const acertar = (casa: number, x = 50, y = 45) => {
    if (!ativo || Date.now() - inicio >= ALVO_MS) return;
    const i = naCasa(casa);
    if (i < 0) {
      tocar('clique');
      setFuros((f) => [...f.slice(-7), { casa, x, y, n: (f.at(-1)?.n ?? 0) + 1 }]);
      return;
    }
    tocar('tiro');
    const quando = Date.now() - inicio;
    setAcertos((a) => (a.has(i) ? a : new Map(a).set(i, quando)));
    // cada acerto vai na hora: o servidor confere no relógio dele que o alvo estava na tela
    lance({ i });
  };
  useEffect(() => {
    if (ativo && e >= ALVO_MS) enviar({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, e >= ALVO_MS]);
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 9) return false;
    acertar(n - 1);
    return true;
  });
  const fracao = Math.min(1, Math.max(0, e / ALVO_MS));
  const casa = (c: number) => {
    const vivo = naCasa(c);
    const caindo = vivo < 0 ? caindoNaCasa(c) : -1;
    const i = vivo >= 0 ? vivo : caindo;
    return (
      <button
        key={c}
        type="button"
        className="festa-tiro-casa"
        onPointerDown={(ev) => {
          ev.preventDefault();
          const r = ev.currentTarget.getBoundingClientRect();
          acertar(c, ((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100);
        }}
        disabled={!ativo}
      >
        {furos
          .filter((f) => f.casa === c)
          .map((f) => (
            <img
              key={f.n}
              className="festa-tiro-furo"
              src={`${FIG}shot_grey_small.png`}
              alt=""
              draggable={false}
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
            />
          ))}
        {i >= 0 && (
          <span key={i} className={`festa-tiro-alvo${caindo >= 0 ? ' caindo' : ''}`} aria-hidden="true">
            <span className="festa-tiro-placa">
              <img
                className="festa-tiro-frente"
                src={`${FIG}${ALVOS[i % ALVOS.length]}.png`}
                alt=""
                draggable={false}
              />
              <img className="festa-tiro-verso" src={`${FIG}target_back.png`} alt="" draggable={false} />
              {caindo >= 0 && <img className="festa-tiro-acerto" src={`${FIG}shot_brown_large.png`} alt="" draggable={false} />}
            </span>
            <img className="festa-tiro-haste" src={`${FIG}stick_wood.png`} alt="" draggable={false} />
          </span>
        )}
        <small aria-hidden="true">{c + 1}</small>
      </button>
    );
  };
  return (
    <div className="festa-alvo">
      <div className="festa-alvo-topo">
        <span className="festa-mostrador">🥕 × {acertos.size}</span>
        <span className="festa-alvo-tempo" aria-hidden="true">
          <span style={{ width: `${(1 - fracao) * 100}%` }} />
        </span>
      </div>
      <div className="festa-tiro" style={{ backgroundImage: `url("${FIG}bg_wood.png")` }}>
        <img className="festa-tiro-cortina esq" src={`${FIG}curtain.png`} alt="" draggable={false} />
        <img className="festa-tiro-cortina dir" src={`${FIG}curtain.png`} alt="" draggable={false} />
        <div className="festa-tiro-palco" style={{ cursor: `url("${FIG}crosshair_red_small.png") 21 21, crosshair` }}>
          {[0, 1, 2].map((fileira) => (
            <div key={fileira} className="festa-tiro-fileira">
              {[0, 1, 2].map((col) => casa(fileira * 3 + col))}
              <span
                className="festa-tiro-chao"
                aria-hidden="true"
                style={{ backgroundImage: `url("${FIG}${FRENTE[fileira]}.png")` }}
              />
            </div>
          ))}
        </div>
        <span
          className="festa-tiro-bambinela"
          aria-hidden="true"
          style={{ backgroundImage: `url("${FIG}curtain_straight.png")` }}
        />
      </div>
    </div>
  );
}

export default microjogoDaTela({
  id: 'alvo',
  nome: chave('Tiro ao alvo'),
  dica: chave('Acerte os alvos que aparecerem. Cada um vale um ponto.'),
  Tela: Alvo,
  valor: (v) => `🥕 × ${v}`,
  errouComValor: true,
});
