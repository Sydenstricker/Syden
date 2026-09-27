import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { api } from './api';

interface Disponibilidade {
  nome: string;
  situacao: 'no ar' | 'fora do ar' | 'pausado' | 'aguardando';
  umDia: number | null;
  seteDias: number | null;
  trintaDias: number | null;
  quedas: { quando: string; duracaoMin: number }[];
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const duracao = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

const porcento = (n: number | null) => (n === null ? '—' : `${n.toFixed(2)}%`);

/**
 * Quanto o Syden ficou no ar, medido de fora pelo UptimeRobot.
 *
 * O paradoxo é assumido: se o servidor cair, esta tela não abre. O aviso de queda continua sendo o e-mail
 * que o UptimeRobot manda. O que está aqui é a MEMÓRIA — quanto ficou no ar e quando caiu —, que é o que
 * responde "o Syden é confiável?" com número em vez de impressão.
 */
export function PainelDisponibilidade() {
  const [dados, setDados] = useState<Disponibilidade | null | 'carregando'>('carregando');

  useEffect(() => {
    api<Disponibilidade | null>('/api/status/uptime')
      .then(setDados)
      .catch(() => setDados(null));
  }, []);

  // Sem chave configurada (ou sem resposta), a seção não existe — melhor do que mostrar zeros, que
  // pareceriam queda total.
  if (dados === 'carregando' || dados === null) return null;

  return (
    <section className="usage-card">
      <h3>
        <Activity size={16} aria-hidden="true" /> Visto de fora
      </h3>
      <p className="settings-hint">
        Medido pelo UptimeRobot, que pede uma resposta ao Syden a cada 5 minutos de um lugar fora do servidor.
      </p>

      <p className={`disponibilidade-agora ${dados.situacao === 'no ar' ? 'boa' : 'ruim'}`}>
        <span className="bolinha" aria-hidden="true" />
        {dados.situacao === 'no ar' ? 'No ar agora' : `Situação: ${dados.situacao}`}
      </p>

      <div className="painel-numeros">
        {[
          { rotulo: 'Últimas 24 h', valor: dados.umDia },
          { rotulo: '7 dias', valor: dados.seteDias },
          { rotulo: '30 dias', valor: dados.trintaDias },
        ].map((n) => (
          <div key={n.rotulo}>
            <strong>{porcento(n.valor)}</strong>
            <small>{n.rotulo}</small>
          </div>
        ))}
      </div>

      {dados.quedas.length > 0 && (
        <>
          <h4 className="disponibilidade-titulo">Últimas quedas</h4>
          <ul className="disponibilidade-quedas">
            {dados.quedas.map((q) => (
              <li key={q.quando}>
                <time dateTime={q.quando}>{quando(q.quando)}</time>
                <span>{duracao(q.duracaoMin)} fora do ar</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
