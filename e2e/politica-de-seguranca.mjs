// A política de segurança do site do Syden, sozinha.
//
// POR QUE ELA MORA NUM ARQUIVO SÓ DELA. Ela estava dentro de e2e/csp.mjs, que é um PROGRAMA: abre um
// navegador e mede o site de verdade. Quando um segundo teste quis a mesma política e a importou de
// lá, importar passou a executar a verificação inteira — inclusive contra o site em produção, sem
// ninguém ter pedido. Política é DADO; conferir política é programa. Separados, importar não faz nada.
//
// =====================================================================================================
// ISTO NÃO É A POLÍTICA QUE ESTÁ NO AR. É a que a gente PROPÕE, e é a que os testes medem.
//
// A do ar é uma Transform Rule escrita À MÃO no painel da Cloudflare (Rules → Transform Rules →
// Modify Response Header), porque o site é servido pelo GitHub Pages, que não deixa pôr cabeçalho
// nenhum. Mexer neste arquivo NÃO muda nada para quem usa o Syden.
//
// Custou um defeito em produção para isto ficar escrito: em 30/09/2026 os GIFs entraram, os endereços
// do GIPHY foram acrescentados AQUI, e no ar toda figura continuou bloqueada em silêncio — o seletor
// achava os GIFs e mostrava só o texto alternativo de cada um, que é como CSP falha: sem aviso.
//
// DEPOIS DE MEXER AQUI, RODE:  node scripts/conferir-csp.mjs
// Ele compara esta política com a que o syden.chat manda de verdade e imprime o que falta colar. Sem
// ele, a única forma de achar a diferença é alguém esbarrar nela.
// =====================================================================================================


/**
 * A política proposta.
 *
 * Cada linha existe por um motivo concreto, e tirar qualquer uma quebra alguma coisa:
 *
 *   connect-src   o site conversa com a API (mensagens) e com o LiveKit (voz), nos dois casos por HTTPS
 *                 E por WebSocket. Faltando o wss:, a voz não conecta e o chat não atualiza sozinho.
 *   img-src       os avatares e emojis vêm da API; `data:` é para o que o app desenha em canvas (o selo
 *                 do ícone, o confete); `blob:` é para a foto do clipe e as miniaturas de transmissão.
 *   media*.giphy.com
 *                 os GIFs. Eles vêm do GIPHY e não de nós de propósito: os termos deles pedem isso, e
 *                 guardar cópia encheria o disco do servidor com o que já está hospedado de graça. Os
 *                 domínios estão ESCRITOS UM A UM, e não como `*.giphy.com`: a estrela liberaria
 *                 qualquer subdomínio que eles criarem ou perderem um dia, e esta lista é exatamente a
 *                 mesma que web/src/gifs.ts aceita transformar em figura. Duas listas, um só conteúdo —
 *                 se uma crescer sem a outra, o GIF aparece quebrado (ou é bloqueado sem dizer nada).
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
 *   fonts.*       a Noto, para os idiomas de escrita não latina, não cirílica e não grega (ver
 *                 prepararFonte, em web/src/i18n/index.ts). Só quem usa um desses idiomas faz o pedido,
 *                 e o Google vê o endereço de rede dela — está declarado na política de privacidade.
 *                 Hospedar a Noto junto com o site tiraria duas linhas desta política.
 *   worker-src    o tocador de som cru e o processamento do LiveKit rodam em workers.
 *   frame-ancestors 'none'  ninguém põe o Syden dentro de um quadro. É o que impede clickjacking — e é o
 *                 único item desta lista que NÃO funciona por meta tag, só por cabeçalho.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://api.syden.chat https://media.giphy.com https://media0.giphy.com https://media1.giphy.com https://media2.giphy.com https://media3.giphy.com https://media4.giphy.com https://i.giphy.com",
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
