/**
 * Shield, do Project Arachnid: confere imagens contra a base de material de abuso infantil.
 *
 * Tem três modos, e o primeiro é o de hoje — igual ao envio de e-mail (ver email.ts):
 *
 *   1. **Desligado** (sem SHIELD_USUARIO): nada sai daqui e nada é barrado. É o estado enquanto não
 *      há credencial, e ele não pode atrapalhar nada.
 *   2. **Ligado**: cada imagem enviada é conferida antes de ficar disponível.
 *   3. **Indisponível**: o Shield fora do ar. Ver a política de falha, logo abaixo.
 *
 * ---------------------------------------------------------------------------------------------------
 * POR QUE A IMAGEM VAI, E NÃO SÓ O HASH — uma reversão minha, com o motivo.
 *
 * Eu havia afirmado que mandaríamos só a impressão digital, para nenhuma foto de usuário sair do
 * servidor. A API tem esse caminho (/v1/pdq/), e ele exige calcular o hash PDQ aqui dentro. Só que:
 *
 *   - não existe PDQ para Node (procurei; o que há no npm é outro algoritmo, incompatível);
 *   - implementá-lo à mão exigiria também decodificar imagem no servidor, que o Syden não faz — quem
 *     redimensiona é o navegador (ver web/src/upload.ts);
 *   - e o erro seria SILENCIOSO da pior forma: um PDQ sutilmente errado devolve "nada encontrado"
 *     para sempre, e o sistema parece funcionar enquanto não protege ninguém;
 *   - calcular no navegador não serve: quem controla o cliente simplesmente não calcula.
 *
 * Então a imagem vai, pelo caminho oficial deles. O preço está na Seção 7 dos termos — a C3P recebe
 * licença sobre o que é enviado, para o objetivo de combater esse material — e é preciso declarar na
 * política de privacidade. Em troca, a verificação funciona de verdade.
 *
 * A EXPOSIÇÃO É REDUZIDA PELO CACHE: cada imagem é conferida UMA VEZ, guardada pelo SHA-256 do próprio
 * arquivo. Reenviar a mesma foto não a manda de novo, nem a milésima vez.
 * ---------------------------------------------------------------------------------------------------
 */
import { createHash } from 'node:crypto';
import { config } from './config.js';

const ENDERECO = 'https://shield.projectarachnid.ca/v1/media/';

/** Quanto se espera pela resposta antes de considerar o Shield indisponível. */
const TEMPO_LIMITE_MS = 8_000;

export type Veredito = 'limpo' | 'bloqueado' | 'indisponivel' | 'desligado';

export interface Resultado {
  veredito: Veredito;
  /** 'csam' | 'harmful-abusive-material' | 'no-known-match', como o Shield devolve. */
  classificacao?: string;
  /** 'exact' | 'near', quando houve correspondência. */
  tipo?: string;
  /** O SHA-256 do arquivo. É a chave do cache e o que identifica o arquivo num registro. */
  sha256: string;
}

export const shieldConfigurado = () => Boolean(config.shield?.usuario && config.shield?.senha);

/** Escreve no registro do servidor. Trocado por um logger de verdade em app.ts. */
let anotar: (linha: string) => void = (linha) => console.log(linha);
export function ondeAnotarShield(fn: (linha: string) => void) {
  anotar = fn;
}

/**
 * O cache de vereditos, por SHA-256.
 *
 * Fica na memória de propósito: é um acelerador, não uma verdade guardada. Reiniciar o servidor o
 * esvazia, e a única consequência é conferir de novo — enquanto guardá-lo no banco significaria manter
 * Match Data além do necessário, que a Seção 13(e) dos termos deles limita.
 */
const cache = new Map<string, Resultado>();
const TETO_DO_CACHE = 5000;

export function shaDe(dados: Buffer): string {
  return createHash('sha256').update(dados).digest('hex');
}

/**
 * Confere uma imagem.
 *
 * NUNCA LANÇA. Um erro aqui não pode derrubar um envio de avatar: devolve 'indisponivel', e quem chama
 * decide o que fazer com isso (ver a política em media-routes).
 */
export async function conferir(dados: Buffer, mime: string): Promise<Resultado> {
  const sha256 = shaDe(dados);

  if (!shieldConfigurado()) return { veredito: 'desligado', sha256 };

  const guardado = cache.get(sha256);
  if (guardado) return guardado;

  const credencial = Buffer.from(`${config.shield.usuario}:${config.shield.senha}`).toString('base64');

  try {
    const resposta = await fetch(ENDERECO, {
      method: 'POST',
      headers: { authorization: `Basic ${credencial}`, 'content-type': mime },
      body: new Uint8Array(dados),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });

    if (!resposta.ok) {
      anotar(`shield: resposta ${resposta.status} ao conferir imagem`);
      return { veredito: 'indisponivel', sha256 };
    }

    const corpo = (await resposta.json()) as {
      classification?: string;
      match_type?: string | null;
      is_match?: boolean;
    };

    // is_match vem deles; a classificação é conferida junto porque "no-known-match" com is_match
    // verdadeiro seria contraditório, e diante de contradição o certo é barrar.
    const bateu = corpo.is_match === true || (corpo.classification && corpo.classification !== 'no-known-match');

    const resultado: Resultado = {
      veredito: bateu ? 'bloqueado' : 'limpo',
      classificacao: corpo.classification,
      tipo: corpo.match_type ?? undefined,
      sha256,
    };

    // Só o veredito limpo entra no cache. Um bloqueio é evento para registrar e olhar, não para
    // responder de memória — e são raros o bastante para não precisarem de atalho.
    if (resultado.veredito === 'limpo') {
      if (cache.size >= TETO_DO_CACHE) cache.clear();
      cache.set(sha256, resultado);
    }
    return resultado;
  } catch (erro) {
    anotar(`shield: não deu para conferir (${(erro as Error).message})`);
    return { veredito: 'indisponivel', sha256 };
  }
}
