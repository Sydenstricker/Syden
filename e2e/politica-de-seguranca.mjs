// A política de segurança do site do Syden, sozinha.
//
// POR QUE ELA MORA NUM ARQUIVO SÓ DELA. Ela estava dentro de e2e/csp.mjs, que é um PROGRAMA: abre um
// navegador e mede o site de verdade. Quando um segundo teste quis a mesma política e a importou de
// lá, importar passou a executar a verificação inteira — inclusive contra o site em produção, sem
// ninguém ter pedido. Política é DADO; conferir política é programa. Separados, importar não faz nada.


/**
 * A política proposta.
 *
 * Cada linha existe por um motivo concreto, e tirar qualquer uma quebra alguma coisa:
 *
 *   connect-src   o site conversa com a API (mensagens) e com o LiveKit (voz), nos dois casos por HTTPS
 *                 E por WebSocket. Faltando o wss:, a voz não conecta e o chat não atualiza sozinho.
 *   img-src       os avatares e emojis vêm da API; `data:` é para o que o app desenha em canvas (o selo
 *                 do ícone, o confete); `blob:` é para a foto do clipe e as miniaturas de transmissão.
 *   media-src     sons do soundboard e karaokê vêm da API; `blob:` é o áudio e o vídeo da chamada.
 *   style-src     'unsafe-inline' é inevitável: o React escreve `style=` direto nos elementos, e o
 *                 LiveKit injeta folhas de estilo próprias. Sem isso a tela abre sem formatação nenhuma.
 *   frame-src     o Turnstile da Cloudflare é um quadro dentro da nossa página.
 *   static.cloudflareinsights.com
 *                 a medição de audiência, que a Cloudflare injeta sozinha nas páginas enquanto o proxy
 *                 está ligado. Ela só pode estar liberada aqui porque está DECLARADA na política de
 *                 privacidade, na seção "Medição do site" — essa é a condição, e se um dia a medição
 *                 for desligada no painel, esta linha sai junto. O envio dela vai para /cdn-cgi/rum,
 *                 no NOSSO domínio, então connect-src 'self' já cobre: não há um segundo endereço.
 *   fonts.*       a letra do Syden vem do Google Fonts (ver web/index.html). Vale saber o preço disso:
 *                 cada pessoa que abre o Syden faz um pedido aos servidores do Google, e o Google vê o
 *                 endereço de rede dela. Hospedar a fonte junto com o site resolveria e tiraria duas
 *                 linhas desta política.
 *   worker-src    o tocador de som cru e o processamento do LiveKit rodam em workers.
 *   frame-ancestors 'none'  ninguém põe o Syden dentro de um quadro. É o que impede clickjacking — e é o
 *                 único item desta lista que NÃO funciona por meta tag, só por cabeçalho.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://api.syden.chat",
  "media-src 'self' blob: https://api.syden.chat",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.syden.chat wss://api.syden.chat https://live.syden.chat wss://live.syden.chat",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');
