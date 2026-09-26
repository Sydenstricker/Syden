import { useEffect, useState } from 'react';
import { Gift, Sparkles } from 'lucide-react';
import { Insignia } from './Medalha';
import { acharInsignia } from './insignias';

/**
 * A tela de destaque de um item novo, no formato que o usuário pediu (referência: a loja do Warzone).
 *
 * São três momentos, e o do meio é o que faz a coisa parecer um presente e não um aviso:
 *   1. o presente aparece, com a arte grande, o nome e o agradecimento — e um botão de RESGATAR;
 *   2. ao resgatar, um estouro de luz e um clarão;
 *   3. o nome do item em letras grandes, e pronto: é seu.
 *
 * O clique no meio não é enfeite: é ele que transforma "recebi um aviso" em "eu ganhei". E é também o que
 * permite o presente esperar por quem estava offline na hora — o servidor só marca como visto no resgate.
 *
 * Quem pediu menos animação no sistema pula o estouro e vai direto ao fim.
 */

type Fase = 'presente' | 'estouro' | 'nome';

const MENOS_ANIMACAO = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function Revelacao({ codigo, aoResgatar }: { codigo: string; aoResgatar: () => void }) {
  const [fase, setFase] = useState<Fase>('presente');
  const insignia = acharInsignia(codigo);

  // Um item que este app ainda não conhece (site mais velho que o servidor) não pode segurar a fila nem
  // mostrar um quadro vazio: sai de cena sozinho, e o servidor registra que foi visto.
  useEffect(() => {
    if (!insignia) aoResgatar();
  }, [insignia, aoResgatar]);

  useEffect(() => {
    if (fase !== 'estouro') return;
    const t = setTimeout(() => setFase('nome'), 1100);
    return () => clearTimeout(t);
  }, [fase]);

  // No fim, o Escape e o clique fecham; antes disso, não — a pessoa precisa resgatar.
  useEffect(() => {
    if (fase !== 'nome') return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoResgatar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fase, aoResgatar]);

  if (!insignia) return null;

  function resgatar() {
    if (MENOS_ANIMACAO()) return setFase('nome');
    setFase('estouro');
  }

  return (
    <div className={`revelacao fase-${fase}`} role="dialog" aria-modal="true" aria-label={`Item novo: ${insignia.nome}`}>
      {fase === 'presente' && (
        <div className="revelacao-cartao">
          <span className="revelacao-etiqueta">
            <Gift size={13} aria-hidden="true" />
            {insignia.etiqueta}
          </span>
          <p className="revelacao-chamada">Você recebeu um item</p>

          <div className="revelacao-arte">
            <span className="revelacao-brilho" aria-hidden="true" />
            <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={190} />
          </div>

          <h2>{insignia.nome}</h2>
          <p className="revelacao-frase">{insignia.frase}</p>

          <button className="btn-primary revelacao-resgatar" onClick={resgatar} autoFocus>
            <Sparkles size={16} aria-hidden="true" />
            Resgatar
          </button>
        </div>
      )}

      {fase === 'estouro' && (
        <div className="revelacao-estouro" aria-hidden="true">
          <span className="revelacao-losango" />
          <span className="revelacao-raios" />
          <span className="revelacao-clarao" />
          <p className="revelacao-palavra">Desbloqueado</p>
        </div>
      )}

      {fase === 'nome' && (
        <div className="revelacao-fim">
          <Insignia arte={insignia.arte} titulo={insignia.nome} moldura={insignia.moldura} tamanho={150} />
          <h2>{insignia.nome}</h2>
          <p className="revelacao-frase">{insignia.descricao}</p>
          <p className="revelacao-onde">Já está no seu perfil. Em Configurações você escolhe quais insígnias exibir.</p>
          <button className="btn-primary" onClick={aoResgatar} autoFocus>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
