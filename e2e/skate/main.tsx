/**
 * O SKATE SEM O SERVIDOR: o JogoSkate de verdade, com a "partida" feita aqui (guarda os pontos e o recorde na memória da
 * página). `?piloto` liga o piloto automático; `window.skateSessaoDoTeste` dá a sessão ao e2e (e2e/skate/fotos.mjs).
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../../web/src/styles.css';
import { JogoSkate, type EstadoSkate } from '../../web/src/JogoSkate';

window.skatePilotoAutomatico = new URLSearchParams(location.search).has('piloto');
let recorde: number | null = 1500;

function Pagina() {
  const [estado, setEstado] = useState<EstadoSkate & { terminada?: boolean }>({
    fase: 'jogando',
    duracaoMs: 120_000,
    meu: { pontos: null, melhorCombo: null },
    placar: [{ userId: 1, username: 'eu', pontos: null, melhorCombo: null, posicao: null }],
    recorde: { antes: recorde, novo: false },
    partidaId: 'teste',
  });
  (window as { skateEstado?: unknown }).skateEstado = estado;
  const agir = (corpo: Record<string, unknown>) => {
    const pontos = Number(corpo.pontos);
    const novo = recorde === null || pontos > recorde;
    const antes = recorde;
    if (novo) recorde = pontos;
    setEstado((e) => ({
      ...e,
      fase: 'fim',
      terminada: true,
      meu: { pontos, melhorCombo: Number(corpo.melhorCombo) },
      placar: [{ userId: 1, username: 'eu', pontos, melhorCombo: Number(corpo.melhorCombo), posicao: 1 }],
      recorde: { antes, novo },
    }));
  };
  return <JogoSkate estado={estado} eu={1} jogador agir={agir} />;
}

createRoot(document.getElementById('raiz')!).render(<Pagina />);
