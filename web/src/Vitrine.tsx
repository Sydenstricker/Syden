import { Insignia } from './Medalha';
import { acharInsignia } from './insignias';

/**
 * As insígnias que a pessoa escolheu exibir. Quem decide o quê aparece é a dona delas, em Configurações;
 * aqui só se desenha o que ela escolheu, na ordem em que ela pôs.
 *
 * Um código que este app ainda não conhece (servidor mais novo que o site) é ignorado em silêncio, em vez
 * de virar um quadro vazio no perfil de alguém.
 */
export function Vitrine({
  membro,
  tamanho,
}: {
  membro: { vitrine?: string[]; acceptedIdeas?: number };
  tamanho: number;
}) {
  const insignias = (membro.vitrine ?? []).map(acharInsignia).filter((i) => i !== undefined);
  if (insignias.length === 0) return null;

  return (
    <span className="insignias-fileira">
      {insignias.map((insignia) => (
        <Insignia
          key={insignia.codigo}
          arte={insignia.arte}
          titulo={`${insignia.nome} — ${insignia.descricao}`}
          moldura={insignia.moldura}
          tamanho={tamanho}
          // A de ideia acolhida vale por quantas ideias entraram: o número vai no canto do quadro.
          quantas={insignia.codigo === 'ideia-acolhida' ? (membro.acceptedIdeas ?? 1) : 1}
        />
      ))}
    </span>
  );
}

/** Os nomes das insígnias exibidas, em uma linha só. Vai embaixo da fileira, no cartão de perfil. */
export function legendaDaVitrine(membro: { vitrine?: string[] }): string {
  return (membro.vitrine ?? [])
    .map((codigo) => acharInsignia(codigo)?.nome)
    .filter(Boolean)
    .join(' · ');
}
