import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from './api';
import { useT } from './i18n';

interface Comunidade {
  id: number;
  nome: string;
  criadaEm: string;
  criadaPor: string | null;
  membros: number;
  canais: number;
  mensagens: number;
  pessoasQueEscreveram: number;
  ultimaMensagemEm: string | null;
  segundosDeVoz: number;
  segundosDeTela: number;
}

interface Panorama {
  dias: number;
  comunidades: Comunidade[];
}

const JANELAS = [7, 30, 90] as const;
/** Quantas a lista mostra antes de pedir "ver todas". Dez é o que cabe sem virar planilha. */
const TOPO = 10;

/** Segundos viram a unidade que cabe: 40 min é mais legível que 2400 s, e 3 h mais que 180 min. */
function duracao(seg: number): string {
  if (seg < 60) return '—';
  const min = Math.round(seg / 60);
  if (min < 90) return min + ' min';
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? h + ' h ' + resto + ' min' : h + ' h';
}

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** "há 3 dias" diz mais que uma data quando a pergunta é "isto ainda está vivo?". */
function desde(iso: string | null): string {
  if (!iso) return 'nunca';
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (horas < 1) return 'agora há pouco';
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

/**
 * O panorama das comunidades do Syden.
 *
 * Duas perguntas que ninguém conseguia responder antes desta tela, e que ficaram urgentes quando o
 * cadastro abriu: **onde vale investir energia** (quem está crescendo, quem já tem gente conversando)
 * e **o que existe aqui dentro que eu nunca vi** (comunidade grande e muda, criada ontem e fervendo,
 * qualquer coisa fora do feitio).
 *
 * O que esta tela NÃO faz, e é decisão, não limitação técnica: ela não mostra o conteúdo de mensagem
 * nenhuma. Conta quantas houve, de quantas pessoas e quando foi a última. É a diferença entre saber
 * que a sala está cheia e ficar escutando a conversa.
 */
export function PainelDeComunidades() {
  const t = useT();
  const [dias, setDias] = useState<number>(7);
  const [dados, setDados] = useState<Panorama | null | 'carregando'>('carregando');
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    setDados('carregando');
    api<Panorama>(`/api/status/comunidades?dias=${dias}`)
      .then(setDados)
      .catch(() => setDados(null));
  }, [dias]);

  if (dados === 'carregando' || dados === null) return null;

  const lista = todas ? dados.comunidades : dados.comunidades.slice(0, TOPO);
  const escondidas = dados.comunidades.length - lista.length;
  const paradas = dados.comunidades.filter((c) => c.mensagens === 0 && c.membros > 1).length;

  return (
    <section className="usage-card">
      <h3>
        <Users size={16} aria-hidden="true" /> {t('Comunidades')}
      </h3>
      <p className="settings-hint">
        Todas as comunidades do Syden, da mais movimentada para a mais parada. Só contagem — o conteúdo das conversas
        não aparece aqui e não é lido.
      </p>
      {/* Um número que parece histórico e não é engana mais do que um número ausente. As chamadas
          anteriores a 27/09/2026 não registravam em qual comunidade aconteceram, e não há como
          descobrir depois: elas simplesmente não entram na conta. */}
      <p className="settings-hint comunidades-ressalva">
        <strong>Voz e Tela contam a partir de 27/09/2026.</strong> Antes disso as chamadas eram registradas por pessoa,
        sem guardar onde aconteceram — esse tempo não existe mais para recuperar.
      </p>

      <div className="comunidades-janela" role="group" aria-label={t('Período')}>
        {JANELAS.map((n) => (
          <button key={n} className={`chip${dias === n ? ' ativo' : ''}`} onClick={() => setDias(n)} aria-pressed={dias === n}>
            {n} dias
          </button>
        ))}
      </div>

      <div className="painel-numeros">
        <div>
          <strong>{dados.comunidades.length}</strong>
          <small>{t('Comunidades')}</small>
        </div>
        <div>
          <strong>{dados.comunidades.reduce((s, c) => s + c.mensagens, 0).toLocaleString('pt-BR')}</strong>
          <small>Mensagens em {dados.dias} dias</small>
        </div>
        <div>
          <strong>{paradas}</strong>
          <small>{t('Com gente e sem conversa')}</small>
        </div>
      </div>

      <table className="comunidades-tabela">
        <thead>
          <tr>
            <th scope="col">{t('Comunidade')}</th>
            <th scope="col">{t('Membros')}</th>
            <th scope="col">{t('Mensagens')}</th>
            <th scope="col">{t('Quem falou')}</th>
            <th scope="col">{t('Voz')}</th>
            <th scope="col">{t('Tela')}</th>
            <th scope="col">{t('Última')}</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id}>
              <th scope="row">
                <strong>{c.nome}</strong>
                <small>
                  criada em {dia(c.criadaEm)}
                  {c.criadaPor ? ` por ${c.criadaPor}` : ' (conta excluída)'} · {c.canais}{' '}
                  {c.canais === 1 ? 'canal' : 'canais'}
                </small>
              </th>
              <td>{c.membros}</td>
              <td>{c.mensagens.toLocaleString('pt-BR')}</td>
              <td>{c.pessoasQueEscreveram}</td>
              <td>{duracao(c.segundosDeVoz)}</td>
              <td>{duracao(c.segundosDeTela)}</td>
              <td className={c.ultimaMensagemEm ? undefined : 'muda'}>{desde(c.ultimaMensagemEm)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {escondidas > 0 && (
        <button className="comunidades-mais" onClick={() => setTodas(true)}>
          Ver as outras {escondidas}
        </button>
      )}

      {dados.comunidades.length === 0 && <p className="settings-hint">{t('Ainda não existe nenhuma comunidade.')}</p>}
    </section>
  );
}
