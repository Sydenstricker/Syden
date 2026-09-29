import { useCallback, useEffect, useState } from 'react';
import { Hash, Trash2, Volume2 } from 'lucide-react';
import { ApiError, api } from './api';
import { useT } from './i18n';
import { diasQueRestam } from './lixeira';
import type { Channel } from './types';

type Apagado = Channel & { deletedAt: string; mensagens: number };

/**
 * A LIXEIRA DA COMUNIDADE: o que foi apagado e ainda dá para trazer de volta.
 *
 * Esta tela é a outra metade de uma coisa que existia pela metade. Desde 29/09/2026 o servidor guarda
 * canal apagado por trinta dias, com rota para listar e rota para restaurar — e não havia como chegar
 * nelas pelo app. Guardar sem dar como buscar é quase o mesmo que não guardar: quem apagou o canal
 * errado continuava sem saída, e o servidor jogava fora em trinta dias uma coisa que ele tinha
 * conseguido salvar.
 *
 * SÓ QUEM ADMINISTRA VÊ, pelo mesmo motivo de só quem administra apagar: a lista conta quantas
 * mensagens cada canal tinha, e isso é informação de dentro dele. Por isso, com 403, o componente não
 * desenha nada — em vez de mostrar erro a um membro comum que não pediu nada.
 *
 * A LISTA VAZIA APARECE, em vez de o bloco desaparecer. "Nada na lixeira" é resposta: quem veio até
 * aqui procurando um canal precisa saber que procurou no lugar certo. Bloco que some manda a pessoa
 * procurar de novo.
 */
export function LixeiraDeCanais({ communityId }: { communityId: number }) {
  const t = useT();
  const [dados, setDados] = useState<{ canais: Apagado[]; dias: number } | null>(null);
  const [podeVer, setPodeVer] = useState(true);
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    try {
      setDados(await api<{ canais: Apagado[]; dias: number }>(`/api/communities/${communityId}/lixeira`));
    } catch (e) {
      // 403 é a resposta certa para quem não administra, e não um defeito.
      if (e instanceof ApiError && e.status === 403) setPodeVer(false);
      else setDados({ canais: [], dias: 30 });
    }
  }, [communityId]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  if (!podeVer || !dados) return null;

  const restaurar = async (canal: Apagado) => {
    setRestaurando(canal.id);
    setErro(null);
    try {
      await api(`/api/communities/${communityId}/lixeira/${canal.id}`, { method: 'POST' });
      // Sai da lista na hora. O canal reaparece na barra lateral pelo aviso do servidor a todo mundo
      // que está na comunidade, e não por esta tela — quem estava com o Syden aberto vê junto.
      setDados({ ...dados, canais: dados.canais.filter((c) => c.id !== canal.id) });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t('Não deu para trazer o canal de volta.'));
    } finally {
      setRestaurando(null);
    }
  };

  return (
    <section className="settings-block">
      <h3>
        <Trash2 size={16} aria-hidden="true" /> {t('Lixeira')}
      </h3>
      <p className="settings-hint">
        {t('Canal apagado fica aqui por {dias} dias e volta com as mensagens dentro, porque elas nunca saíram do banco. Passado o prazo, ele sai de vez.', {
          dias: dados.dias,
        })}
      </p>

      {dados.canais.length === 0 ? (
        <p className="settings-hint">{t('Nada na lixeira.')}</p>
      ) : (
        <ul className="amigos-lista">
          {dados.canais.map((canal) => (
            <li key={canal.id}>
              <span aria-hidden="true">{canal.type === 'text' ? <Hash size={16} /> : <Volume2 size={16} />}</span>
              <span className="amigos-nome">
                {canal.type === 'text' ? `#${canal.name}` : canal.name}
                <small>{oQueSePerde(canal, dados.dias, t)}</small>
              </span>
              <button
                className="btn-sutil"
                disabled={restaurando !== null}
                onClick={() => void restaurar(canal)}
              >
                {restaurando === canal.id ? t('Trazendo…') : t('Trazer de volta')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="form-error">{erro}</p>}
    </section>
  );
}

/**
 * A linha de baixo de cada canal: o que tem dentro dele e quanto tempo resta.
 *
 * SÃO CHAVES SEPARADAS POR CONTAGEM, e não uma frase com número no meio. "1 mensagens" e "some em 1
 * dias" estariam errados em português e em quase toda língua que o Syden fala, e o i18n daqui não tem
 * máquina de plural — a chave é o próprio texto. Dois textos resolvem o caso que aparece de verdade,
 * e o último dia é justamente o que mais importa acertar.
 */
function oQueSePerde(canal: Apagado, dias: number, t: (texto: string, valores?: Record<string, string | number>) => string) {
  const restam = diasQueRestam(canal.deletedAt, dias);
  const prazo =
    restam <= 1 ? t('último dia para trazer de volta') : t('{dias} dias para trazer de volta', { dias: restam });

  // Sala de voz não guarda mensagem, e canal de texto vazio não precisa anunciar o vazio.
  if (canal.type !== 'text' || canal.mensagens === 0) return prazo;
  const quanto = canal.mensagens === 1 ? t('1 mensagem') : t('{n} mensagens', { n: canal.mensagens });
  return `${quanto} · ${prazo}`;
}
