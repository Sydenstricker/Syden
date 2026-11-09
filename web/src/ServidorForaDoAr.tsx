import { useEffect, useRef, useState } from 'react';
import { API_URL } from './api';
import { useT } from './i18n';
import { Mascote } from './Mascote';

/**
 * A tela de quando o SERVIDOR cai (pergunta dele em 09/11/2026, depois da queda de 08/11: "não deveria aparecer a tela
 * do erro 500?").
 *
 * O site não mora no servidor da Hetzner, então ele continua abrindo quando a API cai, e só os pedidos falham. Antes
 * disso, quem abria o Syden durante a queda caía na tela de ENTRADA (a sessão guardada não se confirmava) e lia "Não
 * foi possível falar com o servidor." embaixo da senha: a tela dizia que a pessoa estava fora da conta, o que não era
 * verdade, e a fazia digitar a senha à toa. Quem já estava dentro via só a faixa "Reconectando…".
 *
 * Qualquer pedido que não consegue falar com a API (ou recebe 502/503/504 do Caddy) avisa por um evento
 * (`api.ts`), e esta tela CONFERE antes de aparecer: a API não responde duas vezes seguidas, com 3 s entre elas, e o
 * próprio site responde — é assim que ela separa "o servidor caiu" de "a sua internet caiu", que pedem coisas
 * diferentes de quem lê. Um pedido que falha sozinho, com a API respondendo, não mostra nada.
 *
 * Fica por cima de tudo enquanto durar, tenta de novo sozinha a cada 10 s e SOME quando o servidor volta. Se a queda
 * pegou o Syden abrindo (a sessão não pôde ser confirmada), a volta recarrega a página, que entra na conta guardada.
 */

const EVENTO = 'syden:api-falhou';
const ENTRE_CONFERENCIAS_MS = 3_000;
const DE_NOVO_MS = 10_000;

type Estado = 'no-ar' | 'servidor' | 'internet';

let recarregarNaVolta = false;

/** A sessão guardada não pôde ser confirmada por causa da queda: quando o servidor voltar, a página recarrega. */
export function recarregarQuandoOServidorVoltar() {
  recarregarNaVolta = true;
}

async function responde(url: string): Promise<boolean> {
  try {
    const resposta = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    return resposta.ok;
  } catch {
    return false;
  }
}

async function conferir(): Promise<Estado> {
  if (await responde(`${API_URL}/api/health`)) return 'no-ar';
  if (!navigator.onLine) return 'internet';
  // O site responde e a API não: o problema é do servidor. Nenhum dos dois responde: é a internet de quem lê.
  const site = await responde(`${import.meta.env.BASE_URL}manifest.webmanifest?sonda=${Date.now()}`);
  return site ? 'servidor' : 'internet';
}

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

export function ServidorForaDoAr() {
  const t = useT();
  const [estado, setEstado] = useState<Estado>('no-ar');
  const conferindo = useRef(false);

  // Um aviso de falha começa a conferência (uma de cada vez): só duas falhas seguidas mostram a tela.
  useEffect(() => {
    const aoFalhar = async () => {
      if (conferindo.current) return;
      conferindo.current = true;
      try {
        let agora = await conferir();
        if (agora !== 'no-ar') {
          await esperar(ENTRE_CONFERENCIAS_MS);
          agora = await conferir();
        }
        if (agora !== 'no-ar') setEstado(agora);
      } finally {
        conferindo.current = false;
      }
    };
    window.addEventListener(EVENTO, aoFalhar);
    window.addEventListener('offline', aoFalhar);
    return () => {
      window.removeEventListener(EVENTO, aoFalhar);
      window.removeEventListener('offline', aoFalhar);
    };
  }, []);

  // Com a tela à vista, tenta de novo sozinha; a volta da internet também confere na hora.
  useEffect(() => {
    if (estado === 'no-ar') return;
    let vivo = true;
    const tentar = async () => {
      const agora = await conferir();
      if (!vivo) return;
      if (agora === 'no-ar' && recarregarNaVolta) return window.location.reload();
      setEstado(agora);
    };
    const relogio = setInterval(tentar, DE_NOVO_MS);
    window.addEventListener('online', tentar);
    return () => {
      vivo = false;
      clearInterval(relogio);
      window.removeEventListener('online', tentar);
    };
  }, [estado]);

  if (estado === 'no-ar') return null;

  const tentarAgora = async () => {
    const agora = await conferir();
    if (agora === 'no-ar' && recarregarNaVolta) return window.location.reload();
    setEstado(agora);
  };

  return (
    <div className="erro-geral servidor-fora-do-ar" role="alert">
      {estado === 'servidor' ? (
        <>
          <Mascote nome="erro-500" tamanho={220} />
          <p className="erro-geral-codigo">{t('503 — O servidor do Syden não está respondendo')}</p>
          <h1>{t('O Syden está fora do ar')}</h1>
          <p>{t('Não é a sua internet: o nosso servidor parou de responder. Quando ele voltar, esta tela some sozinha.')}</p>
        </>
      ) : (
        <>
          <Mascote nome="sem-internet" tamanho={220} />
          <p className="erro-geral-codigo">{t('OFFLINE — Sem conexão com a internet')}</p>
          <h1>{t('Sem internet')}</h1>
          <p>{t('Quando a conexão voltar, esta tela some sozinha.')}</p>
        </>
      )}
      <button type="button" className="btn-primary" onClick={() => void tentarAgora()}>
        {t('Tentar de novo')}
      </button>
    </div>
  );
}
