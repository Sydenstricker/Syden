import type { VoiceMember } from './types';

/**
 * ASSISTINDO JUNTO NÃO É UM MODO QUE ALGUÉM LIGA: é o que acontece quando uma pessoa transmite e outra
 * fica para ver (decisão de 05/10/2026 — um "modo assistir junto" à parte não tinha valor). O Syden
 * percebe sozinho: a sala troca o alto-falante pelo mascote com a pipoca, e cada pessoa da plateia
 * também aparece de pipoca — na sala, na lista de membros, em toda parte em que o avatar dela aparece.
 *
 * Não mexe na tela de ninguém: o arranjo com o vídeo grande e a conversa ao lado continua sendo
 * escolha de quem está assistindo.
 */
export function salaAssistindoJunto(voiceMembers: VoiceMember[], channelId: number): boolean {
  const naSala = voiceMembers.filter((m) => m.channelId === channelId);
  return naSala.length >= 2 && naSala.some((m) => m.screen);
}

/**
 * Quem está na plateia: na mesma sala que uma transmissão, sem ser quem transmite. Quem transmite
 * continua com a pose dele, e com o "AO VIVO" ao lado do nome.
 *
 * É o que o Syden SABE, e não se a pessoa abriu a transmissão: abrir ou não é escolha local de cada
 * um, que não vai para o servidor. Estar na sala em que alguém transmite é o "assistindo junto" que
 * os outros enxergam.
 */
export function quemAssiste(voiceMembers: VoiceMember[]): Set<number> {
  const plateia = new Set<number>();
  for (const m of voiceMembers) {
    // Servidor novo diz o que cada um ABRIU (ver "assistindo" em useVoice.ts): conta só quem abriu a
    // transmissão de alguém que está transmitindo agora. Servidor antigo não diz, e vale a regra da sala.
    const assistindo = m.assistindo
      ? m.assistindo.some((id) => voiceMembers.some((outro) => outro.userId === id && outro.screen && outro.channelId === m.channelId))
      : !m.screen && salaAssistindoJunto(voiceMembers, m.channelId);
    if (assistindo) plateia.add(m.userId);
  }
  return plateia;
}
