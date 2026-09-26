import { CircleAlert, Megaphone, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';

// A faixa do Syden no alto da tela: "vai ter manutenção às 22h", "a voz está instável", "voltamos".
//
// Aparece ANTES DE ENTRAR também, e é esse o ponto. Quem tenta entrar durante uma manutenção hoje só vê
// o Syden se comportando mal e conclui que ele é ruim; com a faixa, vê uma coisa combinada. Foi o que
// faltou no dia em que o endereço mudou e a entrada parou de funcionar sem explicação nenhuma.

export interface AvisoDoServidor {
  texto: string;
  tom: 'manutencao' | 'problema' | 'recado';
  de: string | null;
  ate: string | null;
}

const ICONE = {
  manutencao: Wrench,
  problema: CircleAlert,
  recado: Megaphone,
} as const;

// De quanto em quanto tempo o app pergunta se tem recado novo. Um minuto: é barato (a resposta tem
// três campos) e é rápido o bastante para quem está com o Syden aberto saber da manutenção antes dela.
const DE_QUANTO_EM_QUANTO_MS = 60_000;

/** Quando a manutenção acaba, em palavras. Só a hora, que é o que interessa em um aviso do mesmo dia. */
function ateQuando(ate: string | null): string {
  if (!ate) return '';
  const quando = new Date(ate);
  const hoje = new Date().toDateString() === quando.toDateString();
  const hora = quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return hoje ? ` Até as ${hora}.` : ` Até ${quando.toLocaleDateString('pt-BR')}, ${hora}.`;
}

export function AvisoGeral() {
  const [aviso, setAviso] = useState<AvisoDoServidor | null>(null);
  // Fechado fica fechado só para ESTE texto: um recado novo volta a aparecer mesmo para quem fechou o
  // anterior. Sem isso, quem fechou a faixa de uma vez nunca mais veria aviso nenhum.
  const [fechado, setFechado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const buscar = () =>
      api<{ aviso: AvisoDoServidor | null }>('/api/inicio', { token: null })
        .then((inicio) => vivo && setAviso(inicio.aviso ?? null))
        // Servidor fora do ar é exatamente quando não há como buscar recado: fica quieto e tenta de novo.
        .catch(() => {});

    void buscar();
    const relogio = setInterval(buscar, DE_QUANTO_EM_QUANTO_MS);
    return () => {
      vivo = false;
      clearInterval(relogio);
    };
  }, []);

  if (!aviso || fechado === aviso.texto) return null;
  const Icone = ICONE[aviso.tom] ?? Megaphone;

  return (
    <p className={`aviso-geral ${aviso.tom}`} role="status">
      <Icone size={16} aria-hidden="true" />
      <span>
        {aviso.texto}
        {ateQuando(aviso.ate)}
      </span>
      <button type="button" className="link" onClick={() => setFechado(aviso.texto)} aria-label="Fechar aviso">
        ✕
      </button>
    </p>
  );
}
