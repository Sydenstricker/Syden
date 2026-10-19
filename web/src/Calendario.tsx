import { Cake, CalendarDays, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { NASCIMENTO_DO_SYDEN } from './diaDoSyden';
import { idiomaAtual, useT } from './i18n';

/**
 * O CALENDÁRIO DA COMUNIDADE (pedido dele, 18/10/2026: "um calendário com os eventos principais da comunidade, assim
 * como os aniversários dos membros marcados"). O mês em grade, com os dias marcados, e embaixo o que há no dia escolhido
 * (ou no mês inteiro). Quem administra marca e apaga eventos. Os aniversários vêm do que cada pessoa informa em Minha
 * conta, e só nas comunidades com os parabéns ligados (ver server/src/calendario-routes.ts).
 *
 * Por enquanto abre por um atalho embaixo do salão; o calendário de PAREDE do salão espera a arte (CLAUDE.md).
 */
interface Evento {
  id: number;
  titulo: string;
  quando: string;
}
interface Aniversario {
  userId: number;
  nome: string;
  mes: number;
  dia: number;
}
type Item =
  | { tipo: 'evento'; data: Date; evento: Evento }
  | { tipo: 'aniversario'; data: Date; aniversario: Aniversario }
  // o aniversário do próprio Syden (diaDoSyden.ts), em toda comunidade, a partir do primeiro ano
  | { tipo: 'syden'; data: Date };

const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const doisDigitos = (n: number) => String(n).padStart(2, '0');
/** Só a primeira letra em maiúscula ("outubro de 2026" → "Outubro de 2026"): o text-transform do CSS punha em todas. */
const primeiraMaiuscula = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** O primeiro dia da semana no idioma de quem lê (domingo no Brasil, segunda em boa parte da Europa). */
function primeiroDiaDaSemana(idioma: string): number {
  try {
    const loc = new Intl.Locale(idioma) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const d = loc.getWeekInfo?.().firstDay ?? loc.weekInfo?.firstDay ?? 7;
    return d % 7; // Intl: 1 = segunda … 7 = domingo; aqui, 0 = domingo
  } catch {
    return 0;
  }
}

export function Calendario({ communityId, socket, aoFechar }: { communityId: number; socket?: Socket | null; aoFechar: () => void }) {
  const t = useT();
  const idioma = idiomaAtual();
  const hoje = new Date();
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [escolhido, setEscolhido] = useState<Date | null>(null);
  const [dados, setDados] = useState<{ eventos: Evento[]; aniversarios: Aniversario[]; podeEditar: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState(() => `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`);
  const [hora, setHora] = useState('20:00');
  const [versao, setVersao] = useState(0);

  // o mês da tela, do primeiro instante ao último, na hora de quem lê
  useEffect(() => {
    const de = new Date(mes.getFullYear(), mes.getMonth(), 1), ate = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
    let vivo = true;
    api<{ eventos: Evento[]; aniversarios: Aniversario[]; podeEditar: boolean }>(
      `/api/communities/${communityId}/calendario?de=${encodeURIComponent(de.toISOString())}&ate=${encodeURIComponent(ate.toISOString())}`,
    )
      .then((r) => vivo && setDados(r))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
  }, [communityId, mes, versao]);

  // alguém marcou ou apagou: relê
  useEffect(() => {
    if (!socket) return;
    const mudou = (d: { communityId: number }) => d.communityId === communityId && setVersao((v) => v + 1);
    socket.on('calendario:mudou', mudou);
    return () => {
      socket.off('calendario:mudou', mudou);
    };
  }, [socket, communityId]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  // o que há neste mês, em ordem
  const itens: Item[] = [
    ...(dados?.eventos ?? []).map((evento) => ({ tipo: 'evento' as const, data: new Date(evento.quando), evento })),
    ...(dados?.aniversarios ?? [])
      .filter((a) => a.mes === mes.getMonth() + 1)
      .map((aniversario) => ({ tipo: 'aniversario' as const, data: new Date(mes.getFullYear(), aniversario.mes - 1, aniversario.dia), aniversario })),
    ...(mes.getFullYear() > NASCIMENTO_DO_SYDEN.ano && mes.getMonth() + 1 === NASCIMENTO_DO_SYDEN.mes
      ? [{ tipo: 'syden' as const, data: new Date(mes.getFullYear(), NASCIMENTO_DO_SYDEN.mes - 1, NASCIMENTO_DO_SYDEN.dia) }]
      : []),
  ]
    .filter((i) => i.data.getMonth() === mes.getMonth())
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  const doDia = escolhido ? itens.filter((i) => mesmoDia(i.data, escolhido)) : itens;

  // a grade: as casas vazias antes do dia 1, e os dias
  const inicio = primeiroDiaDaSemana(idioma);
  const vazios = (new Date(mes.getFullYear(), mes.getMonth(), 1).getDay() - inicio + 7) % 7;
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const nomesDosDias = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(idioma, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + ((inicio + i) % 7))), // 07/01/2024 foi domingo
  );
  const fmtMes = new Intl.DateTimeFormat(idioma, { month: 'long', year: 'numeric' });
  const fmtDia = new Intl.DateTimeFormat(idioma, { weekday: 'short', day: 'numeric' });
  const fmtHora = new Intl.DateTimeFormat(idioma, { hour: '2-digit', minute: '2-digit' });

  const trocarMes = (passo: number) => {
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + passo, 1));
    setEscolhido(null);
  };

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const [a, m, d] = data.split('-').map(Number), [hh, mm] = hora.split(':').map(Number);
    const quando = new Date(a, m - 1, d, hh || 0, mm || 0);
    try {
      await api(`/api/communities/${communityId}/eventos`, { method: 'POST', body: { titulo, quando: quando.toISOString() } });
      setTitulo('');
      setMes(new Date(quando.getFullYear(), quando.getMonth(), 1));
      setEscolhido(new Date(quando.getFullYear(), quando.getMonth(), quando.getDate()));
      setVersao((v) => v + 1);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function apagar(id: number) {
    setErro(null);
    try {
      await api(`/api/communities/${communityId}/eventos/${id}`, { method: 'DELETE' });
      setVersao((v) => v + 1);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog calendario" role="dialog" aria-modal="true" aria-labelledby="calendario-titulo">
        <div className="calendario-topo">
          <h2 id="calendario-titulo">
            <CalendarDays size={18} aria-hidden="true" /> {t('Calendário')}
          </h2>
          <button type="button" className="icon-plain" onClick={aoFechar} aria-label={t('Fechar')} title={t('Fechar')} autoFocus>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="calendario-mes">
          <button type="button" className="icon-plain" onClick={() => trocarMes(-1)} aria-label={t('Mês anterior')} title={t('Mês anterior')}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <strong>{primeiraMaiuscula(fmtMes.format(mes))}</strong>
          <button type="button" className="icon-plain" onClick={() => trocarMes(1)} aria-label={t('Próximo mês')} title={t('Próximo mês')}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="calendario-grade" role="grid">
          {nomesDosDias.map((n, i) => (
            <span key={'s' + i} className="calendario-semana" aria-hidden="true">
              {n}
            </span>
          ))}
          {Array.from({ length: vazios }, (_, i) => (
            <span key={'v' + i} />
          ))}
          {Array.from({ length: diasNoMes }, (_, i) => {
            const dia = new Date(mes.getFullYear(), mes.getMonth(), i + 1);
            const doDiaI = itens.filter((it) => mesmoDia(it.data, dia));
            const evento = doDiaI.some((it) => it.tipo === 'evento'), aniversario = doDiaI.some((it) => it.tipo !== 'evento');
            const classes = ['calendario-dia', mesmoDia(dia, hoje) && 'hoje', escolhido && mesmoDia(dia, escolhido) && 'escolhido'].filter(Boolean).join(' ');
            return (
              <button
                key={i}
                type="button"
                className={classes}
                aria-pressed={!!escolhido && mesmoDia(dia, escolhido)}
                onClick={() => setEscolhido(escolhido && mesmoDia(dia, escolhido) ? null : dia)}
              >
                {i + 1}
                {(evento || aniversario) && (
                  <span className="calendario-marcas" aria-hidden="true">
                    {evento && <span className="calendario-marca evento" />}
                    {aniversario && <span className="calendario-marca aniversario" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <ul className="calendario-lista">
          {dados && doDia.length === 0 && <li className="calendario-vazio">{t('Nada marcado neste mês.')}</li>}
          {doDia.map((i) =>
            i.tipo === 'evento' ? (
              <li key={'e' + i.evento.id}>
                <span className="calendario-quando">
                  {primeiraMaiuscula(fmtDia.format(i.data))} · {fmtHora.format(i.data)}
                </span>
                <span className="calendario-nome">{i.evento.titulo}</span>
                {dados?.podeEditar && (
                  <button
                    type="button"
                    className="icon-plain expression-delete"
                    onClick={() => void apagar(i.evento.id)}
                    aria-label={t('Apagar evento')}
                    title={t('Apagar evento')}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            ) : i.tipo === 'syden' ? (
              <li key="syden">
                <span className="calendario-quando">{primeiraMaiuscula(fmtDia.format(i.data))}</span>
                <span className="calendario-nome">
                  <Cake size={14} aria-hidden="true" /> {t('Aniversário do Syden')}
                </span>
              </li>
            ) : (
              <li key={'a' + i.aniversario.userId}>
                <span className="calendario-quando">{primeiraMaiuscula(fmtDia.format(i.data))}</span>
                <span className="calendario-nome">
                  <Cake size={14} aria-hidden="true" /> {t('Aniversário de {nome}', { nome: i.aniversario.nome })}
                </span>
              </li>
            ),
          )}
        </ul>

        {dados?.podeEditar && (
          <form className="calendario-novo" onSubmit={(e) => void criar(e)}>
            <strong>{t('Novo evento')}</strong>
            <input value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder={t('Nome do evento')} aria-label={t('Nome do evento')} required />
            <div className="calendario-novo-linha">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label={t('Data')} required />
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label={t('Hora')} required />
              <button type="submit" className="btn-primary" disabled={!titulo.trim()}>
                {t('Criar')}
              </button>
            </div>
          </form>
        )}
        {erro && <span className="form-error small">{erro}</span>}
      </div>
    </div>
  );
}
