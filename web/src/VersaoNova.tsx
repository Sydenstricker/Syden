import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from './i18n';

/**
 * "Versão nova do Syden — recarregar", quando o site no ar mudou depois que esta aba abriu.
 *
 * O Syden carrega uma vez e fica aberto por dias: sem isto, quem não recarrega continua na versão de
 * antes do deploy e vê o que já foi consertado (relato de 12/10/2026: o menu de compartilhar com três
 * opções, horas depois de ele ter virado dois).
 *
 * NUNCA recarrega sozinho: recarregar derruba a chamada de quem está nela. O aviso fica no alto até a
 * pessoa escolher a hora. E não pergunta nada a terceiro: o versao.json mora ao lado do próprio app
 * (ver o plugin em vite.config.ts).
 */
const MINHA_VERSAO: string | undefined = import.meta.env.VITE_VERSAO;
// Dez minutos: o deploy não tem pressa de ser notado, e a pergunta é um arquivo de poucos bytes.
const DE_QUANTO_EM_QUANTO_MS = 10 * 60_000;

export function VersaoNova() {
  const t = useT();
  const [mudou, setMudou] = useState(false);

  useEffect(() => {
    // Em desenvolvimento não há versao.json, e o Vite já atualiza a tela sozinho.
    if (!import.meta.env.PROD || !MINHA_VERSAO || mudou) return;
    let vivo = true;
    async function conferir() {
      try {
        const resposta = await fetch(`${import.meta.env.BASE_URL}versao.json?_=${Date.now()}`, { cache: 'no-store' });
        if (!resposta.ok) return;
        const { versao } = (await resposta.json()) as { versao?: string };
        if (vivo && versao && versao !== MINHA_VERSAO) setMudou(true);
      } catch {
        // Sem internet agora: pergunta de novo na próxima volta.
      }
    }
    const relogio = setInterval(() => void conferir(), DE_QUANTO_EM_QUANTO_MS);
    // Quem volta para a aba depois de horas é o caso mais comum de versão velha.
    const aoVoltar = () => document.visibilityState === 'visible' && void conferir();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [mudou]);

  if (!mudou) return null;
  return (
    <p className="aviso-topo versao-nova" role="status">
      {t('Tem uma versão nova do Syden.')}
      <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
        <RefreshCw size={14} aria-hidden="true" /> {t('Recarregar')}
      </button>
    </p>
  );
}
