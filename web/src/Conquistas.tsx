import { Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { chave, useT } from './i18n';
import { JOGOS } from './minijogos';

/**
 * AS CONQUISTAS DA TURMA, abertas pelo troféu do salão (20/10/2026; as contas em server/src/conquistas.ts, a pesquisa em
 * docs/conquistas-coletivas.md). O que a tela respeita, da pesquisa:
 *
 * - Mostra o que a turma JÁ FEZ: o número de hoje e os degraus, cheios os alcançados. Nada de "faltam tanto", barra
 *   correndo ou prazo: nada aqui vence nem se perde.
 * - Os BONS EXEMPLOS (pedido dele) são nomes, sem posição nem medalha, de quem mais contribuiu nos últimos 30 dias.
 * - Os enfeites que cada degrau abre no salão esperam a arte (a fila do PixelLab, CLAUDE.md).
 */
interface Item {
  id: string;
  grupo: 'voz' | 'jogos' | 'karaoke' | 'acolhimento' | 'marcos';
  jogo?: string;
  degraus: number[];
  valor: number;
  alcancados: { degrau: number; em: string }[];
  exemplos?: number[];
}

const GRUPOS: { id: Item['grupo']; nome: string }[] = [
  { id: 'voz', nome: chave('Voz e conversa') },
  { id: 'jogos', nome: chave('Jogos') },
  { id: 'karaoke', nome: chave('Karaokê') },
  { id: 'acolhimento', nome: chave('Acolhimento') },
  { id: 'marcos', nome: chave('Marcos da comunidade') },
];

const TEXTOS: Record<string, { nome: string; sobre: string }> = {
  'horas-juntos': { nome: chave('Horas juntos'), sobre: chave('Horas de call com duas pessoas ou mais na mesma sala.') },
  'roda-cheia': { nome: chave('Roda cheia'), sobre: chave('O máximo de pessoas numa call ao mesmo tempo.') },
  cinema: { nome: chave('Sessão de cinema'), sobre: chave('Horas de transmissão com duas pessoas ou mais assistindo.') },
  'muitas-vozes': { nome: chave('Muitas vozes'), sobre: chave('Pessoas diferentes que já estiveram numa call com alguém.') },
  'mesa-de-jogo': { nome: chave('Mesa de jogo'), sobre: chave('Partidas de mini-games com duas pessoas ou mais.') },
  repertorio: { nome: chave('Repertório'), sobre: chave('Mini-games diferentes jogados em grupo.') },
  'vila-completa': { nome: chave('Vila completa'), sobre: chave('O maior Lobisomem da turma, em jogadores.') },
  'todo-mundo-joga': { nome: chave('Todo mundo joga'), sobre: chave('Pessoas diferentes que já jogaram uma partida.') },
  'palco-aberto': { nome: chave('Palco aberto'), sobre: chave('Vezes que alguém cantou no karaokê com a turma na sala.') },
  coral: { nome: chave('Coral'), sobre: chave('Pessoas diferentes que já cantaram.') },
  setlist: { nome: chave('Setlist'), sobre: chave('Músicas diferentes cantadas.') },
  'boas-vindas': {
    nome: chave('Boas-vindas de verdade'),
    sobre: chave('Pessoas novas que entraram numa call com a turma nos primeiros 30 dias.'),
  },
  'primeira-partida': { nome: chave('Primeira partida'), sobre: chave('Pessoas novas que jogaram com quem já estava aqui.') },
  'primeira-cancao': { nome: chave('Primeira canção'), sobre: chave('Pessoas novas que cantaram nos primeiros 30 dias.') },
  'turma-cresce': { nome: chave('A turma cresce'), sobre: chave('Pessoas na comunidade.') },
  aniversario: { nome: chave('Aniversário da comunidade'), sobre: chave('Anos desde que a comunidade nasceu.') },
  parabens: { nome: chave('Parabéns'), sobre: chave('Aniversários de membros comemorados aqui.') },
  'encontro-marcado': {
    nome: chave('Encontro marcado'),
    sobre: chave('Eventos do calendário em que três pessoas ou mais apareceram na call.'),
  },
  'conversa-viva': { nome: chave('Conversa viva'), sobre: chave('Mensagens escritas na comunidade.') },
};
/** "A turma do jogo": o nome é o do próprio jogo, que já está traduzido (minijogos.ts). */
const SOBRE_O_JOGO = chave('Partidas deste jogo em grupo.');

/** Um degrau alcançado nos últimos 7 dias ganha a marca de novo. */
const NOVO = 7 * 24 * 3600_000;

export function Conquistas({
  communityId,
  nomeDe,
  aoFechar,
}: {
  communityId: number;
  /** O nome de um membro pelo id (o apelido na comunidade, se houver). */
  nomeDe: (userId: number) => string | null;
  aoFechar: () => void;
}) {
  const t = useT();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ conquistas: Item[] }>(`/api/communities/${communityId}/conquistas`)
      .then((r) => vivo && setItens(r.conquistas))
      .catch((e: Error) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [communityId]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  const textoDe = (item: Item) => {
    if (item.jogo) {
      const jogo = JOGOS.find((j) => j.id === item.jogo);
      return { nome: jogo ? t(jogo.nome) : item.jogo, sobre: t(SOBRE_O_JOGO) };
    }
    const tx = TEXTOS[item.id];
    return tx ? { nome: t(tx.nome), sobre: t(tx.sobre) } : { nome: item.id, sobre: '' };
  };
  const formatar = new Intl.NumberFormat(document.documentElement.lang || undefined);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog conquistas" role="dialog" aria-modal="true" aria-labelledby="conquistas-titulo">
        <div className="conquistas-topo">
          <h2 id="conquistas-titulo">
            <Trophy size={18} aria-hidden="true" /> {t('Conquistas da turma')}
          </h2>
          <button type="button" className="icon-plain" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
            <X size={18} />
          </button>
        </div>
        <p className="settings-hint">{t('O que a turma fez junta. Nada aqui vence nem se perde.')}</p>
        {erro && <p className="form-error">{erro}</p>}
        {itens &&
          GRUPOS.map((g) => (
            <section key={g.id} className="conquistas-grupo">
              <h3>{t(g.nome)}</h3>
              {itens
                .filter((i) => i.grupo === g.id)
                .map((item) => {
                  const { nome, sobre } = textoDe(item);
                  const alcancados = new Map(item.alcancados.map((a) => [a.degrau, a.em]));
                  const novo = item.alcancados.some((a) => NOVO > Date.now() - Date.parse(a.em));
                  const exemplos = (item.exemplos ?? []).map(nomeDe).filter((n): n is string => !!n);
                  return (
                    <div key={item.id} className="conquista" data-alcancada={alcancados.size > 0 || undefined}>
                      <div className="conquista-cabeca">
                        <strong>{nome}</strong>
                        {novo && <span className="conquista-novo">{t('Novo')}</span>}
                        <span className="conquista-valor">{formatar.format(item.valor)}</span>
                      </div>
                      <p className="conquista-sobre">{sobre}</p>
                      <div className="conquista-degraus">
                        {item.degraus.map((d) => (
                          <span key={d} className="conquista-degrau" data-cheio={alcancados.has(d) || undefined}>
                            {formatar.format(d)}
                          </span>
                        ))}
                      </div>
                      {exemplos.length > 0 && (
                        <p className="conquista-exemplos">
                          {t('Bons exemplos nos últimos 30 dias:')} {exemplos.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
            </section>
          ))}
      </div>
    </div>
  );
}
