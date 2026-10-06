import { Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { algarismos } from './algarismos';
import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import { useT } from './i18n';
import { MobileBackButton } from './MobileBackButton';
import type { Community } from './types';

// O RANKING DOS NÍVEIS (ver server/src/niveis.ts): quem mais participou da comunidade, com o nível e
// quanto falta para o próximo. Só existe com os níveis ligados por quem administra.
//
// Os números vêm do servidor; nomes e avatares, do diretório da comunidade que já está aberto — a
// mesma régua das outras listas, e o nome muda aqui quando a pessoa troca, sem pedir de novo.

/** Uma chamada ao servidor feita pela configuração; o erro dela vira o aviso vermelho. */
type Acao = { (): Promise<unknown> };

interface Progresso {
  pontos: number;
  nivel: number;
  noNivel: number;
  paraOProximo: number;
}

interface DadosDosNiveis {
  ligado: boolean;
  ranking: (Progresso & { userId: number })[];
  eu: Progresso & { posicao: number | null };
}

function Barra({ progresso }: { progresso: Progresso }) {
  const parte = Math.min(100, Math.round((progresso.noNivel / progresso.paraOProximo) * 100));
  return (
    <span className="ranking-barra" aria-hidden="true">
      <span style={{ width: `${parte}%` }} />
    </span>
  );
}

export function Ranking({ community, onMobileBack }: { community: Community; onMobileBack: () => void }) {
  const t = useT();
  const { members } = useDirectory();
  const [dados, setDados] = useState<DadosDosNiveis | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    api<DadosDosNiveis>(`/api/communities/${community.id}/niveis`).then(
      (d) => vivo && setDados(d),
      (e) => vivo && setErro((e as Error).message),
    );
    return () => {
      vivo = false;
    };
  }, [community.id]);

  return (
    <div className="jogos ranking">
      <header className="main-header">
        <MobileBackButton onBack={onMobileBack} />
        <Trophy size={22} className="muted-icon" /> {t('Ranking')}
      </header>
      <div className="jogos-corpo">
        {erro && <p className="form-error">{erro}</p>}
        {dados && (
          <>
            {/* O SEU LUGAR VEM PRIMEIRO: é o que cada um procura ao abrir, e no meio de cem nomes ninguém se acha. */}
            <section className="ranking-eu">
              <strong>
                {dados.eu.posicao
                  ? t('Você está em {posicao}º, no nível {nivel}.', { posicao: algarismos(dados.eu.posicao), nivel: algarismos(dados.eu.nivel) })
                  : t('Você ainda não tem pontos aqui. Converse ou entre numa sala com alguém.')}
              </strong>
              <Barra progresso={dados.eu} />
              <small>
                {t('{faltam} pontos para o nível {proximo}.', {
                  faltam: algarismos(dados.eu.paraOProximo - dados.eu.noNivel),
                  proximo: algarismos(dados.eu.nivel + 1),
                })}
              </small>
            </section>
            <p className="settings-hint">
              {t('Cada mensagem vale pontos (uma por minuto), e cada minuto numa sala com mais alguém também. Quem sobe de nível recebe um aviso só para si.')}
            </p>
            <ol className="ranking-lista">
              {dados.ranking.map((linha, i) => {
                const membro = members.get(linha.userId);
                return (
                  <li key={linha.userId} className={membro?.id === undefined ? 'saiu' : ''}>
                    <span className="ranking-posicao">{algarismos(i + 1)}</span>
                    <Avatar name={membro?.username ?? '?'} userId={linha.userId} size={32} />
                    <span className="ranking-nome">
                      <bdi>{membro?.username ?? '…'}</bdi>
                      <Barra progresso={linha} />
                    </span>
                    <span className="ranking-nivel">{t('Nível {nivel}', { nivel: algarismos(linha.nivel) })}</span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Ligar os níveis e escolher as recompensas, em Configurações → Membros (só para quem administra).
 * A recompensa é um cargo: "no nível 5, ganha Veterano". Tirar a recompensa não tira o cargo de quem
 * já ganhou — o que foi dado fica dado.
 */
export function ConfiguracaoDeNiveis({ community }: { community: Community }) {
  const t = useT();
  const { cargos } = useDirectory();
  const [recompensas, setRecompensas] = useState<{ nivel: number; cargoId: number }[]>([]);
  const [nivel, setNivel] = useState(5);
  const [cargoId, setCargoId] = useState<number | ''>('');
  const [erro, setErro] = useState<string | null>(null);
  // Liga NA HORA, sem esperar o servidor: presa ao valor de lá, a caixa voltava a ficar desmarcada até a
  // resposta chegar (a mesma armadilha do "separado" dos cargos).
  const [ligado, setLigado] = useState(!!community.niveisLigados);
  useEffect(() => setLigado(!!community.niveisLigados), [community.niveisLigados]);

  useEffect(() => {
    api<DadosDosNiveis & { recompensas: { nivel: number; cargoId: number }[] }>(`/api/communities/${community.id}/niveis`).then(
      (d) => setRecompensas(d.recompensas),
      () => setRecompensas([]),
    );
  }, [community.id]);

  /** Faz a chamada; o erro vira o aviso vermelho. Diz se deu certo. */
  async function fazer(acao: Acao): Promise<boolean> {
    setErro(null);
    try {
      await acao();
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    }
  }

  const nomeDoCargo = (id: number) => cargos.find((c) => c.id === id)?.nome ?? '…';

  return (
    <div className="settings-card configuracao-de-niveis">
      <label className="cargo-separado">
        <input
          type="checkbox"
          checked={ligado}
          onChange={(e) => {
            const quer = e.target.checked;
            setLigado(quer);
            void fazer(() => api(`/api/communities/${community.id}/niveis`, { method: 'PATCH', body: { ligado: quer } })).then(
              (deuCerto) => !deuCerto && setLigado(!quer),
            );
          }}
        />
        {t('Níveis e ranking ligados')}
      </label>
      <p className="settings-hint">
        {t('Cada mensagem vale pontos (uma por minuto), e cada minuto numa sala com mais alguém também. Quem sobe de nível recebe um aviso só para si.')}
      </p>
      {ligado && (
        <>
          <h4>{t('Recompensas')}</h4>
          {recompensas.length > 0 && (
            <ul className="cargo-lista">
              {recompensas.map((r) => (
                <li key={`${r.nivel}-${r.cargoId}`} className="cargo-linha">
                  <span>{t('Nível {nivel}', { nivel: algarismos(r.nivel) })} → <bdi>{nomeDoCargo(r.cargoId)}</bdi></span>
                  <button
                    type="button"
                    className="icon-plain expression-delete"
                    aria-label={t('Tirar a recompensa do nível {nivel}', { nivel: r.nivel })}
                    onClick={() =>
                      void fazer(async () =>
                        setRecompensas(
                          await api(`/api/communities/${community.id}/niveis/recompensas/${r.nivel}/${r.cargoId}`, { method: 'DELETE' }),
                        ),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cargos.length === 0 ? (
            <p className="settings-hint">{t('Crie um cargo acima para usar como recompensa.')}</p>
          ) : (
            <form
              className="cargo-novo"
              onSubmit={(e) => {
                e.preventDefault();
                if (cargoId === '') return;
                void fazer(async () =>
                  setRecompensas(await api(`/api/communities/${community.id}/niveis/recompensas`, { method: 'PUT', body: { nivel, cargoId } })),
                );
              }}
            >
              <label className="cargo-separado">
                {t('No nível')}
                <input type="number" min={1} max={200} value={nivel} onChange={(e) => setNivel(Number(e.target.value))} className="nivel-numero" />
              </label>
              <select value={cargoId} onChange={(e) => setCargoId(e.target.value ? Number(e.target.value) : '')} aria-label={t('Cargo da recompensa')}>
                <option value="">{t('Escolha o cargo')}</option>
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary" disabled={cargoId === ''}>
                {t('Adicionar recompensa')}
              </button>
            </form>
          )}
        </>
      )}
      {erro && <p className="form-error">{erro}</p>}
    </div>
  );
}
