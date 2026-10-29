import { Check, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { useBloqueados } from './bloqueios';
import { nomeDe, useDirectory } from './directory';
import { useT } from './i18n';
import type { PresenceEntry, VoiceMember } from './types';

/**
 * CONVIDAR PARA VOZ (29/10/2026, pedido dele: o do Discord). Quem está SOZINHO numa sala vê, logo abaixo do próprio
 * nome, o convite para chamar alguém; ele abre a lista de quem está online na comunidade, e cada um tem o botão de
 * convidar. Quem recebe vê o aviso com o botão de entrar (ConviteParaVoz.tsx).
 *
 * Só aparece sozinho porque é aí que ele serve: com a turma na sala, a sala já está acontecendo. E some se não houver
 * ninguém para chamar — um convite que abre uma lista vazia afirmaria uma coisa que não é. O X o tira desta sala até
 * você sair dela.
 */

/** Quantos aparecem antes do "Ver mais", como no Discord. */
const PRIMEIROS = 5;

export function ConvidarParaVoz({
  channelId,
  selfId,
  online,
  voiceMembers,
  convidar,
}: {
  channelId: number;
  selfId: number;
  /** Quem está online nesta comunidade (a mesma lista dos contadores). */
  online: PresenceEntry[];
  /** Quem está em chamada nesta comunidade, em qualquer sala. */
  voiceMembers: VoiceMember[];
  convidar(userId: number): Promise<boolean>;
}) {
  const t = useT();
  const { members } = useDirectory();
  const bloqueados = useBloqueados();
  const [fechadoEm, setFechadoEm] = useState<number | null>(null);
  const [aberto, setAberto] = useState<{ x: number; y: number } | null>(null);
  const [todos, setTodos] = useState(false);
  // O que já aconteceu com cada convite nesta sala: enviado, ou recusado pelo servidor.
  const [enviados, setEnviados] = useState<Map<number, 'enviando' | 'enviado' | 'falhou'>>(new Map());
  const caixa = useRef<HTMLDivElement>(null);

  // Trocou de sala: o X e os convites eram da sala de antes.
  useEffect(() => {
    setEnviados(new Map());
    setAberto(null);
    setTodos(false);
  }, [channelId]);

  // Clicar fora ou apertar Esc fecha a lista.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(null);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(null);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  const naSala = voiceMembers.filter((m) => m.channelId === channelId);
  const sozinho = naSala.length === 1 && naSala[0].userId === selfId;
  const emChamada = new Set(voiceMembers.map((m) => m.userId));
  const nome = (p: PresenceEntry) => nomeDe(members.get(p.id) ?? p);
  const candidatos = online
    .filter((p) => p.id !== selfId && p.status !== 'invisivel' && !bloqueados.has(p.id) && !naSala.some((m) => m.userId === p.id))
    // Quem não está em chamada nenhuma vem primeiro: é quem está mais livre para vir.
    .sort((a, b) => Number(emChamada.has(a.id)) - Number(emChamada.has(b.id)) || nome(a).localeCompare(nome(b)));

  if ((!sozinho && !aberto) || fechadoEm === channelId || candidatos.length === 0) return null;

  async function chamar(userId: number) {
    setEnviados((m) => new Map(m).set(userId, 'enviando'));
    const ok = await convidar(userId);
    setEnviados((m) => new Map(m).set(userId, ok ? 'enviado' : 'falhou'));
  }

  const visiveis = todos ? candidatos : candidatos.slice(0, PRIMEIROS);
  return (
    <>
      <div className="convidar-voz">
        <button
          type="button"
          className="convidar-voz-abrir"
          aria-expanded={!!aberto}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setAberto(aberto ? null : { x: r.right + 8, y: r.top });
          }}
        >
          <span className="convidar-voz-icone" aria-hidden="true">
            <UserPlus size={16} />
          </span>
          <span className="convidar-voz-texto">{t('Convidar para voz')}</span>
        </button>
        <button type="button" className="convidar-voz-fechar" aria-label={t('Fechar')} title={t('Fechar')} onClick={() => setFechadoEm(channelId)}>
          <X size={16} />
        </button>
      </div>
      {aberto && (
        <div
          ref={caixa}
          className="convidar-voz-lista"
          role="dialog"
          aria-label={t('Convidar para voz')}
          // Sem espaço à direita (celular, janela estreita), a lista abre por cima da barra, colada na borda.
          style={{ left: Math.max(8, Math.min(aberto.x, window.innerWidth - 288)), top: Math.max(8, Math.min(aberto.y, window.innerHeight - 380)) }}
        >
          {visiveis.map((p) => {
            const estado = enviados.get(p.id);
            return (
              <div key={p.id} className="convidar-voz-pessoa">
                <Avatar name={nome(p)} userId={p.id} status={p.status} size={32} />
                <span className="convidar-voz-nome">
                  {nome(p)}
                  {estado === 'falhou' && <small>{t('Não deu para convidar essa pessoa.')}</small>}
                </span>
                <button
                  type="button"
                  className="convidar-voz-botao"
                  disabled={estado === 'enviando' || estado === 'enviado'}
                  aria-label={estado === 'enviado' ? t('Convite enviado') : `${t('Convidar para voz')}: ${nome(p)}`}
                  title={estado === 'enviado' ? t('Convite enviado') : t('Convidar para voz')}
                  onClick={() => void chamar(p.id)}
                >
                  {estado === 'enviado' ? <Check size={20} /> : <UserPlus size={20} />}
                </button>
              </div>
            );
          })}
          {!todos && PRIMEIROS < candidatos.length && (
            <button type="button" className="convidar-voz-pessoa convidar-voz-mais" onClick={() => setTodos(true)}>
              <span className="convidar-voz-mais-icone" aria-hidden="true">
                <Users size={20} />
              </span>
              <span className="convidar-voz-nome">{t('Ver mais')}</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
