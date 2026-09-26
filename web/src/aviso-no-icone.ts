/**
 * O aviso no ícone do Syden: o número vermelho em cima do ícone, como no Discord.
 *
 * O que conta, e o que NÃO conta, é a decisão importante aqui. Conta o que é dirigido a você:
 *   - mensagem direta que você não leu;
 *   - menção ao seu nome, ou um @todos, num canal de comunidade.
 * NÃO conta conversa de canal correndo solta. Se contasse, o número ficaria permanentemente aceso e
 * deixaria de querer dizer alguma coisa — que é exatamente o que faz as pessoas ignorarem avisos.
 *
 * O mesmo número vai para três lugares, porque o Syden é usado de três jeitos:
 *   - título da aba e desenho no favicon, para quem usa no navegador;
 *   - `navigator.setAppBadge`, para quem instalou como aplicativo (PWA);
 *   - ícone da barra de tarefas, pela ponte do desktop, para quem usa o instalador no Windows.
 */
import { desktopBridge } from './desktop';
export { mencionaVoce } from './mencoes';

const CHAVE = 'syden.mencoes';

/** Menções ainda não lidas, por canal: { [channelId]: quantas }. */
type Mencoes = Record<number, number>;

function carregar(): Mencoes {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Mencoes;
  } catch {
    return {};
  }
}

let mencoes: Mencoes = carregar();
let naoLidasDiretas = 0;
const ouvintes = new Set<() => void>();

function guardar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(mencoes));
  } catch {
    // Sem armazenamento: o aviso vale só até fechar o app, o que é aceitável.
  }
  for (const ouvinte of ouvintes) ouvinte();
  void pintar();
}

/** Uma menção nova, num canal que a pessoa não está olhando agora. */
export function marcarMencao(channelId: number) {
  mencoes = { ...mencoes, [channelId]: (mencoes[channelId] ?? 0) + 1 };
  guardar();
}

/** A pessoa abriu o canal: as menções dele deixam de contar. */
export function limparMencoes(channelId: number) {
  if (!mencoes[channelId]) return;
  const resto = { ...mencoes };
  delete resto[channelId];
  mencoes = resto;
  guardar();
}

/** Quantas menções esperam neste canal (a bolinha ao lado do nome do canal). */
export function mencoesDoCanal(channelId: number): number {
  return mencoes[channelId] ?? 0;
}

/** Quantas conversas diretas estão por ler. Vem do módulo de não lidas, que já sabia disso. */
export function definirDiretasNaoLidas(quantas: number) {
  if (quantas === naoLidasDiretas) return;
  naoLidasDiretas = quantas;
  void pintar();
}

export function total(): number {
  return naoLidasDiretas + Object.values(mencoes).reduce((soma, n) => soma + n, 0);
}

export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

// ---------------------------------------------------------------------------------------------------
// Pintar o número nos três lugares
// ---------------------------------------------------------------------------------------------------

const TITULO = 'Syden';
let iconeOriginal: string | null = null;

/** O selo vermelho, desenhado na hora: um círculo com o número (ou "9+" quando passa de nove). */
function desenharSelo(quantas: number, lado: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d')!;
  const texto = quantas > 9 ? '9+' : String(quantas);

  ctx.beginPath();
  ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#f23f43';
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(lado * (texto.length > 1 ? 0.54 : 0.66))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, lado / 2, lado / 2 + lado * 0.04);
  return canvas;
}

/** O favicon com o selo no canto. Redesenhado a partir do ícone original, para não perder o coelho. */
async function faviconComSelo(quantas: number): Promise<string | null> {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) return null;
  if (iconeOriginal === null) iconeOriginal = link.href;
  if (quantas === 0) return iconeOriginal;

  try {
    const img = new Image();
    img.src = iconeOriginal;
    await img.decode();

    const lado = 64;
    const canvas = document.createElement('canvas');
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, lado, lado);

    const selo = desenharSelo(quantas, Math.round(lado * 0.62));
    ctx.drawImage(selo, lado - selo.width, 0);
    return canvas.toDataURL('image/png');
  } catch {
    // Ícone que o navegador não deixa desenhar (outra origem): o título e o resto continuam avisando.
    return null;
  }
}

let pintando = false;

async function pintar() {
  if (pintando) return;
  pintando = true;
  const quantas = total();

  try {
    document.title = quantas > 0 ? `(${quantas > 9 ? '9+' : quantas}) ${TITULO}` : TITULO;

    // Aplicativo instalado (PWA): é o próprio sistema que desenha o número no ícone.
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (nav.setAppBadge) {
      await (quantas > 0 ? nav.setAppBadge(quantas) : nav.clearAppBadge?.());
    }

    // Instalador do Windows: o desenho vai pronto para o processo principal, que o põe sobre o ícone
    // da barra de tarefas. Desenhar aqui evita ter que embutir uma imagem para cada número.
    if (desktopBridge?.setBadge) {
      desktopBridge.setBadge(quantas, quantas > 0 ? desenharSelo(quantas, 32).toDataURL('image/png') : null);
    }

    const favicon = await faviconComSelo(quantas);
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (favicon && link) link.href = favicon;
  } catch {
    // Nada aqui é essencial: se falhar, o Syden continua funcionando sem o número.
  } finally {
    pintando = false;
  }
}
