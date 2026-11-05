/**
 * AS REAÇÕES (05/11/2026, pedido dele: "um pacote de emoji, seria legal os usuários poderem usar em seus avatares"; ele escolheu
 * a reação rápida): a pessoa aperta um balãozinho e ele aparece por uns segundos em cima do quadro dela na chamada, para
 * todos. São os balões em pixel art do Kenney Emotes Pack (CC0, web/public/reacoes/License.txt; o crédito nos termos, seção 10),
 * 16 × 16, ampliados com os pixels nítidos. Desenho sem texto: vale nos 80 idiomas sem tradução.
 *
 * Vai pelo canal de dados do LiveKit, como o soundboard (cifrado de ponta a ponta na chamada, sem passar pelo servidor nem
 * ficar guardado). Só os ids desta lista valem: quem recebe confere.
 */
export const REACOES = [
  'heart',
  'hearts',
  'laugh',
  'faceHappy',
  'faceSad',
  'faceAngry',
  'anger',
  'heartBroken',
  'exclamation',
  'question',
  'idea',
  'music',
  'sleeps',
  'star',
  'stars',
  'cash',
  'drops',
  'swirl',
  'cross',
  'dots3',
] as const;

export type Reacao = (typeof REACOES)[number];

export const ehReacao = (v: unknown): v is Reacao => typeof v === 'string' && (REACOES as readonly string[]).includes(v);

export const imagemDaReacao = (r: Reacao) => `${import.meta.env.BASE_URL}reacoes/${r}.png`;

/** Quanto tempo o balão fica em cima do quadro. */
export const DURACAO_DA_REACAO_MS = 3500;
