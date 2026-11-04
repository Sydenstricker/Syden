import { CircleAlert, Megaphone, Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_URL, api } from './api';
import { idiomaAtual, useT } from './i18n';

// A faixa do Syden no alto da tela: "vai ter manutenção às 22h", "a voz está instável", "voltamos".
//
// Aparece ANTES DE ENTRAR também, e é esse o ponto. Quem tenta entrar durante uma manutenção hoje só vê
// o Syden se comportando mal e conclui que ele é ruim; com a faixa, vê uma coisa combinada. Foi o que
// faltou no dia em que o endereço mudou e a entrada parou de funcionar sem explicação nenhuma.
//
// A FOTO DO RECADO (pedido dele, 04/11/2026: "quero colocar uma foto para que todos vejam"): uma miniatura na faixa, que
// continua fina; clicar abre a foto grande, que fecha com Esc ou clicando fora.

export interface AvisoDoServidor {
  texto: string;
  tom: 'manutencao' | 'problema' | 'recado';
  de: string | null;
  ate: string | null;
  /** A foto do recado, servida a qualquer um pela rota pública dela, só enquanto é a do recado (server/src/aviso.ts). */
  imagem?: { sha: string; mime: string } | null;
}

/** O endereço da foto do recado. O sha muda com a foto, então o navegador pode guardá-la. */
export const enderecoDaFotoDoAviso = (sha: string) => `${API_URL}/api/aviso/imagem/${sha}`;

const ICONE = {
  manutencao: Wrench,
  problema: CircleAlert,
  recado: Megaphone,
} as const;

// De quanto em quanto tempo o app pergunta se tem recado novo. Um minuto: é barato (a resposta tem
// três campos) e é rápido o bastante para quem está com o Syden aberto saber da manutenção antes dela.
const DE_QUANTO_EM_QUANTO_MS = 60_000;

/** Quando a manutenção acaba, em palavras. Só a hora, que é o que interessa em um aviso do mesmo dia. */
function ateQuando(ate: string | null, t: ReturnType<typeof useT>): string {
  if (!ate) return '';
  const quando = new Date(ate);
  const hoje = new Date().toDateString() === quando.toDateString();
  const idioma = idiomaAtual();
  const hora = quando.toLocaleTimeString(idioma, { hour: '2-digit', minute: '2-digit' });
  return ' ' + (hoje ? t('Até as {hora}.', { hora }) : t('Até {data}, {hora}.', { data: quando.toLocaleDateString(idioma), hora }));
}

export function AvisoGeral() {
  const t = useT();
  const [aviso, setAviso] = useState<AvisoDoServidor | null>(null);
  // Fechado fica fechado só para ESTE recado: um recado novo volta a aparecer mesmo para quem fechou o
  // anterior. Sem isso, quem fechou a faixa de uma vez nunca mais veria aviso nenhum.
  const [fechado, setFechado] = useState<string | null>(null);
  const [fotoAberta, setFotoAberta] = useState(false);

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

  // A foto grande fecha com Esc (e clicando fora, no próprio visor).
  useEffect(() => {
    if (!fotoAberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFotoAberta(false);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [fotoAberta]);

  // "Este recado" é o texto E a foto: trocar só a foto também é recado novo.
  const marca = aviso ? `${aviso.texto}|${aviso.imagem?.sha ?? ''}` : null;
  if (!aviso || fechado === marca) return null;
  const Icone = ICONE[aviso.tom] ?? Megaphone;
  const foto = aviso.imagem ? enderecoDaFotoDoAviso(aviso.imagem.sha) : null;

  return (
    <>
      <p className={`aviso-geral ${aviso.tom}`} role="status">
        <Icone size={16} aria-hidden="true" />
        {foto && (
          <button type="button" className="aviso-geral-foto" onClick={() => setFotoAberta(true)} aria-label={t('Ver a foto do recado')}>
            <img src={foto} alt="" />
          </button>
        )}
        <span>
          {aviso.texto}
          {ateQuando(aviso.ate, t)}
        </span>
        <button type="button" className="link" onClick={() => setFechado(marca)} aria-label={t('Fechar aviso')}>
          ✕
        </button>
      </p>
      {foto && fotoAberta && (
        <div className="aviso-geral-visor" role="dialog" aria-modal="true" aria-label={t('Foto do recado')} onClick={() => setFotoAberta(false)}>
          <img src={foto} alt={aviso.texto} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={() => setFotoAberta(false)}>
            <X size={22} />
          </button>
        </div>
      )}
    </>
  );
}
