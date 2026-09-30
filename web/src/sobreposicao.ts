import type { VoiceMember } from './types';

export interface PessoaNaSobreposicao {
  nome: string;
  falando: boolean;
  mudo: boolean;
}

/**
 * QUEM APARECE NA JANELINHA POR CIMA DO JOGO.
 *
 * Separada e testada porque ela decide o que vai para uma janela que fica POR CIMA DE TUDO, e errar
 * aqui é diferente de errar numa lista comum: a pessoa está jogando, de costas para o Syden, e não
 * tem como conferir. Três coisas precisam valer sempre, e cada uma é um caso do teste:
 *
 *   1. SÓ QUEM ESTÁ NA MESMA SALA. A lista que o site tem é da comunidade inteira, e mostrar gente de
 *      outra sala seria dizer que está todo mundo junto quando não está.
 *   2. VOCÊ NÃO APARECE. A janelinha responde "quem está comigo"; ver o próprio nome ali ocupa uma
 *      linha para dizer o que a pessoa já sabe.
 *   3. SOZINHO, ELA NÃO EXISTE. Entrar numa sala vazia e ganhar uma janela por cima do jogo com o
 *      próprio nome dentro é atrapalhar sem informar nada.
 *
 * A ordem é a de quem está falando primeiro, e depois alfabética. Sem isso a lista se remexeria a
 * cada vez que alguém abrisse a boca, no canto do olho de quem está mirando.
 */
export function quemMostrar({
  membros,
  canalAtual,
  eu,
  falando,
}: {
  membros: VoiceMember[];
  /** O canal de voz em que EU estou. Fora de qualquer chamada, é null. */
  canalAtual: number | null;
  /** O meu id, para eu não aparecer na própria lista. */
  eu: number;
  /** Os `userId` de quem está falando neste instante. */
  falando: Set<number>;
}): PessoaNaSobreposicao[] {
  if (canalAtual === null) return [];

  const comigo = membros.filter((m) => m.channelId === canalAtual && m.userId !== eu);
  if (comigo.length === 0) return [];

  return comigo
    .map((m) => ({
      nome: m.username,
      falando: falando.has(m.userId),
      // Quem se calou e quem desligou o áudio dos outros aparecem igual: em ambos os casos a pessoa
      // não vai responder, que é o que quem está jogando precisa saber.
      mudo: m.muted || m.deafened,
    }))
    .sort((a, b) => Number(b.falando) - Number(a.falando) || a.nome.localeCompare(b.nome));
}
