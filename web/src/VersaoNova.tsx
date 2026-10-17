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
 * O aviso fica no alto até a pessoa escolher a hora. E não pergunta nada a terceiro: o versao.json mora
 * ao lado do próprio app (ver o plugin em vite.config.ts).
 *
 * RECARREGA SOZINHO SÓ QUANDO NINGUÉM VÊ (17/10/2026, depois do "saibot": uma aba de antes do servidor
 * novo ficou ouvindo a sala, no palco e fora da lista, com o aviso ignorado). As condições, todas juntas:
 * a janela escondida há 2 minutos (minimizada, na bandeja, outra aba na frente), FORA DE CHAMADA
 * (recarregar a derrubaria) e NENHUM TEXTO DIGITADO em campo algum (o rascunho de mensagem não é
 * guardado e se perderia). Quem volta encontra a versão nova, sem ter visto nada acontecer.
 */
const MINHA_VERSAO: string | undefined = import.meta.env.VITE_VERSAO;
// Dez minutos: o deploy não tem pressa de ser notado, e a pergunta é um arquivo de poucos bytes.
const DE_QUANTO_EM_QUANTO_MS = 10 * 60_000;
const ESCONDIDA_HA_MS = 2 * 60_000;

/** Se esta aba está numa chamada agora (quem sabe é o useVoice, que avisa a cada troca). */
let emChamada = false;
export function avisarChamada(sim: boolean) {
  emChamada = sim;
}
const temTextoDigitado = () =>
  [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea, input:not([type]), input[type="text"], input[type="search"]')].some(
    (campo) => campo.value.trim() !== '',
  ) || !!document.querySelector('[contenteditable="true"]:not(:empty)');

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

  useEffect(() => {
    if (!mudou) return;
    let escondidaDesde = document.visibilityState === 'hidden' ? Date.now() : null;
    const aoMudar = () => {
      escondidaDesde = document.visibilityState === 'hidden' ? (escondidaDesde ?? Date.now()) : null;
    };
    document.addEventListener('visibilitychange', aoMudar);
    const relogio = setInterval(() => {
      if (escondidaDesde === null || Date.now() - escondidaDesde < ESCONDIDA_HA_MS) return;
      if (emChamada || temTextoDigitado()) return;
      window.location.reload();
    }, 30_000);
    return () => {
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoMudar);
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
