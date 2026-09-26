import { useEffect, useRef } from 'react';

/**
 * O quadradinho "confirme que você é uma pessoa" da Cloudflare, no cadastro.
 *
 * Na maioria das vezes ele nem pede nada: olha o comportamento do navegador e resolve sozinho. Só
 * aparece se o servidor tiver a chave configurada — sem ela, este componente nem é montado, e o Syden
 * funciona como sempre. É o mesmo princípio do e-mail: nada aqui pode exigir conta na Cloudflare para
 * o projeto rodar.
 *
 * O script vem da Cloudflare e é carregado uma vez só, na primeira vez que a tela de cadastro precisa.
 */

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (alvo: HTMLElement, opcoes: { sitekey: string; callback: (token: string) => void; theme?: string }) => string;
      remove: (id: string) => void;
    };
  }
}

let carregando: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise((pronto, falhou) => {
    const tag = document.createElement('script');
    tag.src = SCRIPT;
    tag.async = true;
    tag.onload = () => pronto();
    tag.onerror = () => falhou(new Error('não carregou'));
    document.head.appendChild(tag);
  });
  return carregando;
}

export function Turnstile({ siteKey, aoResolver }: { siteKey: string; aoResolver: (token: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const resolverRef = useRef(aoResolver);
  resolverRef.current = aoResolver;

  useEffect(() => {
    let id: string | undefined;
    let vivo = true;

    void carregarScript()
      .then(() => {
        if (!vivo || !caixa.current || !window.turnstile) return;
        id = window.turnstile.render(caixa.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token) => resolverRef.current(token),
        });
      })
      // Cloudflare fora do ar ou bloqueada por uma extensão: o servidor decide o que fazer com a falta
      // do comprovante. Travar o cadastro aqui seria pior do que deixar passar.
      .catch(() => {});

    return () => {
      vivo = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey]);

  return <div className="turnstile" ref={caixa} />;
}
