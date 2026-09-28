// De onde se baixa o Syden para Windows.
//
// A MICROSOFT STORE É O CAMINHO PREFERIDO, e não por elegância. Um .exe baixado da internet e não
// assinado faz o Windows mostrar "O Windows protegeu o seu PC", com um botão de instalar escondido
// atrás de "Mais informações" — a tela que ensina qualquer pessoa sensata a desistir. Pela Store não
// há esse aviso, a atualização chega sozinha, e desinstalar não deixa restos.
//
// O .exe continua existindo porque nem todo Windows tem a Store (edições LTSC, máquinas de empresa com
// ela desligada), e porque alguém pode simplesmente preferir. Mas ele deixou de ser o primeiro botão.

/**
 * O endereço do Syden na Microsoft Store.
 *
 * PARA PREENCHER: abra a página do Syden na Store e copie o código do endereço. Ele aparece assim —
 * apps.microsoft.com/detail/XXXXXXXXXXXX — e é esse XXXXXXXXXXXX que entra aqui.
 *
 * Enquanto estiver vazio, tudo continua como antes: o botão leva ao instalador. Nada quebra por
 * esquecimento, e é de propósito que o valor vazio seja o comportamento antigo, e não um link morto.
 *
 * Fica no código, e não numa variável do painel do GitHub, pela mesma razão do endereço do app: uma
 * variável de painel pode estar com outro valor guardado de meses atrás, e ninguém lembra de conferir.
 */
const ID_NA_STORE = '9NPVXDKV471H';

/** O endereço https, e não o ms-windows-store://. O https funciona em qualquer lugar — e no Windows o
 *  próprio sistema oferece abrir a Store. O outro esquema falha em silêncio fora do Windows. */
export const STORE_URL: string = ID_NA_STORE ? `https://apps.microsoft.com/detail/${ID_NA_STORE}` : '';

/** Link direto do instalador (GitHub Releases, sempre a versão mais recente). Definido no build do site. */
export const DESKTOP_DOWNLOAD_URL: string = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || '';

/** Para onde o botão principal leva: a Store quando ela existe, o instalador enquanto não. */
export const LINK_PRINCIPAL: string = STORE_URL || DESKTOP_DOWNLOAD_URL;

/** O botão principal diz "Baixar na Microsoft Store" ou "Baixar para Windows"? */
export const PELA_STORE = STORE_URL !== '';

const userAgent = navigator.userAgent;

/** Só oferece o app para quem está no navegador do Windows: o instalador é só para Windows, e dentro do app não faz sentido. */
export const showDesktopDownload =
  LINK_PRINCIPAL !== '' && userAgent.includes('Windows') && !userAgent.includes('Electron');
