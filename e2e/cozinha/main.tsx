/**
 * A COZINHA SEM O SERVIDOR: o JogoCozinha de verdade, com a partida feita aqui (a mesma sequência de pedidos e a mesma
 * conferência do servidor, receitas.ts). `?piloto` liga o piloto automático; `window.cozinha` dá o estado ao e2e.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../../web/src/styles.css';
import { JogoCozinha, type EstadoCozinha } from '../../web/src/JogoCozinha';
import { DURACAO_MS, PEDIDOS_NA_FILA, RECEITAS, confere, normalizarPrato, sortearPedidos, type IdDaReceita } from '../../web/src/cozinha/receitas';
import type { Partida } from '../../web/src/minijogos';

const fixa = new URLSearchParams(location.search).get('receita') as IdDaReceita | null;
const pedidos = fixa ? Array.from({ length: 120 }, () => fixa) : sortearPedidos(Math.random, 120);
const piloto = new URLSearchParams(location.search).has('piloto');
(window as { cozinhaPilotoAutomatico?: boolean }).cozinhaPilotoAutomatico = piloto;

function Pagina() {
  const [estado, setEstado] = useState<EstadoCozinha & Partida>(() => ({
    jogo: 'cozinha' as Partida['jogo'],
    criadaPor: 1,
    terminada: false,
    restanteMs: 2000,
    recebidaEm: Date.now(),
    fase: 'preparando',
    duracaoMs: DURACAO_MS,
    decorridoMs: null,
    meu: { fila: Array.from({ length: PEDIDOS_NA_FILA }, (_, i) => ({ indice: i, receita: pedidos[i] })), pratos: 0, pontos: 0 },
    placar: [{ userId: 1, username: 'eu', pratos: 0, pontos: 0, posicao: 1 }],
    solo: true,
    partidaId: 'teste',
  }));
  const [proximo, setProximo] = useState(PEDIDOS_NA_FILA);
  if (estado.fase === 'preparando') setTimeout(() => setEstado((e) => (e.fase === 'preparando' ? { ...e, fase: 'jogando', restanteMs: DURACAO_MS, recebidaEm: Date.now(), decorridoMs: 0 } : e)), 2000);
  (window as { cozinha?: unknown }).cozinha = estado;
  const agir = async (corpo: Record<string, unknown>) => {
    const prato = normalizarPrato(corpo.prato);
    const pedido = estado.meu!.fila.find((f) => f.indice === corpo.pedido);
    if (!prato || !pedido || !confere(pedido.receita, prato)) throw new Error('Este prato não é o pedido.');
    setProximo((n) => n + 1);
    setEstado((e) => ({
      ...e,
      recebidaEm: Date.now(),
      decorridoMs: (e.decorridoMs ?? 0) + (Date.now() - e.recebidaEm),
      meu: {
        fila: [...e.meu!.fila.filter((f) => f.indice !== pedido.indice), { indice: proximo, receita: pedidos[proximo] }],
        pratos: e.meu!.pratos + 1,
        pontos: e.meu!.pontos + RECEITAS[pedido.receita].pontos,
      },
      placar: [{ ...e.placar[0], pratos: e.placar[0].pratos + 1 }],
    }));
  };
  return <JogoCozinha estado={estado} eu={1} jogador agir={agir} />;
}

createRoot(document.getElementById('raiz')!).render(<Pagina />);
