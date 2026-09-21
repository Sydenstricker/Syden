import { MicOff, Volume2, VolumeX } from 'lucide-react';
import { type MouseEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { getUserVolume, isLocallyMuted, setLocalMute, setUserVolume } from './voiceVolumes';
import type { Role } from './types';
import type { Voice } from './useVoice';

/**
 * Menu do botão direito em cima de alguém na sala, como no Discord: volume só para você, silenciar só para
 * você, e — para quem administra a comunidade — silenciar o microfone da pessoa para todo mundo.
 */
export function usePersonMenu() {
  const [target, setTarget] = useState<{ userId: number; username: string; x: number; y: number } | null>(null);

  const open = (event: MouseEvent, userId: number, username: string) => {
    event.preventDefault();
    setTarget({ userId, username, x: event.clientX, y: event.clientY });
  };

  return { target, open, close: () => setTarget(null) };
}

export function PersonMenu({
  target,
  onClose,
  voice,
  role,
  channelId,
  isSelf,
}: {
  target: { userId: number; username: string; x: number; y: number };
  onClose: () => void;
  voice: Voice;
  role: Role;
  channelId: number | null;
  isSelf: boolean;
}) {
  const [volume, setVolume] = useState(() => getUserVolume(target.userId));
  const [muted, setMuted] = useState(() => isLocallyMuted(target.userId));
  const [error, setError] = useState<string | null>(null);
  const manages = role === 'owner' || role === 'admin';

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  function changeVolume(value: number) {
    setVolume(value);
    setUserVolume(voice.room, target.userId, value);
  }

  function toggleLocalMute() {
    const next = !muted;
    setMuted(next);
    setLocalMute(voice.room, target.userId, next);
  }

  async function muteForEveryone() {
    try {
      await api(`/api/channels/${channelId}/mute`, { method: 'POST', body: { userId: target.userId, muted: true } });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return createPortal(
    <div
      className="person-menu"
      role="menu"
      style={{ top: Math.min(target.y, window.innerHeight - 260), left: Math.min(target.x, window.innerWidth - 250) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="person-menu-name">{target.username}</div>

      {!isSelf && (
        <>
          <label className="person-menu-volume">
            Volume para você: {Math.round(volume * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label={`Volume de ${target.username}`}
              onChange={(e) => changeVolume(Number(e.target.value))}
            />
          </label>

          <button className="person-menu-item" onClick={toggleLocalMute}>
            {muted ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {muted ? 'Ouvir de novo' : 'Silenciar só para mim'}
          </button>
        </>
      )}

      {manages && !isSelf && channelId !== null && (
        <button className="person-menu-item danger" onClick={muteForEveryone}>
          <MicOff size={16} /> Silenciar microfone para todos
        </button>
      )}
      {error && <p className="form-error small">{error}</p>}
    </div>,
    document.body,
  );
}
