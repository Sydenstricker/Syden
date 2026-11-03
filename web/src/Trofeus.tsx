import { Star, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { nomeDaConquista } from './Conquistas';
import { tempoLegivel } from './corrida/fisica';
import { nomeDaPistaEm } from './corrida/nomes';
import { useT } from './i18n';
import { JOGOS } from './minijogos';

/**
 * A ESTANTE DE TROFÉUS do quarto (03/11/2026, decisão dele: "um hub para todos os troféus em mini-games, todas as
 * conquistas; o jogador escolhe o que deixa em destaque"). As contas e as regras de quem vê estão em
 * server/src/trofeus-routes.ts.
 *
 * - No MEU quarto: o destaque em cima, os pódios de cada jogo (cada um um registro do momento entre amigos: a posição, a
 *   pista, o tempo, quando e contra quem) e as conquistas da turma de cada comunidade. A estrela põe e tira do destaque.
 * - Na VISITA (`dono`): só o destaque de quem mora ali, com tudo, inclusive contra quem (decisão dele: quem abriu o quarto
 *   à visita escolheu mostrar).
 *
 * Os nomes são os de agora; quem excluiu a conta aparece só como "Conta excluída" (o servidor não guarda o nome dela).
 */

interface Trofeu {
  id: number;
  pista: string;
  posicao: number;
  tempoMs: number | null;
  pontos: number | null;
  em: string;
  rivais: { userId: number; username: string; nomeDeExibicao: string | null }[];
  excluidos: number;
}
interface ConquistaAlcancada {
  chave: string;
  communityId: number;
  comunidade: string;
  conquista: string;
  jogo?: string;
  degrau: number;
  em: string;
}
type ItemDoDestaque = ({ tipo: 'trofeu'; chave: string } & Trofeu) | ({ tipo: 'conquista' } & ConquistaAlcancada);

const MEDALHA = ['', '🥇', '🥈', '🥉'];

/** De qual mini-game é o troféu: as pistas e as copas são da corrida, as fases e a copa do pulo são do Pulo do coelho, e os
 *  outros jogos guardam o próprio id. Pista ou fase nova entra aqui. */
const DA_CORRIDA = new Set(['horta-1', 'pomar-1', 'praia-1', 'bosque-1', 'neve-1', 'canion-1', 'copa-da-cenoura', 'copa-do-repolho']);
const DO_PULO = new Set(['prado-1', 'toca-1', 'copas-1', 'copa-do-pulo']);
export const jogoDoTrofeu = (pista: string) => (DA_CORRIDA.has(pista) ? 'corrida' : DO_PULO.has(pista) ? 'plataforma' : pista);

export function Trofeus({ aoFechar, dono }: { aoFechar: () => void; dono?: { id: number; nome: string } }) {
  const t = useT();
  const [trofeus, setTrofeus] = useState<Trofeu[] | null>(null);
  const [conquistas, setConquistas] = useState<ConquistaAlcancada[]>([]);
  const [destaque, setDestaque] = useState<string[]>([]);
  const [daVisita, setDaVisita] = useState<ItemDoDestaque[] | null>(null);
  const [maximo, setMaximo] = useState(6);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (dono) {
      api<{ itens: ItemDoDestaque[] }>(`/api/quarto/${dono.id}/trofeus`)
        .then((r) => vivo && setDaVisita(r.itens))
        .catch((e: Error) => vivo && setErro(e.message));
    } else {
      api<{ trofeus: Trofeu[]; conquistas: ConquistaAlcancada[]; destaque: string[]; maximo: number }>('/api/trofeus')
        .then((r) => {
          if (!vivo) return;
          setTrofeus(r.trofeus);
          setConquistas(r.conquistas);
          setDestaque(r.destaque);
          setMaximo(r.maximo);
        })
        .catch((e: Error) => vivo && setErro(e.message));
    }
    return () => {
      vivo = false;
    };
  }, [dono?.id]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  const lingua = document.documentElement.lang || undefined;
  const data = new Intl.DateTimeFormat(lingua, { dateStyle: 'medium' });
  const contraQuem = (tr: Trofeu) => {
    const nomes = tr.rivais.map((r) => r.nomeDeExibicao || r.username);
    for (let i = 0; i < tr.excluidos; i++) nomes.push(t('Conta excluída'));
    return new Intl.ListFormat(lingua, { type: 'conjunction' }).format(nomes);
  };
  const nomeDoJogo = (id: string) => {
    const j = JOGOS.find((x) => x.id === id);
    return j ? t(j.nome) : nomeDaPistaEm(t, id);
  };

  const mudarDestaque = (chave: string) => {
    const antes = destaque;
    const novo = antes.includes(chave) ? antes.filter((k) => k !== chave) : antes.length < maximo ? [...antes, chave] : antes;
    if (novo === antes) return;
    setDestaque(novo);
    api('/api/trofeus/destaque', { method: 'PUT', body: { itens: novo } }).catch((e: Error) => {
      setDestaque(antes);
      setErro(e.message);
    });
  };

  const estrela = (chave: string) => {
    if (dono) return null;
    const marcado = destaque.includes(chave);
    const cheio = !marcado && destaque.length >= maximo;
    return (
      <button
        type="button"
        className="icon-plain trofeu-estrela"
        aria-pressed={marcado}
        disabled={cheio}
        onClick={() => mudarDestaque(chave)}
        aria-label={marcado ? t('Tirar do destaque') : t('Pôr em destaque')}
        title={cheio ? t('Cabem até {n} em destaque', { n: maximo }) : marcado ? t('Tirar do destaque') : t('Pôr em destaque')}
      >
        <Star size={16} fill={marcado ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    );
  };

  const linhaDoTrofeu = (tr: Trofeu, chave: string, comJogo: boolean) => (
    <li key={chave}>
      <span className="trofeu-medalha" aria-hidden="true">
        {MEDALHA[tr.posicao] ?? tr.posicao}
      </span>
      <div>
        <strong>
          {comJogo && jogoDoTrofeu(tr.pista) !== tr.pista ? `${nomeDoJogo(jogoDoTrofeu(tr.pista))} · ` : ''}
          {nomeDaPistaEm(t, tr.pista)}
        </strong>
        <span className="trofeu-detalhe">
          {tr.tempoMs !== null && <span className="corrida-relogio">{tempoLegivel(tr.tempoMs)}</span>}
          {tr.pontos !== null && (
            <span>
              {t('Placar')}: {tr.pontos}
            </span>
          )}
          <span>{data.format(new Date(tr.em))}</span>
        </span>
        {tr.rivais.length + tr.excluidos > 0 && <span className="trofeu-rivais">{t('contra {nomes}', { nomes: contraQuem(tr) })}</span>}
      </div>
      {estrela(chave)}
    </li>
  );

  const linhaDaConquista = (c: ConquistaAlcancada, comComunidade: boolean) => (
    <li key={c.chave}>
      <span className="trofeu-medalha" aria-hidden="true">
        🏆
      </span>
      <div>
        <strong>{nomeDaConquista(t, c.conquista, c.jogo)}</strong>
        <span className="trofeu-detalhe">
          <span>{new Intl.NumberFormat(lingua).format(c.degrau)}</span>
          {comComunidade && <span>{c.comunidade}</span>}
          <span>{data.format(new Date(c.em))}</span>
        </span>
      </div>
      {estrela(c.chave)}
    </li>
  );

  // O destaque, na ordem em que foi escolhido.
  const itensDoDestaque: ItemDoDestaque[] = dono
    ? daVisita ?? []
    : destaque.flatMap((k): ItemDoDestaque[] => {
        const tr = trofeus?.find((x) => `t:${x.id}` === k);
        if (tr) return [{ tipo: 'trofeu', chave: k, ...tr }];
        const c = conquistas.find((x) => x.chave === k);
        return c ? [{ tipo: 'conquista', ...c }] : [];
      });
  const carregado = dono ? daVisita !== null : trofeus !== null;

  // Os pódios por jogo, do jogo com o troféu mais novo para o mais antigo.
  const porJogo = new Map<string, Trofeu[]>();
  for (const tr of trofeus ?? []) {
    const j = jogoDoTrofeu(tr.pista);
    porJogo.set(j, [...(porJogo.get(j) ?? []), tr]);
  }
  const porComunidade = new Map<number, ConquistaAlcancada[]>();
  for (const c of conquistas) porComunidade.set(c.communityId, [...(porComunidade.get(c.communityId) ?? []), c]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog conquistas trofeus" role="dialog" aria-modal="true" aria-labelledby="trofeus-titulo">
        <div className="conquistas-topo">
          <h2 id="trofeus-titulo">
            <Trophy size={18} aria-hidden="true" /> {dono ? t('Troféus de {nome}', { nome: dono.nome }) : t('Troféus')}
          </h2>
          <button type="button" className="icon-plain" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
            <X size={18} />
          </button>
        </div>
        {erro && <p className="form-error">{erro}</p>}

        {carregado && (dono || itensDoDestaque.length > 0) && (
          <section className="conquistas-grupo trofeus-destaque">
            <h3>{t('Em destaque')}</h3>
            {itensDoDestaque.length === 0 ? (
              <p className="settings-hint">{t('Nada em destaque ainda.')}</p>
            ) : (
              <ul className="trofeus-lista">
                {itensDoDestaque.map((i) => (i.tipo === 'trofeu' ? linhaDoTrofeu(i, i.chave, true) : linhaDaConquista(i, true)))}
              </ul>
            )}
          </section>
        )}

        {!dono && carregado && (
          <>
            {trofeus!.length === 0 && conquistas.length === 0 && (
              <p className="settings-hint">{t('Nenhum troféu ainda. Fique no pódio de um jogo na sala, com a turma.')}</p>
            )}
            {(trofeus!.length > 0 || conquistas.length > 0) && itensDoDestaque.length === 0 && (
              <p className="settings-hint">{t('Escolha pela estrela o que fica em destaque. É o que quem visita o seu quarto vê.')}</p>
            )}
            {[...porJogo].map(([jogo, lista]) => (
              <section key={jogo} className="conquistas-grupo">
                <h3>{nomeDoJogo(jogo)}</h3>
                <ul className="trofeus-lista">{lista.map((tr) => linhaDoTrofeu(tr, `t:${tr.id}`, false))}</ul>
              </section>
            ))}
            {[...porComunidade].map(([id, lista]) => (
              <section key={'c' + id} className="conquistas-grupo">
                <h3>{t('Conquistas da turma: {comunidade}', { comunidade: lista[0].comunidade })}</h3>
                <ul className="trofeus-lista">{lista.map((c) => linhaDaConquista(c, false))}</ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
