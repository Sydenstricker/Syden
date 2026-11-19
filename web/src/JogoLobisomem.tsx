import { useEffect, useRef, useState } from 'react';
import { chave, useT } from './i18n';
import { Relogio } from './Minijogo';
import type { EstadoLobisomem, LinhaDaHistoriaDoLobisomem, Papel, PapelEspecial, Partida } from './minijogos';
import { tocar } from './somDosJogos';
import './lobisomem.css';

/**
 * OS PAPÉIS, COM NOMES QUE NÃO DIZEM O SEXO DE NINGUÉM. "Médico" e "aldeão" diriam: o papel é sorteado,
 * e o Syden não sabe quem o recebe. Ficaram "Anjo" (o protetor, nome comum do jogo no Brasil) e "Da vila".
 * Os novos de 19/11/2026 também: o caçador virou a ARMADILHA (dispara quando cai) e a bruxa, o CALDEIRÃO (das poções) —
 * nomes de coisa, como as classes das Lendas, que não marcam sexo em língua nenhuma.
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
  armadilha: {
    emoji: '🪤',
    nome: chave('Armadilha'),
    explicacao: chave('Se você sair do jogo, de noite ou de dia, escolha alguém para sair junto.'),
  },
  caldeirao: {
    emoji: '🧪',
    nome: chave('Caldeirão'),
    explicacao: chave('À noite, veja quem os lobisomens atacaram. Uma poção salva essa pessoa e outra tira alguém do jogo; cada uma vale uma vez.'),
  },
  aldeao: {
    emoji: '🏡',
    nome: chave('Da vila'),
    explicacao: chave('À noite, durma. De dia, descubra quem são os lobisomens e vote para tirá-los do jogo.'),
  },
};
const ESPECIAIS: PapelEspecial[] = ['vidente', 'anjo', 'armadilha', 'caldeirao'];
/** Os limites do servidor (minijogo-lobisomem.ts, LIMITES). */
const LIMITES = { noiteMs: [30_000, 90_000], diaMs: [60_000, 300_000] } as const;

/**
 * O LOBISOMEM (ver server/src/minijogo-lobisomem.ts). O Syden é o narrador: o céu de cima diz em que momento o jogo está
 * (de noite as estrelas e a lua, de dia o sol, desenhados por CSS), o cartão mostra o seu papel, e a lista de jogadores é
 * onde se age — atacar, ver, proteger, envenenar, levar junto ou votar, conforme o papel e a hora. A conversa, que é o jogo,
 * acontece na voz; só os lobisomens têm um canto de texto à noite.
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
  const nome = (userId: number | null | undefined) => estado.jogadores.find((j) => j.userId === userId)?.username ?? '?';
  const nomes = (ids: number[]) => ids.map(nome).join(', ');
  const meu = estado.meuPapel;
  const fase = estado.fase;
  const noite = fase === 'noite';
  const dia = fase === 'dia';
  const pocao = noite && estado.etapa === 'pocao' && estado.vivo && !!estado.pocoes && !estado.pocoes.decidiu;
  const minhaArmadilha = fase === 'armadilha' && estado.armadilha?.quem === eu;

  // O Caldeirão escolhe as duas poções e confirma de uma vez
  const [curar, setCurar] = useState(false);
  const [veneno, setVeneno] = useState(0);
  useEffect(() => {
    setCurar(false);
    setVeneno(0);
  }, [estado.dia, estado.etapa]);

  // OS SONS do narrador: o anoitecer, o amanhecer, quem sai e o veredito (sintetizados, somDosJogos.ts)
  const antes = useRef<{ fase: string; dia: number } | null>(null);
  useEffect(() => {
    const a = antes.current;
    antes.current = { fase, dia: estado.dia };
    if (!a || (a.fase === fase && a.dia === estado.dia)) return;
    if (fase === 'noite') tocar('desliza');
    else if (fase === 'amanhecer') {
      tocar('cura');
      if (estado.mortosDaNoite.length) setTimeout(() => tocar('derrota'), 700);
    } else if (fase === 'defesa' || fase === 'julgamento') tocar('alarme');
    else if (fase === 'veredito') {
      tocar('impacto');
      if (estado.eliminado !== null) setTimeout(() => tocar('derrota'), 500);
    } else if (fase === 'armadilha') tocar('quebra');
    else if (fase === 'fim') tocar('fim');
  }, [fase, estado.dia]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fase === 'preparo') return <Preparo estado={estado} eu={eu} restante={restante} agir={agir} />;

  let faixa: string;
  if (fase === 'fim') faixa = estado.vencedor === 'vila' ? t('A vila venceu!') : t('Os lobisomens venceram!');
  else if (noite) faixa = t('Noite {n}. A vila dorme.', { n: estado.dia });
  else if (fase === 'amanhecer')
    faixa = estado.mortosDaNoite.length ? t('Fora do jogo esta noite: {nomes}', { nomes: nomes(estado.mortosDaNoite) }) : t('Ninguém morreu esta noite.');
  else if (fase === 'armadilha') faixa = t('A armadilha de {nome} disparou: quem sai junto?', { nome: nome(estado.armadilha?.quem) });
  else if (dia) faixa = t('Dia {n}. Conversem e votem em quem vocês acham que é lobisomem.', { n: estado.dia });
  else if (fase === 'defesa') faixa = estado.acusado === eu ? t('Você tem a palavra. Defenda-se pela voz.') : t('{nome} tem a palavra. Ouçam a defesa.', { nome: nome(estado.acusado) });
  else if (fase === 'julgamento') faixa = t('{nome} sai do jogo?', { nome: nome(estado.acusado) });
  else if (estado.eliminado !== null) faixa = t('A vila tirou {nome} do jogo.', { nome: nome(estado.eliminado) });
  else if (estado.acusado !== null) faixa = t('{nome} fica no jogo.', { nome: nome(estado.acusado) });
  else faixa = t('Empate: ninguém sai hoje.');

  /** O que o clique num jogador faz agora, para mim — ou null, se não faz nada. */
  const acao = (alvo: { userId: number; vivo: boolean; papel: Papel | null }): (() => void) | null => {
    if (estado.terminada || !alvo.vivo) return null;
    if (minhaArmadilha) return () => agir({ tipo: 'armadilha', alvo: alvo.userId });
    if (!estado.vivo) return null;
    if (dia) return () => agir({ tipo: 'voto', alvo: alvo.userId });
    if (!noite) return null;
    if (pocao) return estado.pocoes!.veneno && alvo.userId !== eu ? () => setVeneno((v) => (v === alvo.userId ? 0 : alvo.userId)) : null;
    if (estado.etapa === 'pocao') return null;
    if (meu === 'lobisomem' && alvo.papel !== 'lobisomem') return () => agir({ tipo: 'noite', alvo: alvo.userId });
    if (meu === 'vidente' && !estado.viuHoje && alvo.userId !== eu) return () => agir({ tipo: 'noite', alvo: alvo.userId });
    if (meu === 'anjo') return () => agir({ tipo: 'noite', alvo: alvo.userId });
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

  let dica: string | null = null;
  if (minhaArmadilha) dica = t('Clique em quem sai do jogo com você.');
  else if (noite && estado.vivo) {
    if (pocao) dica = estado.pocoes!.veneno ? t('Clique em alguém para envenenar.') : null;
    else if (meu === 'caldeirao') dica = estado.pocoes?.decidiu ? null : t('Espere: os lobisomens estão escolhendo.');
    else if (meu === 'lobisomem') dica = t('Clique em quem os lobisomens vão atacar.');
    else if (meu === 'vidente') dica = estado.viuHoje ? t('Você já usou a sua visão esta noite.') : t('Clique em alguém para descobrir se é lobisomem.');
    else if (meu === 'anjo') dica = t('Clique em quem você quer proteger esta noite.');
    else dica = t('Durma. Os outros papéis estão agindo.');
  } else if (dia && estado.vivo) dica = t('Clique em quem você quer tirar do jogo. O mais votado sai; empate, ninguém.');

  const ceu = noite || fase === 'armadilha' ? 'noite' : fase === 'amanhecer' ? 'aurora' : fase === 'fim' ? (estado.vencedor === 'vila' ? 'dia' : 'noite') : 'dia';

  return (
    <div className={`lobisomem fase-${fase}`}>
      <div className={`lobisomem-ceu ceu-${ceu}`} role="status">
        <span className="lobisomem-astro" aria-hidden="true" />
        <p className="lobisomem-faixa">{faixa}</p>
      </div>

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

      <Composicao estado={estado} />

      {dica && <p className="minijogo-situacao">{dica}</p>}

      {/* O Caldeirão na etapa dele: quem os lobos atacaram, a cura, e o veneno marcado na lista */}
      {pocao && estado.pocoes && (
        <div className="lobisomem-pocoes">
          <p>{estado.alvoDosLobos !== null ? t('Os lobisomens atacaram {nome} durante a noite.', { nome: nome(estado.alvoDosLobos) }) : t('Ninguém foi atacado.')}</p>
          <div className="minijogo-acoes">
            <button
              type="button"
              className={`btn-secondary${curar ? ' escolhido' : ''}`}
              aria-pressed={curar}
              disabled={!estado.pocoes.cura || estado.alvoDosLobos === null}
              onClick={() => setCurar((c) => !c)}
            >
              <span aria-hidden="true">💚</span> {t('Curar')}
            </button>
            <span className="lobisomem-veneno" aria-hidden={!veneno}>
              {veneno ? `☠️ ${nome(veneno)}` : estado.pocoes.veneno ? '☠️ —' : ''}
            </span>
            <button type="button" className="btn-primary" onClick={() => agir({ tipo: 'pocao', curar, veneno })}>
              {t('Pronto')}
            </button>
          </div>
        </div>
      )}

      <ul className="lobisomem-jogadores">
        {estado.jogadores.map((j) => {
          const fazer = acao(j);
          const meuVoto =
            (dia && estado.votos?.[String(eu)] === j.userId) ||
            (noite && meu === 'lobisomem' && estado.ataque?.[String(eu)] === j.userId) ||
            (noite && meu === 'anjo' && estado.protegido === j.userId) ||
            (pocao && veneno === j.userId);
          const visao = estado.visoes?.find((v) => v.alvo === j.userId);
          const marcas = dia || fase === 'defesa' || fase === 'julgamento' || fase === 'veredito' ? votosEm(j.userId) : ataquesEm(j.userId);
          return (
            <li key={j.userId}>
              <button
                type="button"
                className={`lobisomem-jogador${j.vivo ? '' : ' fora'}${meuVoto ? ' escolhido' : ''}${j.userId === eu ? ' eu' : ''}${j.userId === estado.acusado ? ' acusado' : ''}`}
                disabled={!fazer}
                onClick={() => fazer?.()}
              >
                <span className="lobisomem-nome">{j.username}</span>
                {j.papel && (
                  <span className="lobisomem-papel-dele" title={t(PAPEIS[j.papel].nome)}>
                    {PAPEIS[j.papel].emoji}
                  </span>
                )}
                {visao && !j.papel && <span className="lobisomem-visao">🔮 {visao.lobisomem ? t('é lobisomem') : t('não é lobisomem')}</span>}
                {fase === 'julgamento' && estado.julgou?.includes(j.userId) && <span aria-hidden="true">🗳️</span>}
                {fase === 'veredito' && estado.julgamento?.[String(j.userId)] !== undefined && (
                  <span aria-hidden="true">{estado.julgamento[String(j.userId)] ? '👍' : '👎'}</span>
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
      {minhaArmadilha && (
        <button type="button" className="btn-secondary lobisomem-ninguem" onClick={() => agir({ tipo: 'armadilha', alvo: 0 })}>
          {t('Ninguém')}
        </button>
      )}
      {fase === 'defesa' && estado.acusado === eu && (
        <button type="button" className="btn-primary lobisomem-ninguem" onClick={() => agir({ tipo: 'pronto' })}>
          {t('Terminei')}
        </button>
      )}
      {fase === 'julgamento' && estado.vivo && estado.acusado !== eu && (
        <div className="minijogo-acoes lobisomem-julgamento">
          <button type="button" className={`btn-secondary${estado.meuJulgamento === true ? ' escolhido' : ''}`} onClick={() => agir({ tipo: 'julgamento', sim: true })}>
            <span aria-hidden="true">👍</span> {t('Sim')}
          </button>
          <button type="button" className={`btn-secondary${estado.meuJulgamento === false ? ' escolhido' : ''}`} onClick={() => agir({ tipo: 'julgamento', sim: false })}>
            <span aria-hidden="true">👎</span> {t('Não')}
          </button>
        </div>
      )}
      {fase === 'julgamento' && estado.acusado === eu && <p className="minijogo-situacao">{t('A turma está decidindo.')}</p>}

      {estado.conversa && <ConversaDosLobos conversa={estado.conversa} nome={nome} eu={eu} agir={agir} />}

      {fase === 'fim' && estado.historia && <Historia historia={estado.historia} nome={nome} />}
      {!estado.terminada && <Relogio restante={restante} total={Math.max(1, estado.duracao)} />}
    </div>
  );
}

/** A composição da partida, para todos: o segredo é QUEM tem cada papel, não QUAIS existem. */
function Composicao({ estado }: { estado: EstadoLobisomem }) {
  const t = useT();
  const c = estado.composicao;
  const outros = estado.jogadores.length - c.lobos - c.especiais.length;
  return (
    <p className="lobisomem-composicao">
      <span title={t(PAPEIS.lobisomem.nome)}>
        {PAPEIS.lobisomem.emoji}×{c.lobos}
      </span>
      {c.especiais.map((p) => (
        <span key={p} title={t(PAPEIS[p].nome)}>
          {PAPEIS[p].emoji}
        </span>
      ))}
      {outros > 0 && (
        <span title={t(PAPEIS.aldeao.nome)}>
          {PAPEIS.aldeao.emoji}×{outros}
        </span>
      )}
      <span className="lobisomem-tempos">
        🌙 {Math.round(c.noiteMs / 1000)}s · ☀️ {Math.round(c.diaMs / 1000)}s
      </span>
    </p>
  );
}

/** O PREPARO: quem começou escolhe; os outros veem a composição mudando. */
function Preparo({ estado, eu, restante, agir }: { estado: EstadoLobisomem & Partida; eu: number; restante: number; agir: (corpo: Record<string, unknown>) => void }) {
  const t = useT();
  const c = estado.composicao;
  const posso = eu === estado.criadaPor;
  const cabem = estado.jogadores.length - c.lobos;
  const passo = (campo: 'noiteMs' | 'diaMs', d: number) => {
    const [min, max] = LIMITES[campo];
    agir({ tipo: 'ajustes', [campo]: Math.min(max, Math.max(min, c[campo] + d)) });
  };
  return (
    <div className="lobisomem fase-preparo">
      <div className="lobisomem-ceu ceu-aurora" role="status">
        <span className="lobisomem-astro" aria-hidden="true" />
        <p className="lobisomem-faixa">{posso ? t('Escolha os papéis e o tempo de cada fase.') : t('Quem começou a partida está escolhendo os papéis.')}</p>
      </div>
      <Composicao estado={estado} />
      <div className="lobisomem-preparo">
        <div className="lobisomem-linha">
          <span>
            {PAPEIS.lobisomem.emoji} {t('Lobisomens')}
          </span>
          <button type="button" className="btn-secondary" disabled={!posso || c.lobos <= 1} onClick={() => agir({ tipo: 'ajustes', lobos: c.lobos - 1 })} aria-label="−">
            −
          </button>
          <strong>{c.lobos}</strong>
          <button type="button" className="btn-secondary" disabled={!posso || c.lobos >= estado.lobosMax} onClick={() => agir({ tipo: 'ajustes', lobos: c.lobos + 1 })} aria-label="+">
            +
          </button>
        </div>
        <div className="lobisomem-especiais">
          {ESPECIAIS.map((p) => {
            const tem = c.especiais.includes(p);
            return (
              <button
                key={p}
                type="button"
                className={`lobisomem-especial${tem ? ' escolhido' : ''}`}
                aria-pressed={tem}
                title={t(PAPEIS[p].explicacao)}
                disabled={!posso || (!tem && c.especiais.length >= cabem)}
                onClick={() => agir({ tipo: 'ajustes', especiais: tem ? c.especiais.filter((x) => x !== p) : [...c.especiais, p] })}
              >
                <span aria-hidden="true">{PAPEIS[p].emoji}</span> {t(PAPEIS[p].nome)}
              </button>
            );
          })}
        </div>
        {(['noiteMs', 'diaMs'] as const).map((campo) => (
          <div key={campo} className="lobisomem-linha">
            <span>
              {campo === 'noiteMs' ? '🌙' : '☀️'} {campo === 'noiteMs' ? t('Noite') : t('Dia')}
            </span>
            <button type="button" className="btn-secondary" disabled={!posso || c[campo] <= LIMITES[campo][0]} onClick={() => passo(campo, campo === 'noiteMs' ? -15_000 : -30_000)} aria-label="−">
              −
            </button>
            <strong>{Math.round(c[campo] / 1000)}s</strong>
            <button type="button" className="btn-secondary" disabled={!posso || c[campo] >= LIMITES[campo][1]} onClick={() => passo(campo, campo === 'noiteMs' ? 15_000 : 30_000)} aria-label="+">
              +
            </button>
          </div>
        ))}
        {posso && (
          <button type="button" className="btn-primary" onClick={() => agir({ tipo: 'comecar' })}>
            {t('Começar')}
          </button>
        )}
      </div>
      <Relogio restante={restante} total={Math.max(1, estado.duracao)} />
    </div>
  );
}

/** A conversa de texto dos lobisomens, só à noite e só para eles (o servidor nem manda aos outros). */
function ConversaDosLobos({
  conversa,
  nome,
  eu,
  agir,
}: {
  conversa: { id: number; de: number; texto: string }[];
  nome: (id: number) => string;
  eu: number;
  agir: (corpo: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [texto, setTexto] = useState('');
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [conversa.length]);
  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;
    agir({ tipo: 'conversa', texto: limpo });
    setTexto('');
  };
  return (
    <section className="lobisomem-conversa" aria-label={t('Conversa dos lobisomens')}>
      <p className="lobisomem-conversa-titulo">🐺 {t('Conversa dos lobisomens')}</p>
      <ol ref={lista}>
        {conversa.map((c) => (
          <li key={c.id} className={c.de === eu ? 'eu' : ''}>
            <strong>{nome(c.de)}</strong> {c.texto}
          </li>
        ))}
      </ol>
      <form onSubmit={enviar}>
        <input value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} placeholder={t('Só os lobisomens leem.')} aria-label={t('Conversa dos lobisomens')} />
        <button type="submit" className="btn-secondary">
          {t('Enviar')}
        </button>
      </form>
    </section>
  );
}

/** A HISTÓRIA DA PARTIDA, no fim: noite a noite e dia a dia, o que cada papel fez. Quase tudo em figura e nome. */
function Historia({ historia, nome }: { historia: LinhaDaHistoriaDoLobisomem[]; nome: (id: number | null | undefined) => string }) {
  const t = useT();
  const linha = (l: LinhaDaHistoriaDoLobisomem): string | null => {
    switch (l.tipo) {
      case 'ataque':
        if (l.alvo === null || l.alvo === undefined) return `🐺 ${t('Ninguém foi atacado.')}`;
        return `🐺 ${t('Os lobisomens atacaram {nome} durante a noite.', { nome: nome(l.alvo) })}${l.salvo ? ` ${t('Sobreviveu.')}` : ''}`;
      case 'protecao':
        return `😇 ${t('{de} protegeu {alvo}.', { de: nome(l.de), alvo: nome(l.alvo) })}`;
      case 'visao':
        return `🔮 ${nome(l.de)} → ${nome(l.alvo)}: ${l.lobisomem ? t('é lobisomem') : t('não é lobisomem')}`;
      case 'cura':
        return `🧪💚 ${nome(l.alvo)}`;
      case 'veneno':
        return `🧪☠️ ${nome(l.alvo)}`;
      case 'mortes':
        return l.mortos?.length ? `🌅 ${t('Fora do jogo esta noite: {nomes}', { nomes: l.mortos.map(nome).join(', ') })}` : `🌅 ${t('Ninguém morreu esta noite.')}`;
      case 'acusado':
        return l.alvo === null || l.alvo === undefined ? `⚖️ ${t('Empate: ninguém sai hoje.')}` : `⚖️ ${nome(l.alvo)} · 🗳️ ${l.votos ?? 0}`;
      case 'julgamento':
        return `👍 ${l.sim ?? 0} · 👎 ${l.nao ?? 0} — ${l.saiu ? t('A vila tirou {nome} do jogo.', { nome: nome(l.alvo) }) : t('{nome} fica no jogo.', { nome: nome(l.alvo) })}`;
      case 'armadilha':
        return `🪤 ${nome(l.de)} → ${l.alvo ? nome(l.alvo) : t('Ninguém')}`;
    }
    return null;
  };
  // agrupada por noite e dia: a noite tem o ataque, a proteção, a visão, as poções e as mortes; o dia, o resto
  const DA_NOITE = new Set(['ataque', 'protecao', 'visao', 'cura', 'veneno', 'mortes']);
  const blocos: { chave: string; icone: string; n: number; linhas: string[] }[] = [];
  for (const l of historia) {
    const daNoite = DA_NOITE.has(l.tipo);
    const k = `${l.dia}-${daNoite ? 'n' : 'd'}`;
    let b = blocos.find((x) => x.chave === k);
    if (!b) blocos.push((b = { chave: k, icone: daNoite ? '🌙' : '☀️', n: l.dia, linhas: [] }));
    const texto = linha(l);
    if (texto) b.linhas.push(texto);
  }
  return (
    <section className="lobisomem-historia">
      <p className="lobisomem-conversa-titulo">📜 {t('O que aconteceu')}</p>
      <ol>
        {blocos.map((b) => (
          <li key={b.chave}>
            <span className="lobisomem-historia-quando" aria-hidden="true">
              {b.icone} {b.n}
            </span>
            <ul>
              {b.linhas.map((x, k) => (
                <li key={k}>{x}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
