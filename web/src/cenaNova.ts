import { useEffect, useState } from 'react';

/**
 * O QUARTO NOVO E O SALÃO ISOMÉTRICO NO AR (16/10/2026, decisão dele: "o quarto novo substitui para todo mundo, assim
 * como o salão isométrico"). As duas cenas são páginas do próprio site num iframe (QuartoNovo.tsx, SalaoNovo.tsx), e
 * o iframe depende de três cabeçalhos que moram no painel da Cloudflare, e não no repositório: `frame-src` com 'self',
 * `frame-ancestors` que não seja 'none' e `X-Frame-Options` que não seja DENY. Com qualquer um deles fechado, a cena
 * abriria um quadro em branco no lugar da home.
 *
 * Então, antes de mostrar a cena, pergunta-se à própria página dela (um HEAD, do mesmo site: os cabeçalhos são legíveis)
 * se ela pode ser embutida. Não podendo, ou se a cena não disser "pronto" a tempo (`desistir`), fica a cena antiga
 * (Quarto.tsx, Salao.tsx). A tela não mostra um quadro vazio, e o site pode subir antes do painel ser ajustado.
 */
export type CenaNova = 'conferindo' | 'nova' | 'antiga';

let conferencia: Promise<boolean> | null = null;
let desistiu = false;

/** A política permite pôr a página da cena num iframe do próprio site? */
export function cabecalhosPermitem(cabecalhos: { get(nome: string): string | null }): boolean {
  if ((cabecalhos.get('x-frame-options') ?? '').trim().toUpperCase() === 'DENY') return false;
  const csp = cabecalhos.get('content-security-policy') ?? '';
  const diretiva = (nome: string) =>
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .find((d) => d[0] === nome)
      ?.slice(1);
  const ancestrais = diretiva('frame-ancestors');
  if (ancestrais && (ancestrais.includes("'none'") || !ancestrais.some((v) => v === "'self'" || v === '*'))) return false;
  // frame-src (ou, sem ele, child-src e default-src): o app abrindo a página dele mesmo
  const quadros = diretiva('frame-src') ?? diretiva('child-src') ?? diretiva('default-src');
  if (quadros && !quadros.some((v) => v === "'self'" || v === '*')) return false;
  return true;
}

function conferir(endereco: string): Promise<boolean> {
  if (import.meta.env.DEV) return Promise.resolve(true);
  conferencia ??= fetch(endereco, { method: 'HEAD', cache: 'no-store' })
    .then((r) => r.ok && cabecalhosPermitem(r.headers))
    .catch(() => false);
  void conferencia.then((ok) => ok && precarregarCenas());
  return conferencia;
}

/**
 * AS DUAS CENAS BAIXADAS DE ANTEMÃO (pedido dele, 16/10/2026: "demorei uns 15 segundos para carregar o salão, que tal
 * carregar salão e quarto na tela de carregamento?"). Com o app aberto e a cena liberada, baixa em segundo plano, com
 * prioridade baixa, a página, o script e o pacote de imagens do quarto e do salão (precarregar.json, do build). Ficam no
 * cache do navegador, e abrir o início ou a comunidade só monta a cena. Uma vez por sessão; falha calada (é só adiantar).
 */
let precarregou = false;
function precarregarCenas() {
  if (precarregou || import.meta.env.DEV) return;
  precarregou = true;
  const baixar = (url: string) => fetch(url, { priority: 'low' } as RequestInit).then((r) => r.arrayBuffer()).catch(() => null);
  const quando = (window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 2000));
  quando(
    () => {
      void (async () => {
        for (const cena of ['quarto-novo/', 'salao-novo/']) {
          const pagina = new URL(import.meta.env.BASE_URL + cena, location.href);
          const lista = await fetch(new URL('precarregar.json', pagina), { priority: 'low' } as RequestInit)
            .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
            .catch(() => []);
          await Promise.all([baixar(pagina.href), ...lista.map((u) => baixar(new URL(u, pagina).href))]);
        }
      })();
    },
    { timeout: 4000 },
  );
}

/** Qual cena mostrar: a nova, se a página dela pode ser embutida, e a antiga, se não pode (ou se desistiu). */
export function usarCenaNova(endereco: string): { cena: CenaNova; desistir: () => void } {
  const [cena, setCena] = useState<CenaNova>(desistiu ? 'antiga' : 'conferindo');
  useEffect(() => {
    if (desistiu) return;
    let vivo = true;
    void conferir(endereco).then((ok) => {
      if (vivo) setCena(ok && !desistiu ? 'nova' : 'antiga');
    });
    return () => {
      vivo = false;
    };
  }, [endereco]);
  return {
    cena,
    desistir: () => {
      desistiu = true;
      setCena('antiga');
    },
  };
}
