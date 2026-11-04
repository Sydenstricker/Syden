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
//
// O RECADO EM DESTAQUE (pedido dele, 04/11/2026, com o desenho: "o fundo fica desfocado e o aviso aparece no primeiro
// plano em destaque, seja texto ou imagem"): cada recado NOVO aparece uma vez no meio da tela, com o resto desfocado
// atrás; fechado, fica a faixa, e clicar nela o abre de novo. "Uma vez" é por aparelho (o navegador lembra a marca do
// último recado visto): sem isso, o destaque voltaria a cada vez que o Syden abre, o que seria insistir.

const CHAVE_DO_VISTO = 'syden.avisoVisto';

function jaViu(marca: string): boolean {
  try {
    return localStorage.getItem(CHAVE_DO_VISTO) === marca;
  } catch {
    return false;
  }
}

function marcarVisto(marca: string) {
  try {
    localStorage.setItem(CHAVE_DO_VISTO, marca);
  } catch {
    // Sem armazenamento (janela anônima, bloqueio): o destaque só aparece de novo na próxima abertura.
  }
}

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
  const [destaque, setDestaque] = useState(false);

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

  // "Este recado" é o texto E a foto: trocar só a foto também é recado novo.
  const marca = aviso ? `${aviso.texto}|${aviso.imagem?.sha ?? ''}` : null;

  // Recado que este aparelho ainda não viu: abre em destaque, e já fica marcado como visto.
  useEffect(() => {
    if (!marca || jaViu(marca)) return;
    marcarVisto(marca);
    setDestaque(true);
  }, [marca]);

  // O destaque fecha com Esc (e clicando fora dele).
  useEffect(() => {
    if (!destaque) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDestaque(false);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [destaque]);
  if (!aviso || fechado === marca) return null;
  const Icone = ICONE[aviso.tom] ?? Megaphone;
  const foto = aviso.imagem ? enderecoDaFotoDoAviso(aviso.imagem.sha) : null;

  return (
    <>
      <p className={`aviso-geral ${aviso.tom}`} role="status">
        <Icone size={16} aria-hidden="true" />
        {foto && (
          <button type="button" className="aviso-geral-foto" onClick={() => setDestaque(true)} aria-label={t('Ver a foto do recado')}>
            <img src={foto} alt="" />
          </button>
        )}
        <span className="aviso-geral-texto" onClick={() => setDestaque(true)}>
          {aviso.texto}
          {ateQuando(aviso.ate, t)}
        </span>
        <button type="button" className="link" onClick={() => setFechado(marca)} aria-label={t('Fechar aviso')}>
          ✕
        </button>
      </p>
      {destaque && (
        <div className="aviso-destaque" onClick={() => setDestaque(false)}>
          <div
            className={`aviso-destaque-cartao ${aviso.tom}`}
            role="dialog"
            aria-modal="true"
            aria-label={aviso.texto || t('Foto do recado')}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="icon-plain aviso-destaque-fechar" aria-label={t('Fechar')} onClick={() => setDestaque(false)}>
              <X size={20} />
            </button>
            {foto && <img className="aviso-destaque-foto" src={foto} alt="" />}
            {(aviso.texto || aviso.ate) && (
              <p className="aviso-destaque-texto">
                <Icone size={20} aria-hidden="true" />
                <span>
                  {aviso.texto}
                  {ateQuando(aviso.ate, t)}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
