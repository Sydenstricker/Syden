import { chave } from './i18n';

/**
 * O RECIBO DO BOT DAS IDEIAS, PALAVRA POR PALAVRA COMO O SERVIDOR O GRAVA.
 *
 * O servidor responde na hora a quem manda uma ideia pela tela inicial, e essa resposta era a única
 * coisa do Syden que chegava sempre em português, em qualquer idioma — porque ela não é interface, é
 * o CONTEÚDO de uma mensagem guardada no banco (ver server/src/direct-routes.ts).
 *
 * A saída usa a propriedade que o i18n do Syden tem e quase nenhum outro teria: **a chave É o texto
 * em português**. O servidor continua gravando a frase em português — o que mantém o banco legível e
 * qualquer cliente antigo mostrando algo certo — e a tela a passa por `t()` como qualquer outra.
 * Idioma sem tradução cai no português, que é o que o resto do app já faz.
 *
 * MORA NUM ARQUIVO SÓ DELA, e não dentro do componente que a usa, por um motivo prático: o teste que
 * confere as duas cópias precisa importá-la, e importar o componente arrastaria React e `window` para
 * dentro do Node.
 *
 * O `chave()` não transforma nada (ele devolve o próprio texto): ele existe para a varredura de
 * scripts/lib/textos-cravados.mjs enxergar esta frase como chave de tradução. Sem ele, ela contaria
 * como texto cravado E como tradução órfã nos 25 dicionários ao mesmo tempo.
 */
export const RECIBO_DA_IDEIA = chave(
  '🤖 Recado automático: sua ideia chegou, obrigado! Vou ler com calma. Se eu tiver dúvida, pergunto por aqui mesmo — e se ela entrar no Syden, você vai saber na hora.',
);
