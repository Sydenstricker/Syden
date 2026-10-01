/**
 * OS ARQUIVOS DAS PESSOAS, NO DISCO — e não mais dentro do banco.
 *
 * ---------------------------------------------------------------------------------------------------
 * POR QUE SAIR DO SQLITE. Quatro motivos, em ordem de peso:
 *
 *   1. MEMÓRIA POR PEDIDO. Um BLOB sai do SQLite como Buffer inteiro na RAM — não há meio-termo. Uma
 *      música de karaokê de 12 MB são 12 MB de memória por pessoa que a estiver ouvindo ao mesmo
 *      tempo. Do disco, o sistema operacional entrega o arquivo sem passar pela memória do Node.
 *   2. PULAR NO MEIO DO ÁUDIO. Arquivo em disco aceita pedido de pedaço (Range); BLOB não. Arrastar a
 *      barra do karaokê baixava a música inteira de novo. Isso É o karaokê — é o uso normal dele.
 *   3. BACKUP EM RITMOS DIFERENTES. Copiar o banco era copiar os arquivos de todo mundo junto. Agora a
 *      ficha é pequena e se copia a toda hora; os arquivos são grandes e quase nunca mudam.
 *   4. ESPAÇO QUE NÃO VOLTA. Apagar um BLOB não encolhe o arquivo do banco — só `VACUUM` encolhe, e ele
 *      tranca o banco inteiro e precisa do dobro do espaço em disco enquanto roda.
 *
 * FOI FEITO AGORA, COM 96 ARQUIVOS E 6 MB, de propósito: mover noventa e seis arquivos é uma tarde,
 * mover cinquenta mil é um plano de manutenção. A migração mais barata é a que se faz antes de doer.
 * ---------------------------------------------------------------------------------------------------
 *
 * O ENDEREÇO DE CADA ARQUIVO É O SEU PRÓPRIO CONTEÚDO: o nome no disco é o sha256 dos bytes. Isso dá
 * três coisas de graça, e nenhuma delas precisaria ser programada:
 *
 *   - **Cópia repetida deixa de existir.** O mesmo som instalado por dez pessoas é um arquivo só. O
 *     mesmo meme mandado em cinco conversas é um arquivo só.
 *   - **Escrever é idempotente.** Se o arquivo já está lá, com aquele nome, ele É aquele conteúdo —
 *     não há o que conferir nem o que sobrescrever. Migração interrompida no meio se retoma sem risco.
 *   - **É o mesmo sha256 que o Shield já usa.** A fila de conferência contra a base de abuso infantil
 *     guarda o hash da imagem (ver shield.ts); agora o hash também é onde ela mora.
 *
 * DOIS NÍVEIS DE PASTA (ab/abcdef…) porque dez mil arquivos numa pasta só é lento de listar em
 * qualquer sistema de arquivos, e um dia alguém vai querer listar.
 *
 * APAGAR NÃO ACONTECE AQUI, e é de propósito. Com conteúdo repetido virando um arquivo só, apagar uma
 * linha não quer dizer apagar o arquivo — outra linha pode apontar para ele. E `ON DELETE CASCADE`
 * apaga linhas sem o código ficar sabendo, então nenhum gancho de apagar seria completo. Quem limpa é
 * uma varredura à parte, que compara o disco com o banco: server/scripts/limpar-orfaos.mjs.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from './config.js';

/**
 * Onde os arquivos moram. Ao lado do banco, e não numa pasta solta: o banco já mora num volume do
 * Docker que sobrevive a `docker compose up --build`, e um caminho fora dele seria apagado no primeiro
 * deploy — com os avatares de todo mundo dentro.
 */
export const PASTA_DOS_ARQUIVOS = process.env.MEDIA_PATH || join(dirname(config.databasePath), 'arquivos');

export const shaDeArquivo = (dados: Uint8Array): string => createHash('sha256').update(dados).digest('hex');

/** `…/arquivos/ab/abcdef…` — o nome é o conteúdo, então o caminho também. */
export function caminhoDe(sha: string): string {
  return join(PASTA_DOS_ARQUIVOS, sha.slice(0, 2), sha);
}

/**
 * Guarda os bytes e devolve o endereço deles. Chamar duas vezes com o mesmo conteúdo não escreve duas.
 *
 * ESCREVE EM NOME TEMPORÁRIO E RENOMEIA. Renomear dentro do mesmo sistema de arquivos é atômico: ou o
 * arquivo existe inteiro, ou não existe. Sem isso, um servidor que morre no meio da escrita deixa um
 * arquivo pela metade com o nome certo — e o nome certo é justamente a promessa de que o conteúdo
 * confere. Um arquivo truncado seria uma mentira permanente.
 */
export function guardarArquivo(dados: Uint8Array): { sha: string; bytes: number } {
  const sha = shaDeArquivo(dados);
  const destino = caminhoDe(sha);
  const bytes = dados.byteLength;

  if (existsSync(destino)) return { sha, bytes };

  mkdirSync(dirname(destino), { recursive: true });
  const temporario = `${destino}.${process.pid}.tmp`;
  writeFileSync(temporario, dados);
  renameSync(temporario, destino);
  return { sha, bytes };
}

/** O arquivo está mesmo no disco? Usado antes de confiar numa linha que diz que está. */
export function arquivoExiste(sha: string): boolean {
  return existsSync(caminhoDe(sha));
}

/** Quantos bytes tem o arquivo no disco, ou 0 se ele não está lá. */
export function tamanhoNoDisco(sha: string): number {
  try {
    return statSync(caminhoDe(sha)).size;
  } catch {
    return 0;
  }
}

/** Um pedaço do arquivo, ou ele inteiro. É o que a resposta com Range precisa. */
export function abrirArquivo(sha: string, de?: number, ate?: number) {
  return createReadStream(caminhoDe(sha), de === undefined ? undefined : { start: de, end: ate });
}
