import { Hand, Mic, MicOff, Presentation, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { useT } from './i18n';

// MODO APRESENTAÇÃO: uma pessoa fala, as outras assistem.
//
// A TELA AQUI NÃO É A TRAVA, e isso precisa estar claro para quem mexer depois. Quem decide se alguém
// pode falar é o servidor, no token do LiveKit (ver server/src/routes.ts e server/test/palco.test.ts):
// um botão desabilitado no navegador é uma sugestão, e quem abrir o console publica assim mesmo. O que
// está aqui é o que a pessoa VÊ e PEDE — não o que ela pode.
//
// Por isso a plateia enxerga "levantar a mão" em vez de um microfone cinza: um botão desligado não
// explica nada, e um botão de pedir a palavra explica tudo.

export interface EstadoDoPalco {
  apresentacao: boolean;
  palco: { userId: number; username: string; situacao: 'palco' | 'mao'; desde: string }[];
  souApresentador: boolean;
  minhaSituacao: 'palco' | 'mao' | null;
}

export function usarPalco(channelId: number | null, socket: Socket | null) {
  const [estado, setEstado] = useState<EstadoDoPalco | null>(null);

  const recarregar = useCallback(() => {
    if (channelId === null) {
      setEstado(null);
      return;
    }
    void api<EstadoDoPalco>(`/api/channels/${channelId}/palco`).then(setEstado).catch(() => {});
  }, [channelId]);

  useEffect(recarregar, [recarregar]);

  // O servidor avisa a comunidade inteira a cada mudança: sem isto, quem está na plateia só descobriria
  // que ganhou a palavra ao recarregar a página.
  useEffect(() => {
    if (!socket || channelId === null) return;
    const aoMudar = (dados: { channelId: number }) => {
      if (dados.channelId === channelId) recarregar();
    };
    socket.on('palco:mudou', aoMudar);
    return () => {
      socket.off('palco:mudou', aoMudar);
    };
  }, [socket, channelId, recarregar]);

  return { estado, recarregar };
}

/** O botão que liga a apresentação, no cabeçalho da sala. Só quem administra vê. */
export function BotaoApresentacao({
  channelId,
  estado,
}: {
  channelId: number;
  estado: EstadoDoPalco;
}) {
  const t = useT();
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    setOcupado(true);
    try {
      await api(`/api/channels/${channelId}/palco`, { method: 'PUT', body: { ligado: !estado.apresentacao } });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      className={`header-toggle${estado.apresentacao ? ' active' : ''}`}
      disabled={ocupado}
      onClick={() => void alternar()}
      title={estado.apresentacao ? t('Encerrar a apresentação') : t('Apresentar: só quem tem a palavra fala')}
      aria-label={estado.apresentacao ? t('Encerrar a apresentação') : t('Apresentar')}
      aria-pressed={estado.apresentacao}
    >
      <Presentation size={20} />
    </button>
  );
}

/**
 * A faixa que aparece para todo mundo enquanto a apresentação está ligada.
 *
 * Ela existe porque a plateia precisa saber POR QUE o microfone não funciona. Sem um aviso, o silêncio
 * é indistinguível de defeito — e a primeira reação de quem acha que o app quebrou é sair da chamada.
 */
export function FaixaDoPalco({
  channelId,
  estado,
}: {
  channelId: number;
  estado: EstadoDoPalco;
}) {
  const t = useT();
  const [ocupado, setOcupado] = useState(false);

  if (!estado.apresentacao) return null;

  const noPalco = estado.palco.filter((p) => p.situacao === 'palco');
  const maos = estado.palco.filter((p) => p.situacao === 'mao');
  const euFalo = estado.souApresentador || estado.minhaSituacao === 'palco';

  async function pedir(levantada: boolean) {
    setOcupado(true);
    try {
      await api(`/api/channels/${channelId}/palco/mao`, { method: 'POST', body: { levantada } });
    } finally {
      setOcupado(false);
    }
  }

  async function mexerNoPalco(userId: number, palco: boolean) {
    setOcupado(true);
    try {
      await api(`/api/channels/${channelId}/palco/${userId}`, { method: 'POST', body: { palco } });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="palco-faixa">
      <span className="palco-titulo">
        <Presentation size={16} /> {t('Apresentação')}
      </span>

      <span className="palco-quem">
        {noPalco.length === 0
          ? t('Ninguém com a palavra ainda')
          : noPalco.map((p) => p.username).join(', ')}
      </span>

      {/* A plateia pede a palavra. Quem já fala não vê este botão: não há o que pedir. */}
      {!euFalo && (
        <button
          className={`palco-mao${estado.minhaSituacao === 'mao' ? ' levantada' : ''}`}
          disabled={ocupado}
          onClick={() => void pedir(estado.minhaSituacao !== 'mao')}
        >
          <Hand size={15} />
          {estado.minhaSituacao === 'mao' ? t('Baixar a mão') : t('Levantar a mão')}
        </button>
      )}

      {/* Quem administra vê a fila e passa a palavra. A fila é por ordem de chegada, e isso é o que a
          torna justa — quem pediu antes aparece antes. */}
      {estado.souApresentador && maos.length > 0 && (
        <div className="palco-fila">
          <span className="palco-fila-titulo">{t('Querem falar')}</span>
          {maos.map((p) => (
            <button key={p.userId} className="palco-fila-item" disabled={ocupado} onClick={() => void mexerNoPalco(p.userId, true)}>
              <Hand size={13} /> {p.username}
              <Mic size={13} />
            </button>
          ))}
        </div>
      )}

      {estado.souApresentador && noPalco.length > 0 && (
        <div className="palco-fila">
          <span className="palco-fila-titulo">{t('Com a palavra')}</span>
          {noPalco.map((p) => (
            <button
              key={p.userId}
              className="palco-fila-item tirar"
              disabled={ocupado}
              onClick={() => void mexerNoPalco(p.userId, false)}
              title={t('Tirar a palavra')}
            >
              {p.username}
              <X size={13} />
            </button>
          ))}
        </div>
      )}

      {!euFalo && (
        <span className="palco-aviso">
          <MicOff size={14} /> {t('Seu microfone está desligado enquanto você assiste')}
        </span>
      )}
    </div>
  );
}
