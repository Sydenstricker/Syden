import { Bot, Check, Ghost, Helicopter, MicVocal, Mountain, Rabbit, Radio, Wand2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { IconButton } from './IconButton';
import type { Voice } from './useVoice';
import { VOICE_EFFECTS, type VoiceEffectId } from './voiceEffects';

export const EFFECT_ICONS: Record<VoiceEffectId, ReactNode> = {
  none: <MicVocal size={16} />,
  radio: <Radio size={16} />,
  helicopter: <Helicopter size={16} />,
  robot: <Bot size={16} />,
  deep: <Ghost size={16} />,
  chipmunk: <Rabbit size={16} />,
  cave: <Mountain size={16} />,
};

/** Botão da barra da chamada que escolhe o efeito aplicado à sua voz. */
export function VoiceEffectButton({ voice }: { voice: Voice }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = voice.voiceEffect !== 'none';

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="voice-effect-anchor" ref={ref}>
      <IconButton label="Modificador de voz" active={active} onClick={() => setOpen(!open)}>
        <Wand2 />
      </IconButton>
      {open && (
        <div className="voice-effect-menu" role="menu">
          <div className="screenshare-menu-title">Modificador de voz</div>
          {VOICE_EFFECTS.map((effect) => (
            <button
              key={effect.id}
              className={`person-menu-item voice-effect-option${effect.id === voice.voiceEffect ? ' active' : ''}`}
              role="menuitemradio"
              aria-checked={effect.id === voice.voiceEffect}
              onClick={() => {
                setOpen(false);
                void voice.setVoiceEffect(effect.id);
              }}
            >
              {EFFECT_ICONS[effect.id]}
              <span className="screenshare-option-text">
                <span>{effect.name}</span>
                <small>{effect.hint}</small>
              </span>
              {effect.id === voice.voiceEffect && <Check size={16} className="voice-effect-check" />}
            </button>
          ))}
          <p className="person-menu-hint">Os outros passam a ouvir o efeito na hora. Você continua sem se escutar.</p>
        </div>
      )}
    </div>
  );
}
