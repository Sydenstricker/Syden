import { lookup } from 'node:dns/promises';
import { isIPv4 } from 'node:net';

/**
 * BAIXAR UMA IMAGEM DE UM ENDEREÇO QUE O USUÁRIO COLOU.
 *
 * ===================================================================================================
 * POR QUE O SERVIDOR BAIXA, EM VEZ DE A TELA APONTAR PARA LÁ.
 *
 * Apontar é mais fácil e está errado por quatro motivos, e o projeto já decidiu três deles antes:
 *
 *   1. ENTREGA O ENDEREÇO DE REDE DE TODO MUNDO. Uma capa é carregada pelo navegador de cada pessoa
 *      que abre a comunidade. Apontar para um site qualquer faz o Syden mandar todos eles buscarem
 *      aquilo — o dono do endereço fica com a lista. É a mesma razão pela qual os GIFs das mensagens
 *      só podem vir de uma lista fechada (ver web/src/gifs.ts).
 *   2. PULA O ESCUDO. Toda imagem que entra no Syden é conferida contra base de material conhecido
 *      (ver parseMediaConferida, em media.ts). Imagem que mora fora nunca passa por ele, e não há
 *      arquivo nosso para tirar do ar depois.
 *   3. O QUE ESTÁ NA TELA PODE MUDAR DEPOIS. Quem controla o endereço troca o conteúdo quando
 *      quiser, e a capa aprovada vira outra coisa sem ninguém fazer nada.
 *   4. O ENDEREÇO MORRE. Baixada, a capa continua quando o site de origem sair do ar.
 *
 * Baixando, a capa vira um envio comum: mesmo limite de tamanho, mesmo escudo, mesma rota de
 * entrega. Nada de novo na política de segurança do site, porque a imagem continua saindo de
 * api.syden.chat.
 * ===================================================================================================
 *
 * O QUE ISTO PRECISA DEFENDER: pedir ao servidor que busque um endereço é dar a ele uma ordem de
 * rede. Sem cuidado, `http://127.0.0.1:7880` ou o endereço de metadados da nuvem viram uma capa de
 * comunidade — o servidor alcança coisas que a internet não alcança. Por isso cada salto é
 * resolvido e conferido antes de a conexão sair.
 */

/** Dez segundos por salto. Imagem que demora mais que isso não vale a espera de quem está na tela. */
const PRAZO_MS = 10_000;

/** Quantos redirecionamentos seguir. Três cobre encurtadores e CDNs; mais do que isso é teia. */
const SALTOS = 3;

/**
 * Faixas que um pedido vindo da internet nunca deveria alcançar.
 *
 * As três primeiras são as redes privadas de sempre. As outras existem por razões específicas:
 * 127/8 é a própria máquina (onde moram o banco e o LiveKit), 169.254/16 guarda o endereço de
 * metadados das nuvens (169.254.169.254, que entrega credenciais), 100.64/10 é a rede do provedor e
 * 0/8 é "esta rede", que em alguns sistemas resolve para a própria máquina.
 */
function ehIPv4Interno(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true; // 192.0.0/24, uso de protocolo
  if (a === 198 && (b === 18 || b === 19)) return true; // testes de desempenho
  if (a >= 224) return true; // multicast e reservado
  return false;
}

/**
 * IPv4 ENFIADO DENTRO DE IPv6 É A PASSAGEM QUE SE ESQUECE, e ela quase passou aqui.
 *
 * `::ffff:127.0.0.1` É o 127.0.0.1. A primeira versão disto procurava exatamente esse texto — e o
 * teste reprovou, porque MEDIDO: `new URL('https://[::ffff:127.0.0.1]/a').hostname` devolve
 * `[::ffff:7f00:1]`. O próprio construtor reescreve os quatro números em hexadecimal, e a busca
 * pelo texto decimal nunca casava. Faltando um caractere, o servidor iria buscar em si mesmo.
 *
 * Por isso as duas formas são desembrulhadas, e também a `::a.b.c.d` sem o `ffff` — que é a forma
 * antiga, hoje obsoleta, e cujo único uso restante é justamente escapar de filtros como este.
 */
function ehIPv6Interno(ip: string): boolean {
  const limpo = ip.toLowerCase().split('%')[0];
  if (limpo === '::' || limpo === '::1') return true;

  const decimal = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(limpo);
  if (decimal) return ehIPv4Interno(decimal[1]);

  const hexadecimal = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(limpo);
  if (hexadecimal) {
    const alto = parseInt(hexadecimal[1], 16);
    const baixo = parseInt(hexadecimal[2], 16);
    return ehIPv4Interno(`${alto >> 8}.${alto & 255}.${baixo >> 8}.${baixo & 255}`);
  }

  if (/^f[cd]/.test(limpo)) return true; // fc00::/7, rede local única
  if (/^fe[89ab]/.test(limpo)) return true; // fe80::/10, enlace local
  return false;
}

/**
 * Este endereço aponta para dentro?
 *
 * Exportada para o teste poder conferir a classificação SEM REDE. Medir isto por dentro de uma
 * busca de verdade faria cada caso esperar um tempo-limite, e um teste que leva vinte segundos é
 * um teste que alguém vai acabar pulando.
 */
export function enderecoInterno(ip: string): boolean {
  const cru = ip.replace(/^\[|\]$/g, '');
  return isIPv4(cru) ? ehIPv4Interno(cru) : ehIPv6Interno(cru);
}

const ehInterno = enderecoInterno;

/**
 * O endereço aponta para fora de verdade?
 *
 * TODAS as respostas do DNS são conferidas, e não só a primeira: um nome que devolve um endereço
 * público e um interno passaria se olhássemos só uma.
 */
async function apontaParaFora(host: string): Promise<boolean> {
  // Endereço escrito como número não passa pelo DNS, e precisa da mesma régua.
  const cru = host.replace(/^\[|\]$/g, '');
  if (isIPv4(cru) || cru.includes(':')) return !ehInterno(cru);
  try {
    const achados = await lookup(cru, { all: true });
    return achados.length > 0 && achados.every(({ address }) => !ehInterno(address));
  } catch {
    return false;
  }
}

/** Lê o corpo parando no limite, em vez de aceitar tudo e medir depois. */
async function lerAteOLimite(resposta: Response, maxBytes: number): Promise<Buffer | null> {
  // O tamanho declarado é só um atalho: um servidor pode mentir nele, e por isso a conta real é
  // feita pedaço a pedaço logo abaixo.
  const declarado = Number(resposta.headers.get('content-length') ?? 0);
  if (declarado > maxBytes) return null;

  const leitor = resposta.body?.getReader();
  if (!leitor) return null;
  const pedacos: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await leitor.cancel().catch(() => {});
      return null;
    }
    pedacos.push(Buffer.from(value));
  }
  return Buffer.concat(pedacos);
}


/** O que muda entre baixar uma imagem e um áudio: só o que se pede e como se fala dele no erro. */
interface Tipo {
  accept: string;
  /** "essa imagem", "esse áudio" — entra nas frases de erro. */
  esse: string;
  /** "A imagem", "O áudio". */
  oNome: string;
}

const IMAGEM: Tipo = { accept: 'image/*', esse: 'essa imagem', oNome: 'A imagem' };
const AUDIO: Tipo = { accept: 'audio/*', esse: 'esse áudio', oNome: 'O áudio' };

/**
 * Baixa o arquivo de `cru`, conferindo cada salto. Devolve os bytes, ou uma frase de erro em
 * português, na convenção do parseMedia.
 *
 * O TIPO DO ARQUIVO NÃO É DECIDIDO AQUI. Quem decide é o parseMedia, pelos primeiros bytes; o
 * `content-type` que o outro servidor declarou não é consultado em lugar nenhum, porque ele é
 * palavra de terceiro sobre o que ele mesmo mandou.
 */
async function baixar(cru: unknown, maxBytes: number, tipo: Tipo): Promise<Buffer | string> {
  let endereco: URL;
  try {
    endereco = new URL(String(cru ?? '').trim());
  } catch {
    return 'Endereço inválido.';
  }

  for (let salto = 0; salto <= SALTOS; salto++) {
    // SÓ https. Em http o conteúdo pode ser trocado no caminho, e metade dos endereços internos que
    // valeria a pena alcançar só falam http.
    if (endereco.protocol !== 'https:') return 'O endereço precisa começar com https://.';
    if (endereco.username || endereco.password) return 'Endereço inválido.';
    if (!(await apontaParaFora(endereco.hostname))) return 'Esse endereço não pode ser buscado.';

    let resposta: Response;
    try {
      resposta = await fetch(endereco, {
        // MANUAL, e não automático: seguir sozinho pularia a conferência do salto seguinte, e um
        // redirecionamento para 127.0.0.1 é a forma clássica de contornar tudo o que está acima.
        redirect: 'manual',
        headers: { accept: tipo.accept },
        signal: AbortSignal.timeout(PRAZO_MS),
      });
    } catch {
      return `Não deu para buscar ${tipo.esse}.`;
    }

    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = resposta.headers.get('location');
      if (!destino) return `Não deu para buscar ${tipo.esse}.`;
      try {
        endereco = new URL(destino, endereco);
      } catch {
        return 'Endereço inválido.';
      }
      continue;
    }

    if (!resposta.ok) return `Não deu para buscar ${tipo.esse}.`;

    const dados = await lerAteOLimite(resposta, maxBytes).catch(() => null);
    if (!dados) return `${tipo.oNome} passa do limite de ${Math.round(maxBytes / 1024)} KB.`;
    return dados;
  }

  return 'Esse endereço redireciona demais.';
}

/** A imagem de `cru` como data URL, pronta para o mesmo caminho dos envios comuns — ou o erro. */
export async function baixarImagem(cru: unknown, maxBytes: number): Promise<string> {
  const dados = await baixar(cru, maxBytes, IMAGEM);
  return typeof dados === 'string' ? dados : `data:image/png;base64,${dados.toString('base64')}`;
}

/**
 * A PÁGINA DE UM SOM NO MYINSTANTS NÃO SE DEIXA LER POR SERVIDOR: ela fica atrás da checagem
 * anti-robô da Cloudflare ("Just a moment..."), medido em 03/10/2026. O ARQUIVO, em /media/sounds/,
 * não fica. E o nome do arquivo costuma ser o da página sem o número do fim:
 * /pt/instant/acabou-49530/ → /media/sounds/acabou.mp3. Quando não é, o arquivo dá 404 e quem colou
 * recebe a instrução de copiar o link do botão de baixar, que é o arquivo.
 *
 * O PALPITE PODE ACERTAR O SOM ERRADO: em nome repetido, o site põe um sufixo no arquivo do segundo
 * ("acabou_dx3f4Be.mp3"), e a página dele aponta para lá enquanto o palpite pega o primeiro. Por
 * isso a tela toca uma prévia antes de enviar (ver web/src/SomPorEndereco.tsx).
 */
export function arquivoDoMyInstants(cru: string): string | null {
  let endereco: URL;
  try {
    endereco = new URL(cru.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)myinstants\.com$/i.test(endereco.hostname)) return null;
  const pagina = /\/instant\/([a-z0-9_-]+?)(?:-\d+)?\/?$/i.exec(endereco.pathname);
  return pagina ? `https://www.myinstants.com/media/sounds/${pagina[1]}.mp3` : null;
}

/** Um nome de som a partir do endereço: "vamo-sim-po-claro.mp3" → "vamo sim po claro". */
export function nomeDoSom(cru: string): string {
  try {
    const ultimo = decodeURIComponent(new URL(cru).pathname.split('/').filter(Boolean).pop() ?? '');
    return ultimo
      .replace(/\.[a-z0-9]{2,4}$/i, '')
      .replace(/(?:-\d+|_[A-Za-z0-9]{7})$/, '') // o número da página, ou o sufixo que o site põe em nome repetido
      .replace(/[-_]+/g, ' ')
      .trim()
      .slice(0, 32);
  } catch {
    return '';
  }
}

/**
 * Baixa um som colado como endereço. Devolve os bytes ou o erro em português.
 *
 * O Syden não guarda nada aqui: os bytes voltam para a tela da pessoa e passam pela mesma
 * conferência de um arquivo escolhido no computador (duração, tamanho, tipo pelos primeiros bytes)
 * antes de virar um envio DELA. É isso que mantém o som como algo que a pessoa subiu, e não algo que
 * o Syden trouxe.
 */
export async function baixarSom(cru: unknown, maxBytes: number): Promise<Buffer | string> {
  const texto = String(cru ?? '').trim();
  const doMyInstants = arquivoDoMyInstants(texto);
  if (!doMyInstants) return baixar(texto, maxBytes, AUDIO);
  const dados = await baixar(doMyInstants, maxBytes, AUDIO);
  if (typeof dados !== 'string') return dados;
  return 'Não achei o áudio dessa página. No MyInstants, copie o link do botão de baixar e cole aqui.';
}
