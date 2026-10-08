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
 * Quem está na plateia: quem ABRIU a transmissão de alguém da mesma sala. Quem transmite continua com
 * a pose dele, e com o "AO VIVO" ao lado do nome. Estar só na sala não basta: cada um conta ao servidor
 * quais transmissões abriu (voice:update), e é isso que os outros enxergam.
 */
export function quemAssiste(voiceMembers: VoiceMember[]): Set<number> {
  const plateia = new Set<number>();
  for (const m of voiceMembers) {
    // O servidor diz o que cada um ABRIU (ver "assistindo" em useVoice.ts): conta só quem abriu a
    // transmissão de alguém que está transmitindo agora. Sem essa informação (servidor antigo), ninguém
    // aparece assistindo: a regra de reserva "está na sala, então assiste" marcou a sala inteira de pipoca
    // em 08/10/2026, inclusive quem não tinha aberto nada — a tela não afirma o que não sabe.
    const assistindo = (m.assistindo ?? []).some((id) =>
      voiceMembers.some((outro) => outro.userId === id && outro.screen && outro.channelId === m.channelId),
    );
    if (assistindo) plateia.add(m.userId);
  }
  return plateia;
}
