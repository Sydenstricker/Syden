// Acha texto em português cravado no código, e as chaves que o t() já usa.
//
// POR QUE ISTO É UMA BIBLIOTECA E NÃO UM SCRIPT. A detecção precisa ser usada por dois lugares: o
// relatório que a gente lê (scripts/textos-sem-traducao.mjs) e a guarda que falha na integração
// (web/test/traducao.test.ts). Quando isto morava dentro do script, importá-lo executava a varredura e
// imprimia o relatório inteiro no meio do teste. É a mesma lição do e2e/csp.mjs: **regra é dado,
// conferir regra é programa.**
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Parece português?
 *
 * Serve para não acusar o que já é neutro — "OK", "id", um nome de classe CSS. Falso negativo aqui é
 * melhor que falso positivo: um texto em português sem acento que escape da lista aparece depois, quando
 * alguém olhar a tela em inglês. Já uma enxurrada de acusações falsas faria esta ferramenta ser
 * ignorada, que é o pior desfecho possível para uma guarda.
 */
/*
 * A LISTA CRESCEU DEPOIS DE ELA DEIXAR PASSAR 21 TEXTOS. A catraca marcava zero e a tradução dizia
 * 100%, e mesmo assim "Reconectando ao servidor…", "Carregando…", "Uso do servidor" e outros dezoito
 * estavam em português na tela de quem escolheu inglês. Nenhum deles tem acento, e nenhum usa as
 * palavras que estavam aqui — escaparam pela fresta que este comentário previa: "um texto em português
 * sem acento que escape da lista aparece depois, quando alguém olhar a tela em inglês".
 *
 * As palavras acrescentadas são de tela, não de código, e nenhuma existe em inglês: quem escreve
 * "servidor", "carregando" ou "enviar" no meio de uma tag está escrevendo para a pessoa ler.
 */
export const PARECE_PORTUGUES =
  /[áàâãéêíóôõúüç]|\b(você|voce|não|nao|para|com|uma|que|sua|seu|está|sao|são|nome|senha|mensagem|canal|sala|conta|nada|ainda|sem|dos|das|pelo|pela|servidor|entrar|enviar|agora|aqui|quem|todos|tudo|nova|novo|clique|espere|carregando|reconectando)\b/i;

/** Atributos que viram texto na tela: dica do mouse, rótulo de leitor de tela, exemplo no campo. */
const ATRIBUTOS = /(?:title|aria-label|placeholder|alt)="([^"]{3,})"/g;

/**
 * Texto solto entre tags: <span>Alguma coisa</span>.
 *
 * ELE TAMBÉM NÃO EXIGE MAIS PARECER PORTUGUÊS, pelo mesmo motivo da busca de palavra solta logo
 * abaixo — e o caso que obrigou a mudança foi `<h3>Selo da comunidade</h3>`. Não tem acento, e
 * nenhuma das suas palavras estava na lista de palavras comuns (havia "das" e "dos", não "da").
 * Ficou em português nas dezesseis línguas, bem no meio da tela da comunidade, enquanto a contagem
 * marcava zero.
 *
 * Exigir que o texto "pareça" português nunca podia dar certo aqui: português é uma língua inteira,
 * e a lista é de vinte e tantas palavras. Entre duas tags, o normal é texto para ler; o código é a
 * exceção, e a exceção se prova pela lista NAO_TRADUZ.
 */
const SOLTOS = />\s*([A-ZÀ-Ú][^<>{}\n]{3,80}?)\s*</g;

/**
 * Texto solto que ATRAVESSA A QUEBRA DE LINHA.
 *
 * Terceiro ponto cego, e o mais discreto: `[^<>{}\n]` também exclui o `\n`. Um parágrafo que não
 * coube numa linha — e num arquivo formatado a 130 colunas isso é todo parágrafo um pouco longo —
 * nunca foi visto por ninguém:
 *
 *   <p className="settings-hint">
 *     Administradores podem apagar mensagens de qualquer pessoa, gerenciar todos os canais, emojis e sons desta
 *     comunidade e remover membros. Só o dono dá e tira esse cargo.
 *   </p>
 *
 * Esta busca aceita a quebra e normaliza o espaço, porque é assim que o navegador desenha: as duas
 * linhas viram uma frase só na tela, e é essa frase que vai para o dicionário. Guardar a quebra na
 * chave faria o dicionário depender de onde o formatador decidiu cortar — e ele muda de ideia a cada
 * palavra acrescentada.
 */
const SOLTOS_EM_VARIAS_LINHAS = />\s*\n\s*([A-ZÀ-Ú][^<>{}]{3,300}?)\s*\n\s*</g;

/**
 * LITERAL DENTRO DE EXPRESSÃO: {isOwner ? 'Apagar comunidade' : 'Sair da comunidade'}.
 *
 * ESTE É O MAIOR PONTO CEGO QUE ESTA FERRAMENTA JÁ TEVE, e ele estava escrito na própria busca de
 * texto solto: `[^<>{}\n]` exclui a chave. Qualquer texto dentro de `{…}` era invisível — e `{…}` é
 * onde mora metade da tela, porque é onde moram o ternário, o rótulo que muda com o estado e a
 * propriedade de componente. A contagem dizia ZERO textos cravados, a tradução dizia 100%, e
 * "Apagar comunidade", "Selo da comunidade", "Supressão de ruído", as nove explicações do seletor de
 * tela e mais trezentas frases continuavam em português em todas as dezesseis línguas.
 *
 * O sintoma era o pior possível, e é o mesmo de sempre: parecia tradução malfeita, e não tradução
 * faltando. Quem escolhe coreano e vê "Apagar comunidade" no meio da tela conclui que o app está
 * quebrado, não que aquele pedaço nunca foi marcado.
 *
 * A SUSPEITA SE INVERTE AQUI, como já se invertia na busca de palavra solta: um literal que pareça
 * FRASE é para traduzir até prova em contrário. A prova vem das listas abaixo — e elas existem porque
 * `.tsx` é cheio de texto entre aspas que ninguém lê: nome de classe, verbo de HTTP, pedaço de
 * endereço, chave de objeto.
 */
const EM_EXPRESSAO = /(['"])((?:(?!\1)[^\\\n]|\\.){0,160})\1/g;

/** Parece frase, e não identificador: tem espaço, ou acento, ou começa com maiúscula. */
const PARECE_FRASE = /\s|[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]|^[A-ZÀ-Ú]/;

/**
 * O que vem ANTES do literal e prova que ele é código.
 *
 * `className=`, `id=`, `href=` e companhia vão para a folha de estilo ou para a rede, não para o olho.
 * Depois de `===` é comparação. Depois de `.`, `[`, `(` ou `,` costuma ser argumento ou chave.
 */
const CONTEXTO_DE_CODIGO =
  /(?:className|class|id|htmlFor|key|name|type|role|href|src|rel|target|autoComplete|inputMode|accept|method|action|data-[\w-]+|aria-(?:controls|labelledby|describedby|live|hidden))\s*=\s*\{?\s*$|(?:===|!==|==|!=|\bcase\b|\?\?|\|\||&&)\s*$|[.[(,]\s*$|\bvar\(\s*$/;

/**
 * A forma do literal denuncia: nome-de-classe, chave.com.ponto, endereço, pedaço de template.
 *
 * As duas últimas são DESENHO. O Syden tem muito SVG escrito à mão — o coelho, a vila, a medalha — e
 * `d="M0,0 H38 L30,9 Z"` é uma frase para o navegador, não para ninguém. Elas entram aqui e não na
 * lista de contexto porque a geometria às vezes mora numa constante, longe do atributo que a usa.
 */
const FORMA_DE_CODIGO = [
  /^[a-z0-9]+(?:[-_.:/][a-z0-9]+)+$/i,
  /^(?:[a-z0-9]+-[a-z0-9-]*)(?:\s+[a-z0-9-]+)*$/,
  /^[a-z]+:/i,
  /[{}$<>]/,
  /^[\s\d.,+-]*[MLHVCSQTAZmlhvcsqtaz][\s\dMLHVCSQTAZmlhvcsqtaz.,+-]*$/, // traçado de SVG
  /^[\s\d.,+-]+$/, // viewBox e pontos de polígono: só números
  /^(?:translate|rotate|scale|matrix|skew[XY]?)\(/, // transformação de SVG
];

/** Verbo de HTTP e cabeçalho: maiúsculos, mas ninguém os lê na tela. */
const NAO_E_TELA = new Set(['PUT', 'POST', 'DELETE', 'PATCH', 'GET', 'HEAD', 'OPTIONS', 'Content-Type', 'Authorization']);

/** Pedaço de nome de classe montado em template: ` active`, ` exibindo`, `disabled `. */
const PEDACO_DE_CLASSE = /^\s+[a-z-]+\s*$|^\s*[a-z-]+\s+$/;

/**
 * UMA PALAVRA SÓ entre tags: <h2>Comunidade</h2>.
 *
 * Precisa de regra própria porque a de cima exige que o texto PAREÇA português — e "Comunidade",
 * "Imagem", "Convite", "Membros" não têm acento nem caem na lista de palavras comuns. Vinte e dois
 * rótulos escaparam por essa fresta, e o sintoma seria o pior possível: a tela em inglês com meia
 * dúzia de títulos em português no meio, parecendo tradução malfeita em vez de tradução faltando.
 *
 * Aqui a suspeita se inverte: um rótulo de uma palavra, com inicial maiúscula, é para traduzir até
 * prova em contrário — e a prova é a lista de exceções logo abaixo.
 */
const PALAVRA_SOLTA = />\s*([A-ZÀ-Ú][A-Za-zÀ-ú]{2,30})\s*</g;

/** O que NÃO se traduz: o nome do produto, e palavras que são as mesmas em toda língua. */
const NAO_TRADUZ = new Set(['Syden', 'Discord', 'Windows', 'Minecraft', 'GIF', 'PNG', 'JPG', 'WEBP', 'Emojis', 'Soundboard']);

/** Linha de TypeScript, e não de tela: `Promise<T>` casa com a busca de palavra solta, e não é texto. */
const PARECE_TIPO = /\b(Promise|Array|Record|Map|Set|Partial|Pick|Omit)\s*</;

/**
 * Tudo o que já passa por t('...') ou está marcado com chave('...').
 *
 * O `chave()` é obrigatório aqui, e não um luxo. Onde o texto se separa do t() — um rótulo guardado numa
 * lista e desenhado com `t(aba.label)` — a tradução funciona e esta busca não vê nada. A primeira versão
 * desta ferramenta concluiu, por isso, que nove traduções boas eram lixo e mandou apagá-las. Ferramenta
 * que manda apagar o que funciona é pior do que ferramenta nenhuma, porque ela tem autoridade.
 */
const CHAMADAS_T = /\b(?:t|chave)\(\s*(['"`])((?:(?!\1).)+)\1/g;

/**
 * Varre a pasta do site.
 *
 * @param raiz onde começar (normalmente 'web/src')
 * @returns {{ cravados: {arquivo: string, linha: number, tipo: string, conteudo: string}[], chaves: Set<string> }}
 */
export function varrerTextos(raiz = 'web/src') {
  const cravados = [];
  const chaves = new Set();

  const anda = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, f.name);
      if (f.isDirectory()) {
        // O próprio i18n guarda os textos em português como CHAVE: acusá-los seria acusar o dicionário.
        if (f.name !== 'i18n') anda(caminho);
        continue;
      }
      if (!f.name.endsWith('.tsx') && !f.name.endsWith('.ts')) continue;

      const texto = readFileSync(caminho, 'utf8');

      for (const m of texto.matchAll(CHAMADAS_T)) chaves.add(m[2]);

      // Só .tsx tem tela. Um .ts pode ter chave de t(), mas não tem JSX para acusar.
      if (!f.name.endsWith('.tsx')) continue;

      const linhas = texto.split('\n');
      const linhaDe = (indice) => texto.slice(0, indice).split('\n').length;

      const vistos = new Set();
      for (const [regex, tipo] of [
        [ATRIBUTOS, 'atributo'],
        [SOLTOS, 'solto'],
        [SOLTOS_EM_VARIAS_LINHAS, 'parágrafo'],
        [PALAVRA_SOLTA, 'palavra'],
        [EM_EXPRESSAO, 'expressão'],
      ]) {
        for (const m of texto.matchAll(regex)) {
          const bruto = (tipo === 'expressão' ? m[2] : m[1]).trim();
          // O navegador junta as linhas numa frase só; a chave do dicionário tem de ser essa frase.
          const conteudo = tipo === 'parágrafo' ? bruto.replace(/\s+/g, ' ') : bruto;
          if (tipo === 'expressão') {
            if (conteudo.length < 3) continue;
            if (NAO_E_TELA.has(conteudo)) continue;
            if (PEDACO_DE_CLASSE.test(m[2])) continue;
            if (!PARECE_FRASE.test(conteudo)) continue;
            if (FORMA_DE_CODIGO.some((r) => r.test(conteudo))) continue;
            // O que já passa por t() ou chave() é chave de dicionário, não dívida.
            if (chaves.has(conteudo)) continue;
            const ateAqui = texto.slice(0, m.index);
            if (CONTEXTO_DE_CODIGO.test(ateAqui.slice(ateAqui.lastIndexOf('\n') + 1))) continue;
          }
          // NENHUMA DAS BUSCAS EXIGE MAIS "PARECER PORTUGUÊS", e a de atributo foi a última a largar.
          // `title="Remover membro"` não tem acento nem nenhuma das palavras da lista, então era
          // descartado aqui — e depois recolhido pela busca de expressão, com o TIPO ERRADO. O tipo é
          // o que decide como scripts/marcar-textos.mjs reescreve: atributo vira `title={t('…')}`, e
          // expressão vira `t('…')` cru. O resultado foi `title=t('Remover membro')`, que não é JSX
          // válido. Uma lista de palavras errando o tipo quebrou o arquivo em sete lugares.
          if (NAO_TRADUZ.has(conteudo)) continue;
          const linha = linhaDe(m.index);
          const bruta = linhas[linha - 1] ?? '';
          // Comentário não vai para a tela.
          if (/^\s*(\/\/|\*|\/\*)/.test(bruta)) continue;
          if (tipo === 'palavra' && PARECE_TIPO.test(bruta)) continue;
          // A busca de frase e a de palavra se sobrepõem num texto de uma palavra só; contar duas
          // vezes inflaria a dívida e faria a catraca pedir para baixar um número que nunca desce.
          const marca = linha + '\u0000' + conteudo;
          if (vistos.has(marca)) continue;
          vistos.add(marca);
          cravados.push({ arquivo: caminho.replace(/\\/g, '/'), linha, tipo, conteudo });
        }
      }
    }
  };

  anda(raiz);
  return { cravados, chaves };
}

/** Quantos textos cravados por arquivo, do pior para o melhor. */
export function porArquivo(cravados) {
  const conta = new Map();
  for (const c of cravados) conta.set(c.arquivo, (conta.get(c.arquivo) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1]);
}
