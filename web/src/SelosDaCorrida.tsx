import { chave, useT } from './i18n';
import { tempoLegivel } from './jato/util';
import { diferencaLegivel, FATORES_DAS_CORRIDAS, medalhaPelosPassos } from './medalhasDaCorrida';
import './selosDaCorrida.css';

/** As medalhas e a diferença por volta das corridas, na tela (a conta mora em medalhasDaCorrida.ts). */

const FIGURA = ['🥇', '🥈', '🥉'];
const NOME = [chave('Ouro'), chave('Prata'), chave('Bronze')];
const msDosPassos = (p: number) => Math.round((p * 1000) / 60);

/**
 * Na ESCOLHA (sem `tempoMs`): os três tempos a bater; no FIM (com `tempoMs`): a medalha que a corrida ganhou (nada, se
 * nenhuma).
 */
export function MedalhasDaCorrida({ base, tempoMs, fatores = FATORES_DAS_CORRIDAS }: { base: number | null | undefined; tempoMs?: number; fatores?: readonly number[] }) {
  const t = useT();
  if (!base) return null;
  if (tempoMs !== undefined) {
    const m = medalhaPelosPassos(base, Math.round((tempoMs * 60) / 1000), fatores);
    if (m === null) return null;
    return (
      <span className="corrida-medalha" title={t(NOME[m])} aria-label={t(NOME[m])}>
        {FIGURA[m]}
      </span>
    );
  }
  return (
    <span className="corrida-medalhas">
      {fatores.map((f, i) => (
        <span key={i} title={t(NOME[i])}>
          {FIGURA[i]} {tempoLegivel(msDosPassos(Math.round(base * f)))}
        </span>
      ))}
    </span>
  );
}

/** O selo da diferença da última volta, por cima da corrida (some sozinho: quem chama decide quando). */
export function DiferencaDaVolta({ ms }: { ms: number | null }) {
  if (ms === null) return null;
  return (
    <span className={`corrida-diferenca ${ms <= 0 ? 'na-frente' : 'atras'}`} aria-live="polite">
      {diferencaLegivel(ms)}
    </span>
  );
}
