import { chave, useT } from './i18n';
import { Relogio } from './Minijogo';
import type { EstadoLobisomem, Papel, Partida } from './minijogos';

const NOITE_MS = 45_000;
const AMANHECER_MS = 7_000;
const DIA_MS = 150_000;
const VEREDITO_MS = 7_000;

/**
 * OS PAPÉIS, COM NOMES QUE NÃO DIZEM O SEXO DE NINGUÉM. "Médico" e "aldeão" diriam: o papel é sorteado,
 * e o Syden não sabe quem o recebe. Ficaram "Anjo" (o protetor, nome comum do jogo no Brasil) e "Da vila".
 */
export const PAPEIS: Record<Papel, { emoji: string; nome: string; explicacao: string }> = {
  lobisomem: {
    emoji: '🐺',
    nome: chave('Lobisomem'),
    explicacao: chave('À noite, escolha com os outros lobisomens quem atacar. De dia, não deixe ninguém desconfiar.'),
  },
  vidente: {
    emoji: '🔮',
    nome: chave('Vidente'),
    explicacao: chave('À noite, descubra se alguém é lobisomem. Conte de dia, se achar que vale o risco.'),
  },
  anjo: {
    emoji: '😇',
    nome: chave('Anjo'),
    explicacao: chave('À noite, escolha alguém para proteger. Se os lobisomens atacarem essa pessoa, ela sobrevive.'),
  },
  aldeao: {
    emoji: '🏡',
    nome: chave('Da vila'),
    explicacao: chave('À noite, durma. De dia, descubra quem são os lobisomens e vote para tirá-los do jogo.'),
  },
};

/**
 * O LOBISOMEM (ver server/src/minijogo-lobisomem.ts). O Syden é o narrador: a faixa de cima diz em que
 * momento o jogo está, o cartão mostra o seu papel, e a lista de jogadores é onde se age — atacar, ver,
 * proteger ou votar, conforme o papel e a hora. A conversa, que é o jogo, acontece na voz.
 */
export function JogoLobisomem({
  estado,
  eu,
  restante,
  agir,
}: {
  estado: EstadoLobisomem & Partida;
  eu: number;
  restante: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const nome = (userId: number | null) => estado.jogadores.find((j) => j.userId === userId)?.username ?? '?';
  const meu = estado.meuPapel;
  const noite = estado.fase === 'noite';
  const dia = estado.fase === 'dia';

  let faixa: string;
  if (estado.fase === 'fim') faixa = estado.vencedor === 'vila' ? t('A vila venceu!') : t('Os lobisomens venceram!');
  else if (noite) faixa = t('Noite {n}. A vila dorme.', { n: estado.dia });
  else if (estado.fase === 'amanhecer')
    faixa = estado.mortoDaNoite !== null ? t('Os lobisomens atacaram {nome} durante a noite.', { nome: nome(estado.mortoDaNoite) }) : t('Ninguém morreu esta noite.');
  else if (dia) faixa = t('Dia {n}. Conversem e votem em quem vocês acham que é lobisomem.', { n: estado.dia });
  else faixa = estado.eliminado !== null ? t('A vila tirou {nome} do jogo.', { nome: nome(estado.eliminado) }) : t('Empate: ninguém sai hoje.');

  /** O que o clique num jogador faz agora, para mim — ou null, se não faz nada. */
  const acao = (alvo: { userId: number; vivo: boolean; papel: Papel | null }): Record<string, unknown> | null => {
    if (!estado.vivo || !alvo.vivo || estado.terminada) return null;
    if (dia) return { tipo: 'voto', alvo: alvo.userId };
    if (!noite) return null;
    if (meu === 'lobisomem' && alvo.papel !== 'lobisomem') return { tipo: 'noite', alvo: alvo.userId };
    if (meu === 'vidente' && !estado.viuHoje && alvo.userId !== eu) return { tipo: 'noite', alvo: alvo.userId };
    if (meu === 'anjo') return { tipo: 'noite', alvo: alvo.userId };
    return null;
  };

  const votosEm = (userId: number) =>
    Object.entries(estado.votos ?? {})
      .filter(([, alvo]) => alvo === userId)
      .map(([quem]) => nome(Number(quem)));
  const ataquesEm = (userId: number) =>
    Object.entries(estado.ataque ?? {})
      .filter(([, alvo]) => alvo === userId)
      .map(([quem]) => nome(Number(quem)));

  let dicaDaNoite: string | null = null;
  if (noite && estado.vivo) {
    if (meu === 'lobisomem') dicaDaNoite = t('Clique em quem os lobisomens vão atacar.');
    else if (meu === 'vidente') dicaDaNoite = estado.viuHoje ? t('Você já usou a sua visão esta noite.') : t('Clique em alguém para descobrir se é lobisomem.');
    else if (meu === 'anjo') dicaDaNoite = t('Clique em quem você quer proteger esta noite.');
    else dicaDaNoite = t('Durma. Os outros papéis estão agindo.');
  }

  const total = { noite: NOITE_MS, amanhecer: AMANHECER_MS, dia: DIA_MS, veredito: VEREDITO_MS, fim: 1 }[estado.fase];

  return (
    <div className={`lobisomem fase-${estado.fase}`}>
      <p className="lobisomem-faixa" role="status">
        <span aria-hidden="true">{estado.fase === 'fim' ? '🏁' : noite ? '🌙' : '☀️'}</span> {faixa}
      </p>

      {meu && (
        <div className="lobisomem-papel">
          <span className="lobisomem-emoji" aria-hidden="true">
            {PAPEIS[meu].emoji}
          </span>
          <div>
            <strong>{t(PAPEIS[meu].nome)}</strong>
            <p>{estado.vivo ? t(PAPEIS[meu].explicacao) : t('Você saiu do jogo. Agora só assiste — sem contar nada!')}</p>
          </div>
        </div>
      )}

      {dicaDaNoite && <p className="minijogo-situacao">{dicaDaNoite}</p>}
      {dia && estado.vivo && <p className="minijogo-situacao">{t('Clique em quem você quer tirar do jogo. O mais votado sai; empate, ninguém.')}</p>}

      <ul className="lobisomem-jogadores">
        {estado.jogadores.map((j) => {
          const fazer = acao(j);
          const meuVoto = (dia && estado.votos?.[String(eu)] === j.userId) || (noite && meu === 'lobisomem' && estado.ataque?.[String(eu)] === j.userId) || (noite && meu === 'anjo' && estado.protegido === j.userId);
          const visao = estado.visoes?.find((v) => v.alvo === j.userId);
          const marcas = dia || estado.fase === 'veredito' ? votosEm(j.userId) : ataquesEm(j.userId);
          return (
            <li key={j.userId}>
              <button
                type="button"
                className={`lobisomem-jogador${j.vivo ? '' : ' fora'}${meuVoto ? ' escolhido' : ''}${j.userId === eu ? ' eu' : ''}`}
                disabled={!fazer}
                onClick={() => fazer && agir(fazer)}
              >
                <span className="lobisomem-nome">{j.username}</span>
                {j.papel && (
                  <span className="lobisomem-papel-dele" title={t(PAPEIS[j.papel].nome)}>
                    {PAPEIS[j.papel].emoji}
                  </span>
                )}
                {visao && !j.papel && (
                  <span className="lobisomem-visao">🔮 {visao.lobisomem ? t('é lobisomem') : t('não é lobisomem')}</span>
                )}
                {marcas.length > 0 && <span className="lobisomem-marcas">{marcas.join(', ')}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {dia && estado.vivo && (
        <button type="button" className={`btn-secondary lobisomem-ninguem${estado.votos?.[String(eu)] === 0 ? ' escolhido' : ''}`} onClick={() => agir({ tipo: 'voto', alvo: 0 })}>
          {t('Ninguém hoje')}
          {votosEm(0).length > 0 && ` · ${votosEm(0).join(', ')}`}
        </button>
      )}
      {!estado.terminada && <Relogio restante={restante} total={total} />}
    </div>
  );
}
