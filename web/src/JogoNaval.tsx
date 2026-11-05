import { useT } from './i18n';
import { Relogio } from './Minijogo';
import { Mar3D } from './naval3d/Mar3D';
import type { Partida } from './minijogos';

const JOGADA_MS = 90_000;
const LADO = 10;

/** O que se vê de um mar (server/src/minijogo-naval.ts): os tiros (0 nada, 1 água, 2 fogo) e os navios visíveis. */
export interface MarNaval {
  tiros: number[];
  navios: { casas: number[]; afundado: boolean }[];
}

export interface EstadoNaval {
  fase: 'esperando' | 'jogando' | 'fim';
  jogadores: { userId: number; username: string }[];
  vez: 0 | 1;
  vencedor: 0 | 1 | 'empate' | null;
  motivo: 'jogo' | 'tempo' | 'desistiu' | null;
  mares: [MarNaval, MarNaval];
  /** Os tamanhos dos navios que ainda boiam, por lado. */
  restam: [number[], number[]];
  ultimo: { lado: 0 | 1; casa: number; resultado: 'agua' | 'acertou' | 'afundou' } | null;
  podeSortear: boolean;
}

/** A coordenada do jogo de papel: a letra é a coluna, o número a linha ("B7"). */
const coordenada = (casa: number) => `${String.fromCharCode(65 + (casa % LADO))}${Math.floor(casa / LADO) + 1}`;

/**
 * BATALHA NAVAL, na mesa de duas pessoas (a mesma de JogoDuelo.tsx): quem joga vê o próprio mar com os navios e o mar do
 * outro, onde atira na sua vez; quem assiste vê os dois mares só com o que os tiros revelaram.
 */
export function JogoNaval({
  estado: partida,
  eu,
  restante,
  agir,
}: {
  estado: Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const estado = partida as unknown as EstadoNaval & Partida;
  const meuLado = estado.jogadores.findIndex((j) => j.userId === eu);
  const sentado = meuLado === 0 || meuLado === 1;
  const jogando = estado.fase === 'jogando';
  const minhaVez = jogando && meuLado === estado.vez;
  const nome = (lado: number) => estado.jogadores[lado]?.username ?? '?';

  let situacao: string;
  if (estado.fase === 'esperando') {
    situacao = sentado ? t('Esperando alguém da sala sentar do outro lado…') : t('{nome} quer jogar. Sente do outro lado!', { nome: nome(0) });
  } else if (jogando) {
    situacao = minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: nome(estado.vez) });
  } else if (estado.vencedor === 'empate') {
    situacao = t('Empate!');
  } else if (estado.vencedor === null) {
    situacao = t('Ninguém sentou para jogar.');
  } else {
    const perdedor = estado.vencedor === 0 ? 1 : 0;
    situacao =
      estado.motivo === 'tempo'
        ? t('{nome} demorou demais para jogar. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
        : estado.motivo === 'desistiu'
          ? t('{nome} desistiu. {vencedor} venceu!', { nome: nome(perdedor), vencedor: nome(estado.vencedor) })
          : t('{nome} venceu!', { nome: nome(estado.vencedor) });
  }

  const ultimo = estado.ultimo;
  let resultado: string | null = null;
  if (ultimo && jogando) {
    resultado =
      ultimo.resultado === 'agua'
        ? t('Água!')
        : ultimo.resultado === 'afundou'
          ? t('Afundou!')
          : ultimo.lado === meuLado
            ? t('Acertou! Atire de novo.')
            : t('Acertou!');
  }

  // Quem joga vê primeiro o mar onde atira; quem assiste, os dois na ordem da mesa.
  const ordem: (0 | 1)[] = sentado ? [meuLado === 0 ? 1 : 0, meuLado as 0 | 1] : [0, 1];

  return (
    <div className="duelo duelo-naval">
      <div className="duelo-mesa">
        {[0, 1].map((lado) => (
          <span key={lado} className={`duelo-jogador${jogando && estado.vez === lado ? ' da-vez' : ''}${estado.vencedor === lado ? ' venceu' : ''}`}>
            <span className={`duelo-peca lado-${lado}`} aria-hidden="true" />
            {estado.jogadores[lado]?.username ?? '…'}
          </span>
        ))}
      </div>

      <div className="naval-mares">
        {ordem.map((lado) => {
          const meu = sentado && lado === meuLado;
          const alvo = sentado && !meu;
          return (
            <MarDaTela
              key={lado}
              titulo={meu ? t('Seu mar') : t('Mar de {nome}', { nome: nome(lado) })}
              mar={estado.mares[lado]}
              restam={estado.restam[lado]}
              meu={meu}
              alvo={alvo}
              daVez={jogando && estado.vez !== lado}
              podeAtirar={alvo && minhaVez}
              ultima={ultimo && ultimo.lado !== lado ? ultimo.casa : null}
              atirar={(casa) => agir({ tipo: 'jogada', casa })}
            />
          );
        })}
      </div>

      <p className={`minijogo-situacao${minhaVez ? ' minha-vez' : ''}`} role="status">
        {situacao}
        {resultado && <span className={`naval-resultado ${ultimo?.resultado}`}> {resultado}</span>}
      </p>
      {/* no Solo, contra o computador, pensar não tem prazo */}
      {jogando && !estado.solo && <Relogio restante={restante} total={JOGADA_MS} />}
      {jogando && sentado && estado.podeSortear && (
        <button type="button" className="link-button naval-sortear" onClick={() => agir({ tipo: 'livre', acao: 'sortear' })}>
          {t('Sortear de novo')}
        </button>
      )}
      {estado.fase === 'esperando' && !sentado && (
        <button type="button" className="btn-primary duelo-sentar" onClick={() => agir({ tipo: 'sentar' })}>
          {t('Jogar')}
        </button>
      )}
      {jogando && sentado && (
        <button type="button" className="link-button duelo-desistir" onClick={() => agir({ tipo: 'desistir' })}>
          {t('Desistir')}
        </button>
      )}
    </div>
  );
}

function MarDaTela({
  titulo,
  mar,
  restam,
  meu,
  alvo,
  daVez,
  podeAtirar,
  ultima,
  atirar,
}: {
  titulo: string;
  mar: MarNaval;
  restam: number[];
  meu: boolean;
  alvo: boolean;
  /** É o mar que está levando tiro agora. */
  daVez: boolean;
  podeAtirar: boolean;
  ultima: number | null;
  atirar: (casa: number) => void;
}) {
  return (
    <section className={`naval-mar${meu ? ' meu' : ''}${alvo ? ' alvo' : ''}${daVez ? ' na-mira' : ''}`}>
      <h4 className="naval-titulo">{titulo}</h4>
      <Mar3D
        dados={{ tiros: mar.tiros, navios: mar.navios, meu, podeAtirar, ultima }}
        aoAtirar={atirar}
        grade={
      <div className="naval-grade">
        {mar.navios.map((navio) => {
          const casas = [...navio.casas].sort((a, b) => a - b);
          const primeira = casas[0];
          const deitado = casas.length > 1 && casas[1] - casas[0] === 1;
          const linha = Math.floor(primeira / LADO) + 1;
          const coluna = (primeira % LADO) + 1;
          return (
            <span
              key={primeira}
              className={`naval-navio${deitado ? ' deitado' : ' em-pe'}${navio.afundado ? ' afundado' : ''}`}
              style={{
                gridRow: deitado ? `${linha}` : `${linha} / span ${casas.length}`,
                gridColumn: deitado ? `${coluna} / span ${casas.length}` : `${coluna}`,
              }}
              aria-hidden="true"
            />
          );
        })}
        {mar.tiros.map((tiro, casa) => (
          <button
            key={casa}
            type="button"
            className={`naval-casa${tiro === 1 ? ' agua' : tiro === 2 ? ' fogo' : ''}${ultima === casa ? ' ultima' : ''}`}
            style={{ gridRow: Math.floor(casa / LADO) + 1, gridColumn: (casa % LADO) + 1 }}
            disabled={!podeAtirar || tiro !== 0}
            aria-label={coordenada(casa)}
            onClick={() => atirar(casa)}
          />
        ))}
      </div>
        }
      />
      <div className="naval-restam" aria-hidden="true">
        {restam.map((tamanho, k) => (
          <span key={k} className="naval-silhueta" style={{ width: `${tamanho * 7}px` }} />
        ))}
      </div>
    </section>
  );
}
