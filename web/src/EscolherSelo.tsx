import { useEffect, useState } from 'react';
import { api } from './api';
import { SeloDaComunidade } from './SeloDaComunidade';

interface Opcao {
  communityId: number;
  nome: string;
  texto: string;
  icone: string;
  cor: string;
}

/**
 * Qual selo eu visto.
 *
 * A comunidade CONQUISTA o selo e quem administra escolhe qual é; cada pessoa decide se quer
 * vesti-lo — e qual, quando pertence a mais de uma comunidade conquistadora. É a mesma divisão das
 * insígnias: o Syden dá, a pessoa escolhe o que mostrar.
 *
 * Só um por vez, de propósito. Vários selos ao lado do nome, em cada mensagem, empurrariam o texto
 * para fora da linha — e "sou de todos os times" não diz nada. Escolher um é o que faz a escolha
 * significar alguma coisa.
 */
export function EscolherSelo() {
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [vestindo, setVestindo] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api<{ podeVestir: Opcao[]; vestindo: { texto: string } | null }>('/api/me/selo')
      .then((d) => {
        setOpcoes(d.podeVestir);
        // O servidor devolve o selo resolvido, não o número da comunidade: acha qual é pelo texto e
        // pela cor, que juntos não se repetem entre as comunidades de uma mesma pessoa.
        const atual = d.vestindo && d.podeVestir.find((o) => o.texto === d.vestindo!.texto);
        setVestindo(atual ? atual.communityId : null);
      })
      .catch(() => setOpcoes([]));
  }, []);

  if (!opcoes) return null;

  // Sem nenhuma comunidade conquistadora, a seção não existe: uma lista vazia com um título só
  // ocuparia espaço para dizer "você não tem nada".
  if (opcoes.length === 0) return null;

  const escolher = async (communityId: number | null) => {
    setSalvando(true);
    try {
      await api('/api/me/selo', { method: 'PUT', body: { communityId } });
      setVestindo(communityId);
    } catch {
      // Falhou: mantém o que estava, sem inventar que deu certo.
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="settings-block">
      <h3>Selo que você veste</h3>
      <p className="settings-hint">
        Aparece ao lado do seu nome em todo o Syden. Só as comunidades que <strong>conquistaram</strong> o selo delas
        entram nesta lista — e você veste um de cada vez.
      </p>

      <ul className="selos-para-vestir">
        <li>
          <button
            className={`selo-escolha${vestindo === null ? ' escolhida' : ''}`}
            aria-pressed={vestindo === null}
            disabled={salvando}
            onClick={() => void escolher(null)}
          >
            <span className="selo-escolha-nada">nenhum</span>
            <small>Só o seu nome, sem selo</small>
          </button>
        </li>
        {opcoes.map((o) => (
          <li key={o.communityId}>
            <button
              className={`selo-escolha${vestindo === o.communityId ? ' escolhida' : ''}`}
              aria-pressed={vestindo === o.communityId}
              disabled={salvando}
              onClick={() => void escolher(o.communityId)}
            >
              <SeloDaComunidade selo={o} />
              <small>{o.nome}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
