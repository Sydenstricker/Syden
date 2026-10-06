import { Avatar } from './Avatar';
import { isolar } from './bidi';
import { useDigitando } from './digitando';
import { useT } from './i18n';

/**
 * A linha "fulano está digitando…", entre a conversa e a caixa de mensagem.
 *
 * Cada pessoa aparece com o avatar virando o balão de três pontos — o mascote é o personagem, e o D4
 * aparece quando a conversa acontece. Quem tem foto aparece com a foto.
 *
 * A LINHA GUARDA O LUGAR MESMO VAZIA. Se ela nascesse e sumisse, a conversa inteira pularia para cima
 * e para baixo cada vez que alguém começa ou para de escrever — e um salto na tela chama atenção pela
 * razão errada (ver "A tela não afirma o que não é", no CLAUDE.md).
 */
export function QuemDigita({ channelId }: { channelId: number }) {
  const t = useT();
  const quem = useDigitando(channelId);
  const frase =
    quem.length === 0
      ? ''
      : quem.length === 1
        ? t('{nome} está digitando…', { nome: isolar(quem[0].username) })
        : quem.length === 2
          ? t('{nome} e {outro} estão digitando…', { nome: isolar(quem[0].username), outro: isolar(quem[1].username) })
          : t('Várias pessoas estão digitando…');
  return (
    <div className="quem-digita" aria-live="polite">
      {quem.slice(0, 3).map((q) => (
        <Avatar key={q.userId} name={q.username} userId={q.userId} size={20} digitando />
      ))}
      {frase && <span>{frase}</span>}
    </div>
  );
}
