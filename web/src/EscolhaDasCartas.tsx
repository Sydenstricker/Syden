import { useState } from 'react';
import { BotoesDosRobos, type OpcaoDeRobos } from './EscolhaDosRobos';
import { useT } from './i18n';
import { ComoJogar } from './MesaComum';

/**
 * A ESCOLHA DO DOMINÓ E DO TRUCO (20/11/2026, o lote C da segunda auditoria): a variante, no Solo e na sala, e no Solo quantos
 * robôs (clicar na mesa dos robôs já começa, como antes). A regra de fábrica continua a de sempre: o dominó sem as batidas
 * especiais, o truco paulista. A escolha não fica guardada: cada partida começa na de fábrica, e o "Jogar de novo" repete a
 * da partida (o servidor a devolve no público).
 */
export function EscolhaDasCartas({
  jogo,
  solo,
  robos,
  aoEscolher,
  aoVoltar,
}: {
  jogo: 'domino' | 'truco';
  solo: boolean;
  robos: OpcaoDeRobos[];
  aoEscolher: (corpo: Record<string, unknown>) => void;
  aoVoltar: () => void;
}) {
  const t = useT();
  const [especiais, setEspeciais] = useState(false);
  // o dominó de pontos e o nível dos robôs (21/11/2026)
  const [pontos, setPontos] = useState(false);
  const [nivel, setNivel] = useState<'facil' | 'normal' | 'dificil'>('normal');
  const [variante, setVariante] = useState<'paulista' | 'mineiro'>('paulista');
  const escolhas = (): Record<string, unknown> => (jogo === 'domino' ? { especiais, ...(pontos ? { pontos: true } : {}), ...(solo ? { nivel } : {}) } : { variante });

  return (
    <div className="tab-escolha mesa-escolha">
      {jogo === 'domino' && (
        <fieldset className="mesa-grupo">
          <label className="mesa-opcao">
            <input type="checkbox" checked={especiais} onChange={(e) => setEspeciais(e.target.checked)} />
            {t('Batidas especiais: carroça e lá-e-ló valem o dobro')}
          </label>
          <label className="mesa-opcao">
            <input type="checkbox" checked={pontos} onChange={(e) => setPontos(e.target.checked)} />
            {t('Dominó de pontos: marca quem deixa as pontas somando 5, 10, 15…')}
          </label>
        </fieldset>
      )}
      {jogo === 'truco' && (
        <fieldset className="mesa-grupo">
          <div className="mesa-botoes">
            {(['paulista', 'mineiro'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`tab-rodadas-botao${variante === v ? ' escolhida' : ''}`}
                aria-pressed={variante === v}
                onClick={() => setVariante(v)}
              >
                {v === 'paulista' ? t('Paulista') : t('Mineiro')}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {jogo === 'domino' && solo && (
        <fieldset className="mesa-grupo">
          <legend>{t('Nível do computador')}</legend>
          <div className="mesa-botoes">
            {(['facil', 'normal', 'dificil'] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`tab-rodadas-botao${nivel === n ? ' escolhida' : ''}`}
                aria-pressed={nivel === n}
                onClick={() => setNivel(n)}
              >
                {n === 'facil' ? t('Fácil') : n === 'normal' ? t('Normal') : t('Difícil')}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <ComoJogar jogo={jogo} />
      {solo && <BotoesDosRobos opcoes={robos} aoEscolher={(n) => aoEscolher({ ...escolhas(), robos: n })} />}
      <div className="minijogo-acoes">
        {!solo && (
          <button type="button" className="btn-primary" onClick={() => aoEscolher(escolhas())}>
            {t('Jogar')}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}
