/**
 * Onde o Syden está rodando, em poucas letras: "app 0.1.7", "Chrome 154", "Firefox 131".
 *
 * Vai junto com cada problema que o computador de alguém conta ao diário da aba de saúde (ver
 * reportProblem, em useVoice.ts). A pergunta que motivou foi "o app tem menos problemas que o
 * navegador?" — e sem a origem em cada linha não havia como responder.
 *
 * Lê só o que o navegador já manda para todo site (o userAgent); nada de impressão digital. A ordem
 * importa: o Edge e o Opera dizem "Chrome" também, e o Chrome diz "Safari".
 */
export function ondeRoda(userAgent: string, noApp: boolean): string {
  if (noApp) {
    // O Electron põe o nome e a versão do app no texto sozinho ("Syden/0.1.7").
    const versao = /\bSyden\/([\d.]+)/i.exec(userAgent)?.[1];
    return versao ? `app ${versao}` : 'app';
  }
  const navegadores: [string, RegExp][] = [
    ['Edge', /\bEdg(?:e|A|iOS)?\/(\d+)/],
    ['Opera', /\bOPR\/(\d+)/],
    ['Firefox', /\bFirefox\/(\d+)/],
    ['Chrome', /\bChrome\/(\d+)/],
    ['Safari', /\bVersion\/(\d+)[\d.]* .*Safari\//],
  ];
  for (const [nome, padrao] of navegadores) {
    const versao = padrao.exec(userAgent)?.[1];
    if (versao) return `${nome} ${versao}`;
  }
  return 'navegador';
}
