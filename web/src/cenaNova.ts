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
  return conferencia;
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
