import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';
import {
  amostrar,
  fantasmaEm,
  nivelDaCarga,
  novoKart,
  PASSO,
  passo,
  passosEmMs,
  pilotoAutomatico,
  tempoLegivel,
  type Comandos,
  type Kart,
} from './corrida/fisica';
import { HORTA, montarPista, type Pista } from './corrida/pista';
import {
  cameraAtras,
  desenharChao,
  faiscas,
  figuraNoChao,
  H,
  kartNaTela,
  mapaDaPista,
  pontoNoMapa,
  prepararDesenho,
  W,
  type Desenho,
  type Figura,
} from './corrida/render';

/**
 * A CORRIDA DOS COELHOS (03/11/2026, degrau 1, pedido dele): kart de 16 bits contra o relógio, com os FANTASMAS dos
 * recordes dos amigos correndo junto. O coelho no kart é o mascote 3D renderizado em 24 ângulos
 * (e2e/pixel-art/personagem/blender/meshy/kart.py); a pista e o resto, desenhados por código (corrida/).
 *
 * A corrida roda no computador de quem joga, em passos fixos (corrida/fisica.ts), e só o resultado vai ao servidor
 * (server/src/corrida.ts): o melhor tempo e o fantasma. Os degraus seguintes, combinados com ele: a corrida ao vivo na
 * sala, e depois os itens, as copas e os troféus (do quarto, de quem ganhou; e o coletivo, do salão).
 *
 * Com a janela sem foco, o jogo PARA (a física e o relógio também): o tempo é contado em passos, e passo que não anda
 * não conta.
 */

interface Recorde {
  userId: number;
  username: string;
  nomeDeExibicao: string | null;
  tempoMs: number;
  voltas: number[];
}

interface Resultado {
  tempoMs: number;
  voltas: number[];
  recorde: boolean | null;
  anterior: number | null;
}

/** A pista, montada uma vez por página (são uns 200 ms de conta, e 20 MB que não mudam). */
let pistaPronta: Pista | null = null;
let coelhoPronto: HTMLImageElement | null = null;

const MAX_FANTASMAS = 3;
const CONTAGEM = 3 * 60;

export function JogoCorrida({ eu, aoVoltar }: { eu: number; aoVoltar: () => void }) {
  const t = useT();
  const [fase, setFase] = useState<'largada' | 'correndo' | 'fim'>('largada');
  const [recordes, setRecordes] = useState<Recorde[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [placar, setPlacar] = useState({ volta: 0, ms: 0, pausado: false });
  const canvas = useRef<HTMLCanvasElement>(null);
  const comandos = useRef<Comandos>({ acelera: false, freia: false, vira: 0, derrapa: false });
  const toque = useRef({ esquerda: false, direita: false });
  const esquerda = useRef(false);
  const direita = useRef(false);
  /** Cada "Jogar de novo" é uma corrida nova, sem voltar à tela da largada. */
  const [rodada, setRodada] = useState(0);
  const tela = useRef<HTMLDivElement>(null);
  const mapaDaLargada = useRef<HTMLCanvasElement>(null);
  const pista = HORTA.id;

  const lerRecordes = () =>
    api<{ recordes: Recorde[] }>(`/api/corrida/${pista}`)
      .then((r) => {
        setRecordes(r.recordes);
        return r.recordes;
      })
      .catch(() => {
        setRecordes([]);
        return [] as Recorde[];
      });

  // Os recordes ao abrir: os fantasmas que vêm marcados são o meu e os dos amigos logo acima de mim (o próximo alvo).
  useEffect(() => {
    void lerRecordes().then((lista) => {
      const meu = lista.findIndex((r) => r.userId === eu);
      const ate = meu < 0 ? lista.length : meu;
      const acima = lista.slice(Math.max(0, ate - (MAX_FANTASMAS - 1)), ate).map((r) => r.userId);
      setEscolhidos(new Set([...(meu >= 0 ? [eu] : []), ...acima].slice(0, MAX_FANTASMAS)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O MAPA DA LARGADA: a pista é montada já aqui (uns 300 ms, uma vez por página), e a corrida começa sem espera.
  useEffect(() => {
    if (fase !== 'largada') return;
    const quadro = requestAnimationFrame(() => {
      if (!pistaPronta) pistaPronta = montarPista(HORTA);
      const alvo = mapaDaLargada.current?.getContext('2d');
      if (alvo) {
        alvo.imageSmoothingEnabled = false;
        alvo.drawImage(mapaDaPista(pistaPronta, 112), 0, 0);
        const { x, y } = pistaPronta.largada;
        pontoNoMapa(alvo, 0, 0, 112, x, y, '#ffa24a');
      }
    });
    return () => cancelAnimationFrame(quadro);
  }, [fase]);

  // O TECLADO: setas ou WASD, Espaço (ou Shift) derrapa. Só enquanto corre, e sem rolar a página.
  useEffect(() => {
    if (fase !== 'correndo') return;
    const c = comandos.current;
    const tecla = (e: KeyboardEvent, apertada: boolean) => {
      const k = e.key.toLowerCase();
      let usou = true;
      if (k === 'arrowup' || k === 'w') c.acelera = apertada;
      else if (k === 'arrowdown' || k === 's') c.freia = apertada;
      else if (k === 'arrowleft' || k === 'a') esquerda.current = apertada;
      else if (k === 'arrowright' || k === 'd') direita.current = apertada;
      else if (k === ' ' || k === 'shift') c.derrapa = apertada;
      else usou = false;
      c.vira = (direita.current || toque.current.direita ? 1 : 0) - (esquerda.current || toque.current.esquerda ? 1 : 0);
      if (usou) e.preventDefault();
    };
    const desce = (e: KeyboardEvent) => tecla(e, true);
    const sobe = (e: KeyboardEvent) => tecla(e, false);
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    // na tela de toque não há botão de acelerar: o kart acelera sozinho, e os dedos só viram e derrapam
    if (window.matchMedia?.('(pointer: coarse)').matches) c.acelera = true;
    return () => {
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      Object.assign(c, { acelera: false, freia: false, vira: 0, derrapa: false });
    };
  }, [fase, rodada]);

  // A CORRIDA: monta a pista (uma vez), baixa os fantasmas marcados, conta 3, 2, 1 e roda até a chegada.
  useEffect(() => {
    if (fase !== 'correndo' || !canvas.current) return;
    let vivo = true;
    let quadro = 0;
    const d: Desenho = prepararDesenho(canvas.current);
    tela.current?.focus();

    void (async () => {
      if (!pistaPronta) pistaPronta = montarPista(HORTA);
      if (!coelhoPronto) {
        const img = new Image();
        img.src = `${import.meta.env.BASE_URL}corrida/coelho-kart.png`;
        await img.decode().catch(() => undefined);
        coelhoPronto = img;
      }
      d.coelho = coelhoPronto;
      const p = pistaPronta;
      const fantasmas = (
        await Promise.all(
          [...escolhidos].map((id) =>
            api<{ amostras: number[] }>(`/api/corrida/${pista}/fantasma/${id}`)
              .then((r) => r.amostras)
              .catch(() => null),
          ),
        )
      ).filter((a): a is number[] => a !== null);
      if (!vivo) return;

      const mapa = mapaDaPista(p, 56);
      const kart: Kart = novoKart(p);
      const caminho: number[] = [];
      let camAngulo = kart.angulo;
      let contagem = CONTAGEM;
      let acumulado = 0;
      let antes = performance.now();
      let fimEm = 0;
      let enviado = false;
      let tremor = 0;
      let pausado = false;

      const terminar = () => {
        enviado = true;
        const voltas = kart.voltas.slice();
        const tempoMs = passosEmMs(voltas[voltas.length - 1]);
        setResultado({ tempoMs, voltas: voltas.map(passosEmMs), recorde: null, anterior: null });
        setFase('fim');
        api<{ recorde: boolean; anterior: number | null; tempoMs: number }>(`/api/corrida/${pista}`, {
          method: 'POST',
          body: { voltas, amostras: caminho },
        })
          .then((r) => {
            setResultado({ tempoMs: r.tempoMs, voltas: voltas.map(passosEmMs), recorde: r.recorde, anterior: r.anterior });
            void lerRecordes();
          })
          .catch((e) => setErro((e as Error).message));
      };

      const andar = () => {
        if (contagem > 0) {
          contagem--;
          return;
        }
        // o fantasma guarda do primeiro passo até o da chegada (o servidor confere: uma amostra a cada AMOSTRA passos)
        const jaTinhaChegado = kart.terminou;
        // o piloto automático dos testes de tela (e2e/corrida.mjs), só no site de desenvolvimento
        const auto = import.meta.env.DEV && (window as { corridaPilotoAutomatico?: boolean }).corridaPilotoAutomatico;
        passo(kart, auto ? pilotoAutomatico(kart, p, true) : comandos.current, p);
        if (!jaTinhaChegado) amostrar(kart, caminho);
        if (kart.bateu) tremor = 6;
        // a câmera vai atrás do rumo, puxada um pouco para o nariz: na derrapagem, o kart aparece virado
        const alvo = kart.rumo + (kart.angulo - kart.rumo) * 0.35;
        let dif = alvo - camAngulo;
        while (dif > Math.PI) dif -= 2 * Math.PI;
        while (dif < -Math.PI) dif += 2 * Math.PI;
        camAngulo += dif * Math.min(1, 7 * PASSO);
      };

      const desenhar = () => {
        const cam = cameraAtras(kart.x, kart.y, camAngulo);
        desenharChao(d, p, cam);
        const figuras: Figura[] = [];
        for (const o of p.objetos) {
          const f = figuraNoChao(d, cam, o.tipo, o.x, o.y, o.tipo === 'arvore' ? 2.6 : o.tipo === 'cenoura' ? 1 : 0.8);
          if (f) figuras.push(f);
        }
        const n = Math.max(0, kart.passos);
        for (const amostras of fantasmas) {
          const g = fantasmaEm(amostras, n);
          if (!g) continue;
          const f = kartNaTela(d, cam, g.x, g.y, g.angulo, 0, { fantasma: true });
          if (f) figuras.push(f);
        }
        const eu_ = kartNaTela(d, cam, kart.x, kart.y, kart.angulo, kart.pulo, { tremor: tremor > 0 ? (tremor % 2 ? 1 : -1) : 0 });
        if (eu_) figuras.push({ ...eu_, z: eu_.z - 0.01 });
        figuras.sort((a, b) => b.z - a.z);
        for (const f of figuras) f.desenhar(d.ctx);
        if (kart.deriva !== 0 || kart.turbo > 0) {
          faiscas(d.ctx, W / 2, 168, kart.turbo > 0 ? 2 : nivelDaCarga(kart), performance.now() / 1000, kart.deriva);
        }
        // o mapa pequeno no canto: os fantasmas em cinza, a pessoa em laranja
        d.ctx.globalAlpha = 0.85;
        d.ctx.drawImage(mapa, W - 60, H - 60);
        d.ctx.globalAlpha = 1;
        for (const amostras of fantasmas) {
          const g = fantasmaEm(amostras, n);
          if (g) pontoNoMapa(d.ctx, W - 60, H - 60, 56, g.x, g.y, '#c8c0cc');
        }
        pontoNoMapa(d.ctx, W - 60, H - 60, 56, kart.x, kart.y, '#ffa24a');
        if (contagem > 0 || kart.passos < 40) semaforo(d.ctx, contagem);
        if (pausado) {
          d.ctx.fillStyle = '#140e188c';
          d.ctx.fillRect(0, 0, W, H);
          d.ctx.fillStyle = '#f4ead8';
          d.ctx.fillRect(W / 2 - 12, H / 2 - 14, 8, 28);
          d.ctx.fillRect(W / 2 + 4, H / 2 - 14, 8, 28);
        }
      };

      const ciclo = (agora: number) => {
        if (!vivo) return;
        const dt = Math.min(0.1, (agora - antes) / 1000);
        antes = agora;
        pausado = document.hidden || !document.hasFocus();
        if (!pausado) {
          acumulado += dt;
          while (acumulado >= PASSO) {
            andar();
            acumulado -= PASSO;
            if (tremor > 0) tremor--;
          }
        }
        desenhar();
        setPlacar((a) => {
          const volta = Math.min(p.def.voltas, kart.volta + 1);
          const ms = passosEmMs(kart.terminou ? kart.voltas[kart.voltas.length - 1] : kart.passos);
          return a.volta === volta && Math.floor(a.ms / 10) === Math.floor(ms / 10) && a.pausado === pausado ? a : { volta, ms, pausado };
        });
        if (kart.terminou && !fimEm) fimEm = agora;
        if (fimEm && agora - fimEm > 1600 && !enviado) terminar();
        quadro = requestAnimationFrame(ciclo);
      };
      quadro = requestAnimationFrame(ciclo);
    })();
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase === 'largada', rodada]);

  const meu = recordes?.find((r) => r.userId === eu) ?? null;
  const outros = recordes?.filter((r) => r.userId !== eu) ?? [];
  const nome = (r: Recorde) => r.nomeDeExibicao || r.username;
  const alternar = (id: number) =>
    setEscolhidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < MAX_FANTASMAS) n.add(id);
      return n;
    });
  const tocar = (lado: 'esquerda' | 'direita', apertado: boolean) => {
    toque.current[lado] = apertado;
    const c = comandos.current;
    c.vira = (direita.current || toque.current.direita ? 1 : 0) - (esquerda.current || toque.current.esquerda ? 1 : 0);
  };

  return (
    <div className="corrida">
      {fase === 'largada' && (
        <div className="corrida-largada">
          <div className="corrida-pista">
            <canvas ref={mapaDaLargada} width={112} height={112} aria-hidden="true" />
            <div className="corrida-pista-nome">
              <strong>{t('Horta')}</strong>
              {meu && <span>{t('Seu recorde: {tempo}', { tempo: tempoLegivel(meu.tempoMs) })}</span>}
              <p className="settings-hint">{t('Setas para dirigir, Espaço para derrapar e carregar o turbo.')}</p>
            </div>
          </div>
          {recordes !== null && (
            <fieldset className="corrida-fantasmas">
              <legend>{t('Correr contra')}</legend>
              {recordes.length === 0 || (outros.length === 0 && !meu) ? null : (
                <ul>
                  {recordes.map((r) => (
                    <li key={r.userId}>
                      <label>
                        <input
                          type="checkbox"
                          checked={escolhidos.has(r.userId)}
                          disabled={!escolhidos.has(r.userId) && escolhidos.size >= MAX_FANTASMAS}
                          onChange={() => alternar(r.userId)}
                        />
                        <span className="corrida-quem">{nome(r)}</span>
                        <span className="corrida-tempo">{tempoLegivel(r.tempoMs)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {outros.length === 0 && <p className="settings-hint">{t('Nenhum amigo correu nesta pista ainda.')}</p>}
            </fieldset>
          )}
          <div className="minijogo-acoes">
            <button type="button" className="btn-primary" onClick={() => setFase('correndo')}>
              {t('Começar')}
            </button>
            <button type="button" className="btn-secondary" onClick={aoVoltar}>
              {t('Outros jogos')}
            </button>
          </div>
        </div>
      )}

      {fase !== 'largada' && (
        <div className="corrida-tela" ref={tela} tabIndex={-1}>
          <canvas ref={canvas} width={W} height={H} />
          {fase === 'correndo' && (
            <div className="corrida-placar" aria-live="off">
              <span>🏁 {placar.volta}/{HORTA.voltas}</span>
              <span className="corrida-relogio">{tempoLegivel(placar.ms)}</span>
            </div>
          )}
          {fase === 'correndo' && (
            <div className="corrida-toque">
              <button
                type="button"
                aria-label={t('Virar para a esquerda')}
                onPointerDown={() => tocar('esquerda', true)}
                onPointerUp={() => tocar('esquerda', false)}
                onPointerCancel={() => tocar('esquerda', false)}
                onPointerLeave={() => tocar('esquerda', false)}
              >
                ◀
              </button>
              <button
                type="button"
                aria-label={t('Derrapar')}
                onPointerDown={() => (comandos.current.derrapa = true)}
                onPointerUp={() => (comandos.current.derrapa = false)}
                onPointerCancel={() => (comandos.current.derrapa = false)}
              >
                ⤴
              </button>
              <button
                type="button"
                aria-label={t('Virar para a direita')}
                onPointerDown={() => tocar('direita', true)}
                onPointerUp={() => tocar('direita', false)}
                onPointerCancel={() => tocar('direita', false)}
                onPointerLeave={() => tocar('direita', false)}
              >
                ▶
              </button>
            </div>
          )}
          {fase === 'fim' && resultado && (
            <div className="corrida-fim">
              {resultado.recorde && <strong className="corrida-recorde">{t('Novo recorde!')}</strong>}
              <span className="corrida-relogio grande">{tempoLegivel(resultado.tempoMs)}</span>
              <ol className="corrida-voltas">
                {resultado.voltas.map((v, i) => (
                  <li key={i}>
                    🏁 {i + 1} · {tempoLegivel(v - (i ? resultado.voltas[i - 1] : 0))}
                  </li>
                ))}
              </ol>
              {resultado.recorde === false && resultado.anterior !== null && (
                <span className="settings-hint">{t('Seu recorde: {tempo}', { tempo: tempoLegivel(resultado.anterior) })}</span>
              )}
              <div className="minijogo-acoes">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setResultado(null);
                    setFase('correndo');
                    setRodada((r) => r + 1);
                  }}
                >
                  {t('Jogar de novo')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setFase('largada')}>
                  {t('Correr contra')}
                </button>
                <button type="button" className="btn-secondary" onClick={aoVoltar}>
                  {t('Outros jogos')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {erro && <p className="form-error small">{erro}</p>}
    </div>
  );
}

/** O semáforo da largada: três luzes vermelhas que acendem uma a uma, e as três verdes na hora de sair. */
function semaforo(ctx: CanvasRenderingContext2D, contagem: number) {
  const acesas = contagem > 0 ? Math.min(3, 3 - Math.floor((contagem - 1) / 60)) : 3;
  const verde = contagem === 0;
  const x0 = W / 2 - 27, y0 = 14;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x0 - 4, y0 - 4, 62, 22);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(x0 - 3, y0 - 3, 60, 20);
  for (let i = 0; i < 3; i++) {
    const cx = x0 + 7 + i * 20;
    ctx.fillStyle = verde ? '#7ed060' : i < acesas ? '#e85a4a' : '#5a2a2a';
    ctx.fillRect(cx - 6, y0 + 1, 12, 12);
    ctx.fillStyle = verde ? '#c8f4a8' : i < acesas ? '#ffb0a0' : '#6a3434';
    ctx.fillRect(cx - 4, y0 + 3, 4, 4);
  }
}
