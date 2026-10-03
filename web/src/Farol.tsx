import { MonitorUp, Radio, Volume2 } from 'lucide-react';
import { algarismos } from './algarismos';
import { CommunityIcon } from './CommunityIcon';
import { useT } from './i18n';
import type { Community, VoiceMember } from './types';

// O FAROL: O QUE ESTÁ ACONTECENDO AGORA NAS COMUNIDADES DE QUEM OLHA.
//
// A home era uma paisagem: a mesma vila para todo mundo, que não dizia nada sobre a vida da pessoa.
// O pedido foi que ela virasse um farol — um lugar com gente, de onde se vê o que de bom está
// acontecendo e se pode entrar, ou só olhar.
//
// SÓ O QUE É VERDADE AGORA. Quem está em chamada e quem está transmitindo, vindos do mesmo
// `voice:state` que desenha as salas — o servidor já manda o de todas as comunidades da pessoa ao
// conectar. Nada de "atividade recente" estimada nem de número que parece movimento: sem ninguém, o
// farol diz que está calmo, que é o que está.
//
// QUEM OLHA NÃO APARECE NA PRÓPRIA LISTA. Estar sozinho numa chamada não é notícia para si mesmo.

export interface AtividadeDaComunidade {
  community: Community;
  pessoas: VoiceMember[];
}

/** As comunidades com gente em chamada agora, a mais cheia primeiro. Fora quem olha. */
export function atividadeAgora(
  comunidades: Community[],
  voz: Record<number, VoiceMember[]>,
  eu: number,
): AtividadeDaComunidade[] {
  return comunidades
    .map((community) => ({ community, pessoas: (voz[community.id] ?? []).filter((m) => m.userId !== eu) }))
    .filter((a) => a.pessoas.length > 0)
    .sort((a, b) => b.pessoas.length - a.pessoas.length);
}

/**
 * "Ana, Beto, Caio +3": nomes demais viram um muro, e o número diz o tamanho sem o muro. O "+" no
 * lugar de "e mais 3" é de propósito — dispensa a forma de plural, que muda de língua para língua.
 */
function quem(pessoas: VoiceMember[]): string {
  const nomes = pessoas.slice(0, 3).map((p) => p.username).join(', ');
  const resto = pessoas.length - 3;
  return resto > 0 ? `${nomes} +${algarismos(resto)}` : nomes;
}

export function Farol({
  atividade,
  aoIr,
}: {
  atividade: AtividadeDaComunidade[];
  aoIr: (communityId: number) => void;
}) {
  const t = useT();

  return (
    <section className="farol" aria-label={t('Agora nas suas comunidades')}>
      <h2>
        <Radio size={18} aria-hidden="true" />
        {t('Agora nas suas comunidades')}
      </h2>
      {atividade.length === 0 ? (
        <p className="farol-calmo">{t('Tudo calmo por enquanto. Quando alguém entrar numa chamada, aparece aqui.')}</p>
      ) : (
        <ul>
          {atividade.map(({ community, pessoas }) => {
            const transmitindo = pessoas.filter((p) => p.screen);
            return (
              <li key={community.id}>
                <button onClick={() => aoIr(community.id)}>
                  <CommunityIcon community={community} size={36} standalone />
                  <span className="farol-texto">
                    <strong>{community.name}</strong>
                    <span>
                      <Volume2 size={14} aria-hidden="true" /> {t('{quem} na chamada', { quem: quem(pessoas) })}
                    </span>
                    {transmitindo.map((p) => (
                      <span key={p.userId} className="farol-tela">
                        <MonitorUp size={14} aria-hidden="true" />{' '}
                        {p.screenName
                          ? t('{quem} transmitindo {oque}', { quem: p.username, oque: p.screenName })
                          : t('{quem} transmitindo a tela', { quem: p.username })}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
