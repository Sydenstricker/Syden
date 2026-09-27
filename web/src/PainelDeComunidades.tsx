import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from './api';

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
}

interface Panorama {
  dias: number;
  comunidades: Comunidade[];
}

const JANELAS = [7, 30, 90] as const;
/** Quantas a lista mostra antes de pedir "ver todas". Dez é o que cabe sem virar planilha. */
const TOPO = 10;

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
        <Users size={16} aria-hidden="true" /> Comunidades
      </h3>
      <p className="settings-hint">
        Todas as comunidades do Syden, da mais movimentada para a mais parada. Só contagem — o conteúdo das conversas
        não aparece aqui e não é lido. O tempo de voz não entra porque as chamadas são registradas por pessoa, sem
        guardar em qual comunidade aconteceram.
      </p>

      <div className="comunidades-janela" role="group" aria-label="Período">
        {JANELAS.map((n) => (
          <button key={n} className={`chip${dias === n ? ' ativo' : ''}`} onClick={() => setDias(n)} aria-pressed={dias === n}>
            {n} dias
          </button>
        ))}
      </div>

      <div className="painel-numeros">
        <div>
          <strong>{dados.comunidades.length}</strong>
          <small>Comunidades</small>
        </div>
        <div>
          <strong>{dados.comunidades.reduce((s, c) => s + c.mensagens, 0).toLocaleString('pt-BR')}</strong>
          <small>Mensagens em {dados.dias} dias</small>
        </div>
        <div>
          <strong>{paradas}</strong>
          <small>Com gente e sem conversa</small>
        </div>
      </div>

      <table className="comunidades-tabela">
        <thead>
          <tr>
            <th scope="col">Comunidade</th>
            <th scope="col">Membros</th>
            <th scope="col">Mensagens</th>
            <th scope="col">Quem falou</th>
            <th scope="col">Última</th>
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

      {dados.comunidades.length === 0 && <p className="settings-hint">Ainda não existe nenhuma comunidade.</p>}
    </section>
  );
}
