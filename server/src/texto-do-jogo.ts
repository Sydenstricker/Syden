/**
 * O TEXTO LIVRE DENTRO DE UM JOGO (24/11/2026, o telefone sem fio do Desenha e adivinha): a frase que alguém escreve e que a
 * turma vai ler passa pelas mesmas regras de CONTEÚDO da conversa da comunidade (o silêncio, as palavras proibidas e os links,
 * de automod.ts), e quem administra não passa por elas, como nas mensagens.
 *
 * O banco entra por import dinâmico (como em recorde-solo-tardio.ts): os jogos são importados por testes do site, que não sobem
 * o banco. `prepararModeracao` é chamado quando a partida começa; até a importação chegar (milissegundos), o texto passa.
 */

type Barrar = (comunidade: number, userId: number, texto: string) => string | null;

let barrar: Barrar | null = null;
let pedido: Promise<void> | null = null;

export function prepararModeracao(): void {
  if (pedido) return;
  pedido = Promise.all([import('./db.js'), import('./automod.js')])
    .then(([db, automod]) => {
      barrar = (comunidade, userId, texto) => {
        const agora = Date.now();
        const silencio = db.silenciadoAte(comunidade, userId, agora);
        if (silencio) return 'Você está em silêncio nesta comunidade.';
        const papel = db.memberRole(comunidade, userId);
        if (papel === 'owner' || papel === 'admin') return null;
        const regras = db.regrasDeModeracao(comunidade);
        if (regras.palavras.some((p) => automod.contemPalavra(texto, p))) return 'Esta comunidade não permite uma das palavras desta mensagem.';
        if (regras.links && automod.temLink(texto)) return 'Esta comunidade não permite links nas mensagens.';
        return null;
      };
    })
    .catch(() => {
      pedido = null;
    });
}

/** O motivo de o texto não poder entrar, ou null. Sem comunidade (o Solo), nada barra. */
export function textoBarrado(comunidade: number | undefined, userId: number, texto: string): string | null {
  if (!comunidade || !barrar) return null;
  return barrar(comunidade, userId, texto);
}
