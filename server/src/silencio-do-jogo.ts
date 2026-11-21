/**
 * O MICROFONE QUE O JOGO DESLIGA (20/11/2026, decisão dele: "Lobisomem pode mutar sim"). Como no jogo de mesa: DE NOITE
 * ninguém da partida fala (o microfone volta no amanhecer), e QUEM SAIU DO JOGO fica só ouvindo até o fim da partida.
 *
 * A TRAVA DE VERDADE É A PERMISSÃO DO LIVEKIT, como a do microfone travado pela moderação: o botão desligado na tela é só
 * cortesia, e quem abrisse o console publicaria assim mesmo. Por isso este módulo é lido por `permissaoNaSala` (routes.ts),
 * que monta a permissão inteira (a apresentação, o corte de vídeo, a moderação e isto), e cada mudança é aplicada na hora
 * pelo `aplicar` que routes.ts registra (RoomServiceClient.updateParticipant). Quem sai da sala e volta recebe o token já
 * sem o microfone, porque o token também passa por `permissaoNaSala`.
 *
 * SÓ O MICROFONE (e o "som da tela", que o cliente rotula: senão o microfone sairia pelo console como som de transmissão,
 * o mesmo achado da revisão de 21/10/2026 na moderação). A câmera e a tela continuam: o rosto de quem dorme não conta
 * nada, e cortar a tela de quem transmite atrapalharia quem não joga.
 *
 * NINGUÉM FICA MUDO PARA SEMPRE: a partida limpa ao terminar (e ao ser encerrada, trocada, ou quebrar: minijogos-routes.ts);
 * cada sala tem um TETO de 10 min desde a última atualização (a fase mais longa do Lobisomem tem 5 min); e o que está
 * mudo vai para o kv, para o servidor que caiu no meio da noite devolver o microfone a todos ao voltar.
 *
 * Quem só assiste à sala (não joga a partida) nunca entra aqui: o jogo só manda os próprios jogadores.
 */

export type MotivoDoSilencio = 'noite' | 'fora';

/** Quanto o silêncio de uma sala vale sem ser renovado pelo jogo. */
export const TETO_DO_SILENCIO_MS = 10 * 60_000;

interface SilencioDaSala {
  motivos: Map<number, MotivoDoSilencio>;
  ate: number;
  /** Quem silenciou (a partida): outra partida na mesma sala não desfaz o silêncio desta, nem esta o daquela. */
  dono: unknown;
  relogio: ReturnType<typeof setTimeout>;
}

const salas = new Map<number, SilencioDaSala>();

/** Aplica a permissão de agora a quem mudou (routes.ts: updateParticipant e o aviso à lista da sala). */
type Aplicar = (channelId: number, mudaram: number[]) => void;
/** Onde o silêncio sobrevive a uma queda do servidor (o kv do banco). */
interface Guarda {
  ler(): string | undefined;
  gravar(valor: string): void;
}

let aplicar: Aplicar | null = null;
let guarda: Guarda | null = null;
let agora: () => number = Date.now;

export function definirAplicador(fn: Aplicar | null, g: Guarda | null = null) {
  aplicar = fn;
  guarda = g;
}

/** Para os testes: o relógio. */
export function _definirRelogio(fn: () => number) {
  agora = fn;
}

function gravar() {
  if (!guarda) return;
  const lista: [number, number[]][] = [...salas].map(([canal, s]) => [canal, [...s.motivos.keys()]]);
  try {
    guarda.gravar(JSON.stringify(lista));
  } catch {
    // sem o kv, só a garantia da queda se perde; o resto vale
  }
}

/** Por que o microfone desta pessoa está desligado pelo jogo nesta sala (null: não está). */
export function motivoDoSilencio(channelId: number, userId: number): MotivoDoSilencio | null {
  const s = salas.get(channelId);
  if (!s) return null;
  if (agora() >= s.ate) {
    liberarSala(channelId);
    return null;
  }
  return s.motivos.get(userId) ?? null;
}

/**
 * O silêncio INTEIRO da sala agora (quem não está no mapa fala). O jogo manda o mapa todo a cada mudança; aqui se acha
 * quem mudou, e só esses vão ao LiveKit.
 */
export function silenciarNaSala(channelId: number, motivos: Map<number, MotivoDoSilencio>, dono: unknown = null) {
  const atual = salas.get(channelId);
  const antes = atual?.motivos ?? new Map<number, MotivoDoSilencio>();
  if (atual) clearTimeout(atual.relogio);
  const mudaram = [...new Set([...antes.keys(), ...motivos.keys()])].filter((id) => antes.get(id) !== motivos.get(id));
  if (motivos.size === 0) salas.delete(channelId);
  else {
    const relogio = setTimeout(() => liberarSala(channelId), TETO_DO_SILENCIO_MS);
    relogio.unref?.();
    salas.set(channelId, { motivos: new Map(motivos), ate: agora() + TETO_DO_SILENCIO_MS, dono, relogio });
  }
  // sem mudança (a conversa dos lobos avisa a cada mensagem), só o teto é renovado: nada vai ao kv nem ao LiveKit
  if (!mudaram.length) return;
  gravar();
  aplicar?.(channelId, mudaram);
}

/** Todos da sala voltam a falar. Com `dono`, só se o silêncio é dele (a partida que acabou não solta a de outra). */
export function liberarSala(channelId: number, dono?: unknown) {
  const s = salas.get(channelId);
  if (!s) return;
  if (dono !== undefined && s.dono !== dono) return;
  silenciarNaSala(channelId, new Map());
}

/**
 * O SERVIDOR VOLTOU (talvez de uma queda no meio da noite): a memória está vazia, mas quem estava mudo continua sem o
 * microfone no LiveKit até sair e voltar. Lê o kv e devolve a permissão a cada um. Chamar depois de `definirAplicador`.
 */
export function devolverDepoisDaQueda() {
  if (!guarda || !aplicar) return;
  let lista: [number, number[]][] = [];
  try {
    lista = JSON.parse(guarda.ler() || '[]');
  } catch {
    lista = [];
  }
  for (const [canal, ids] of Array.isArray(lista) ? lista : []) {
    const pendentes = (Array.isArray(ids) ? ids : []).filter((id) => motivoDoSilencio(canal, id) === null);
    if (pendentes.length) aplicar(Number(canal), pendentes);
  }
  gravar();
}

/** O pedaço do RoomServiceClient do LiveKit que o silêncio usa (o teste passa um de mentira). */
export interface ClienteDaSala {
  updateParticipant(room: string, identity: string, metadata: string | undefined, permission: object): Promise<unknown>;
  listParticipants(room: string): Promise<{ identity: string; tracks: { sid: string; source: unknown }[] }[]>;
  mutePublishedTrack(room: string, identity: string, trackSid: string, muted: boolean): Promise<unknown>;
}

/**
 * O APLICADOR DE VERDADE (routes.ts o registra): para cada pessoa que mudou, a permissão INTEIRA de agora (`permissao`, que
 * é `permissaoNaSala`: a apresentação, o corte de vídeo e a moderação continuam valendo) vai ao LiveKit. Ao silenciar, a
 * faixa do microfone aberta é emudecida também, como na moderação, para não depender de o LiveKit tirá-la sozinho.
 * Falhou (o LiveKit fora, ou não configurado no desenvolvimento): o jogo segue, sem mutar, e fica no log; o site, que
 * recebe o motivo pela lista da sala, desliga o próprio microfone assim mesmo.
 */
export function aplicadorDoLiveKit({
  cliente,
  sala,
  permissao,
  microfone,
  depois,
  log,
}: {
  cliente: ClienteDaSala;
  /** O nome da sala do LiveKit de um canal. */
  sala: (channelId: number) => string;
  permissao: (channelId: number, userId: number) => object | null;
  /** A fonte "microfone" do LiveKit (TrackSource.MICROPHONE). */
  microfone: unknown;
  /** Depois de pedir (a lista da sala de novo, para a tela de cada um saber). */
  depois?: (channelId: number) => void;
  log?: (mensagem: string) => void;
}): Aplicar {
  let avisouFalha = false;
  return (channelId, mudaram) => {
    const room = sala(channelId);
    void (async () => {
      for (const userId of mudaram) {
        const perm = permissao(channelId, userId);
        if (!perm) continue;
        try {
          await cliente.updateParticipant(room, String(userId), undefined, perm);
          if (motivoDoSilencio(channelId, userId) !== null) {
            const pessoas = await cliente.listParticipants(room);
            const faixa = pessoas.find((p) => p.identity === String(userId))?.tracks.find((t) => t.source === microfone);
            if (faixa) await cliente.mutePublishedTrack(room, String(userId), faixa.sid, true);
          }
        } catch (erro) {
          // quem não está na chamada agora também cai aqui (o token novo já nasce certo): só a primeira vai ao log
          if (!avisouFalha) {
            avisouFalha = true;
            log?.(`silêncio do jogo: o LiveKit não aceitou a permissão (${(erro as Error)?.message ?? erro}); o jogo segue sem mutar`);
          }
        }
      }
    })();
    depois?.(channelId);
  };
}

/** Para os testes: esquece tudo, sem aplicar. */
export function _limpar() {
  for (const s of salas.values()) clearTimeout(s.relogio);
  salas.clear();
}
