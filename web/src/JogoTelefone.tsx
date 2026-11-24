import { Check, Eraser, PaintBucket, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Socket } from 'socket.io-client';
import { BALDE } from './desenho/balde';
import { ALTURA_DO_QUADRO, LARGURA_DO_QUADRO, pintarQuadro, tracosDe, type CacheDosBaldes, type TracosDoQuadro } from './desenho/quadro';
import { primeiraForma, CORES_DO_DESENHO, ESPESSURAS_DO_DESENHO, type Partida } from './minijogos';
import { useT } from './i18n';
import { Relogio } from './Minijogo';
import { tocar } from './somDosJogos';
import './jogosDePalavras.css';
import './telefone.css';

/**
 * O TELEFONE SEM FIO DO DESENHA E ADIVINHA (24/11/2026, server/src/minijogo-telefone.ts): cada um escreve uma frase, o próximo
 * desenha, o próximo escreve o que acha que o desenho é, e assim por diante; no fim, a turma vê cada corrente inteira. Só a
 * mecânica do gênero. O traço vai pelo mesmo canal do desenho de sempre, mas o servidor não o repassa: o desenho é segredo até
 * a revelação. A frase de cada um aparece como foi escrita, sem tradução.
 */

type TracoPublico = { t: number; c: number; e: number; partes: [number, number[]][] };
type PassoPublico = { tipo: 'frase'; autor: number; texto: string } | { tipo: 'desenho'; autor: number; tracos: TracoPublico[] };
export interface EstadoTelefone {
  modo: 'telefone';
  fase: 'escrevendo' | 'desenhando' | 'adivinhando' | 'mostrando' | 'fim';
  passo: number;
  passos: number;
  tarefa: 'escrever' | 'desenhar' | 'adivinhar' | null;
  tempoMs: number;
  jogadores: { userId: number; username: string; pronto: boolean }[];
  anterior: PassoPublico | null;
  meu: { texto: string; tracos: TracoPublico[] } | null;
  entregue: boolean;
  mostrando: { corrente: number; ate: number } | null;
  correntes: { dono: number; passos: PassoPublico[] }[];
}

const TAMANHO_DA_FRASE = 80;
const ENVIO_MS = 40;

/** Um desenho parado (o que se recebe para adivinhar, e os da revelação). */
function QuadroParado({ tracos, rotulo }: { tracos: TracoPublico[]; rotulo?: string }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const cache = useRef<CacheDosBaldes>({ chave: '', imagens: new Map() });
  useEffect(() => {
    const pintar = () => tela.current && pintarQuadro(tela.current, tracosDe(tracos), cache.current);
    pintar();
    window.addEventListener('resize', pintar);
    return () => window.removeEventListener('resize', pintar);
  }, [tracos]);
  return <canvas ref={tela} className="desenho-quadro telefone-parado" role="img" aria-label={rotulo} />;
}

/** O quadro de quem desenha agora: os traços ficam aqui e vão ao servidor pelo socket (que não os repassa a ninguém). */
function QuadroDoTelefone({
  inicial,
  desligado,
  agir,
  socket,
  channelId,
}: {
  inicial: TracoPublico[];
  desligado: boolean;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const tela = useRef<HTMLCanvasElement>(null);
  const tracos = useRef<TracosDoQuadro>(tracosDe(inicial));
  const cache = useRef<CacheDosBaldes>({ chave: '', imagens: new Map() });
  const [cor, setCor] = useState(0);
  const [espessura, setEspessura] = useState(1);
  const [balde, setBalde] = useState(false);
  const atual = useRef<{ t: number; i: number; pendentes: number[]; ultimo: number[] | null; relogio: ReturnType<typeof setInterval> | null } | null>(null);
  const pintar = () => tela.current && pintarQuadro(tela.current, tracos.current, cache.current);
  useEffect(() => {
    pintar();
    window.addEventListener('resize', pintar);
    return () => window.removeEventListener('resize', pintar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const juntar = (traco: { t: number; c: number; e: number }, i: number, p: number[]) => {
    const a = tracos.current.get(traco.t) ?? { c: traco.c, e: traco.e, partes: new Map() };
    a.partes.set(i, p);
    tracos.current.set(traco.t, a);
  };
  const enviar = () => {
    const a = atual.current;
    if (!a || a.pendentes.length === 0) return;
    const p = a.ultimo && a.i > 0 ? [...a.ultimo, ...a.pendentes] : a.pendentes;
    const dados = { t: a.t, i: a.i, c: cor, e: espessura, p };
    juntar(dados, a.i, p);
    socket?.emit('minijogo:tempo-real', { channelId, dados });
    a.ultimo = a.pendentes.slice(-2);
    a.pendentes = [];
    a.i++;
  };
  const ponto = (e: PointerEvent<HTMLCanvasElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - caixa.left) / caixa.width) * LARGURA_DO_QUADRO);
    const y = Math.round(((e.clientY - caixa.top) / caixa.height) * ALTURA_DO_QUADRO);
    return [Math.min(LARGURA_DO_QUADRO, Math.max(0, x)), Math.min(ALTURA_DO_QUADRO, Math.max(0, y))];
  };
  const comecar = (e: PointerEvent<HTMLCanvasElement>) => {
    if (desligado) return;
    const t = Math.max(0, ...tracos.current.keys()) + 1;
    if (balde) {
      const dados = { t, i: 0, c: cor, e: BALDE, p: ponto(e) };
      juntar(dados, 0, dados.p);
      socket?.emit('minijogo:tempo-real', { channelId, dados });
      tocar('desliza');
      pintar();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    atual.current = { t, i: 0, pendentes: ponto(e), ultimo: null, relogio: setInterval(enviar, ENVIO_MS) };
    enviar();
    pintar();
  };
  const mover = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = atual.current;
    if (!a) return;
    a.pendentes.push(...ponto(e));
    juntar({ t: a.t, c: cor, e: espessura }, a.i, a.ultimo ? [...a.ultimo, ...a.pendentes] : a.pendentes);
    pintar();
  };
  const terminar = () => {
    if (!atual.current) return;
    enviar();
    if (atual.current.relogio) clearInterval(atual.current.relogio);
    atual.current = null;
  };
  useEffect(() => terminar, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="desenho-quadro-e-ferramentas">
      <canvas
        ref={tela}
        className={`desenho-quadro${desligado ? '' : ' meu'}${!desligado && balde ? ' balde' : ''}`}
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
      />
      {!desligado && (
        <div className="desenho-ferramentas">
          {CORES_DO_DESENHO.map((hex, i) => (
            <button
              key={hex}
              type="button"
              className={`desenho-cor${cor === i ? ' escolhida' : ''}`}
              style={{ background: hex }}
              aria-label={i === 1 ? t('Borracha') : hex}
              aria-pressed={cor === i}
              onClick={() => setCor(i)}
            >
              {i === 1 && <Eraser size={14} aria-hidden="true" />}
            </button>
          ))}
          <span className="desenho-separador" />
          {ESPESSURAS_DO_DESENHO.map((largura, i) => (
            <button
              key={largura}
              type="button"
              className={`desenho-espessura${espessura === i && !balde ? ' escolhida' : ''}`}
              aria-label={t('Espessura {n}', { n: i + 1 })}
              aria-pressed={espessura === i && !balde}
              onClick={() => {
                setEspessura(i);
                setBalde(false);
              }}
            >
              <span style={{ width: 4 + i * 6, height: 4 + i * 6 }} />
            </button>
          ))}
          <span className="desenho-separador" />
          <button
            type="button"
            className={`desenho-espessura${balde ? ' escolhida' : ''}`}
            aria-label={primeiraForma(t('Balde'))}
            title={primeiraForma(t('Balde'))}
            aria-pressed={balde}
            onClick={() => setBalde((b) => !b)}
          >
            <PaintBucket size={16} aria-hidden="true" />
          </button>
          <span className="desenho-separador" />
          <button
            type="button"
            className="icon-plain"
            aria-label={t('Desfazer')}
            onClick={() => {
              const ultimo = Math.max(-1, ...tracos.current.keys());
              tracos.current.delete(ultimo);
              pintar();
              void agir({ tipo: 'desfazer' });
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="icon-plain"
            aria-label={t('Apagar tudo')}
            onClick={() => {
              tracos.current = new Map();
              pintar();
              void agir({ tipo: 'limpar' });
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Um passo de uma corrente, na revelação: a frase num balão, ou o desenho, com quem fez. */
function PassoDaCorrente({ passo, nome }: { passo: PassoPublico; nome: (id: number) => string }) {
  const t = useT();
  return (
    <li className={`telefone-passo ${passo.tipo}`}>
      <span className="telefone-autor">
        {passo.tipo === 'desenho' ? '✏️' : '💬'} {nome(passo.autor)}
      </span>
      {passo.tipo === 'frase' ? (
        <p className="telefone-frase">{passo.texto || <em>{t('(em branco)')}</em>}</p>
      ) : (
        <QuadroParado tracos={passo.tracos} rotulo={t('Desenho de {nome}', { nome: nome(passo.autor) })} />
      )}
    </li>
  );
}

export function JogoTelefone({
  estado,
  eu,
  restante,
  agir,
  socket,
  channelId,
}: {
  estado: EstadoTelefone & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
  socket: Socket | null;
  channelId: number;
}) {
  const t = useT();
  const [texto, setTexto] = useState('');
  const nome = (id: number) => estado.jogadores.find((j) => j.userId === id)?.username ?? '?';
  const jogo = estado.jogadores.some((j) => j.userId === eu);
  const trabalhando = estado.tarefa !== null && jogo && !estado.terminada;
  const chaveDoPasso = `${estado.passo}-${estado.tarefa}`;
  const autoEnviado = useRef('');

  // um passo novo: a caixa de texto começa vazia, e o som da vez
  useEffect(() => {
    setTexto('');
    if (trabalhando) tocar('vez');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDoPasso]);

  // (o erro, como a frase barrada pela moderação, aparece na tela do jogo, pelo agir; a frase fica na caixa para reescrever)
  const mandarFrase = (frase: string) => agir({ tipo: 'frase', texto: frase });

  // A FRASE QUE NÃO FOI ENVIADA vai sozinha no último segundo e meio (escrita e não mandada não se perde)
  useEffect(() => {
    if (!trabalhando || estado.tarefa === 'desenhar' || estado.entregue) return;
    if (restante > 1500 || !texto.trim() || autoEnviado.current === chaveDoPasso) return;
    autoEnviado.current = chaveDoPasso;
    void mandarFrase(texto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante]);

  // A revelação: um som a cada passo que aparece
  const vistos = useRef('');
  useEffect(() => {
    const m = estado.mostrando;
    if (!m) return;
    const k = `${m.corrente}-${m.ate}`;
    if (k !== vistos.current) {
      vistos.current = k;
      tocar(m.ate === 0 ? 'carta' : 'encaixe');
    }
  }, [estado.mostrando]);

  if (estado.terminada || estado.fase === 'fim') {
    return (
      <div className="telefone">
        <p className="minijogo-situacao">{t('As correntes')}</p>
        {estado.correntes.map((c) => (
          <section key={c.dono} className="telefone-corrente">
            <ol>
              {c.passos.map((p, i) => (
                <PassoDaCorrente key={i} passo={p} nome={nome} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    );
  }

  if (estado.fase === 'mostrando' && estado.mostrando) {
    const c = estado.correntes[estado.mostrando.corrente];
    return (
      <div className="telefone">
        <div className="desenho-topo" role="status">
          <span className="minijogo-rodada">{t('Corrente {n} de {total}', { n: estado.mostrando.corrente + 1, total: estado.passos })}</span>
          <div className="desenho-palavra">{t('A corrente de {nome}', { nome: nome(c?.dono ?? 0) })}</div>
        </div>
        {c && (
          <section className="telefone-corrente">
            <ol aria-live="polite">
              {c.passos.map((p, i) => (
                <PassoDaCorrente key={i} passo={p} nome={nome} />
              ))}
            </ol>
          </section>
        )}
        {jogo && (
          <div className="minijogo-acoes">
            <button type="button" className="btn-secondary" aria-label={t('Próximo')} title={t('Próximo')} onClick={() => void agir({ tipo: 'proximo' })}>
              <SkipForward size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const anterior = estado.anterior;
  let pedido: string;
  if (!jogo) pedido = t('A turma está passando a frase adiante…');
  else if (estado.tarefa === 'escrever') pedido = t('Escreva uma frase para alguém desenhar.');
  else if (estado.tarefa === 'desenhar')
    pedido = anterior?.tipo === 'frase' && anterior.texto ? t('Desenhe: {frase}', { frase: anterior.texto }) : t('Desenhe o que quiser.');
  else pedido = t('O que é este desenho?');

  const prontos = estado.jogadores.filter((j) => j.pronto).length;
  return (
    <div className="telefone">
      <div className="desenho-topo" role="status">
        <span className="minijogo-rodada">{t('Passo {n} de {total}', { n: estado.passo, total: estado.passos })}</span>
        <div className="desenho-palavra">{pedido}</div>
      </div>
      {trabalhando && estado.tarefa === 'desenhar' && (
        <QuadroDoTelefone key={chaveDoPasso} inicial={estado.meu?.tracos ?? []} desligado={estado.entregue} agir={agir} socket={socket} channelId={channelId} />
      )}
      {trabalhando && estado.tarefa === 'adivinhar' && anterior?.tipo === 'desenho' && (
        <QuadroParado tracos={anterior.tracos} rotulo={t('O que é este desenho?')} />
      )}
      {trabalhando && estado.tarefa !== 'desenhar' && !estado.entregue && (
        <form
          className="desenho-chute telefone-escrever"
          onSubmit={(e) => {
            e.preventDefault();
            if (!texto.trim()) return;
            void mandarFrase(texto);
          }}
        >
          <input
            value={texto}
            maxLength={TAMANHO_DA_FRASE}
            autoFocus
            placeholder={estado.tarefa === 'escrever' ? t('Sua frase…') : t('Seu palpite…')}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={!texto.trim()}>
            {t('Enviar')}
          </button>
        </form>
      )}
      {trabalhando && estado.tarefa === 'desenhar' && !estado.entregue && (
        <div className="minijogo-acoes">
          <button type="button" className="btn-primary" onClick={() => void agir({ tipo: 'pronto' })}>
            <Check size={16} aria-hidden="true" /> {t('Pronto')}
          </button>
        </div>
      )}
      {(estado.entregue || !jogo) && (
        <p className="minijogo-situacao">
          {t('Esperando a turma…')} {prontos}/{estado.jogadores.length}
        </p>
      )}
      <ul className="telefone-prontos" aria-label={t('Quem já entregou')}>
        {estado.jogadores.map((j) => (
          <li key={j.userId} className={j.pronto ? 'pronto' : ''}>
            {j.pronto ? '✓' : '…'} {j.username}
          </li>
        ))}
      </ul>
      <Relogio restante={restante} total={estado.tempoMs} />
    </div>
  );
}
