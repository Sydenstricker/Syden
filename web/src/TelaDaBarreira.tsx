import { type FormEvent, useState } from 'react';
import { Clock, ShieldAlert, UserRoundCheck } from 'lucide-react';
import { API_URL, api, loadToken } from './api';
import { Logo } from './Logo';
import type { Barreira } from './protecao';
import { useT } from './i18n';

/** O que a tela chama depois de resolver a pendência: relê a conta. */
interface AoResolver {
  (): Promise<void>;
}

const quando = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

/**
 * A TELA DA BARREIRA (17/10/2026; ver protecao.ts no servidor): no lugar do Syden, quando a conta tem uma pendência. Ela
 * sempre diz o PORQUÊ e O QUE FAZER (a tela não mente e não deixa ninguém numa porta muda): a data de nascimento que
 * falta, o motivo do banimento e o recurso, o código para o responsável, a hora em que o tempo do dia volta.
 */
export function TelaDaBarreira({ barreira, aoResolver, aoSair }: { barreira: Barreira; aoResolver: AoResolver; aoSair: () => void }) {
  const t = useT();
  return (
    <div className="auth barreira">
      <div className="auth-panel">
        <div className="auth-column">
          <div className="auth-brand">
            <Logo size={56} />
            <span>Syden</span>
          </div>
          <div className="auth-card barreira-card">
          {barreira.tipo === 'nascimento' && <Nascimento aoResolver={aoResolver} />}
          {(barreira.tipo === 'banido' || barreira.tipo === 'suspensa') && <Recurso barreira={barreira} aoResolver={aoResolver} />}
          {barreira.tipo === 'responsavel' && <Responsavel aoResolver={aoResolver} />}
          {barreira.tipo === 'tempo' && (
            <>
              <h2>
                <Clock size={20} aria-hidden="true" /> {t('O seu tempo de hoje acabou')}
              </h2>
              <p>{t('O limite combinado com o seu responsável é de {n} minutos por dia. Amanhã, o Syden abre de novo.', { n: barreira.limiteMinutos })}</p>
            </>
          )}
          <div className="barreira-rodape">
            <LevarDados />
            <button type="button" className="link" onClick={aoSair}>
              {t('Sair da conta')}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Nascimento({ aoResolver }: { aoResolver: AoResolver }) {
  const t = useT();
  const [data, setData] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      await api('/api/me/nascimento', { method: 'PUT', body: { nascimento: data } });
      await aoResolver();
    } catch (err) {
      setErro((err as Error).message);
    }
    setOcupado(false);
  }
  return (
    <form className="barreira-form" onSubmit={enviar}>
      <h2>{t('Qual é a sua data de nascimento?')}</h2>
      <p className="auth-hint">
        {t('O Syden passou a pedir a idade de todo mundo, para proteger quem tem menos de 18 anos (a lei do ECA Digital). Ninguém vê a sua data: só a faixa de idade é usada.')}
      </p>
      <label>
        {t('Data de nascimento')}
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={new Date().toISOString().slice(0, 10)} required autoFocus />
      </label>
      <p className="auth-hint">{t('Depois de informada, ela não muda por aqui: confira antes de continuar.')}</p>
      {erro && <p className="form-error">{erro}</p>}
      <button className="btn-primary" disabled={ocupado || !data}>
        {t('Continuar')}
      </button>
    </form>
  );
}

function Recurso({ barreira, aoResolver }: { barreira: Extract<Barreira, { tipo: 'banido' | 'suspensa' }>; aoResolver: AoResolver }) {
  const t = useT();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      await api('/api/me/recurso', { method: 'POST', body: { texto } });
      await aoResolver();
    } catch (err) {
      setErro((err as Error).message);
    }
    setOcupado(false);
  }
  return (
    <>
      <h2>
        <ShieldAlert size={20} aria-hidden="true" />{' '}
        {barreira.tipo === 'banido' ? t('Esta conta foi banida do Syden') : t('Esta conta está suspensa')}
      </h2>
      <p>
        <strong>{t('Motivo:')}</strong> {barreira.motivo}
      </p>
      <p className="auth-hint">{t('Decidido por uma pessoa da equipe do Syden em {quando}.', { quando: quando(barreira.em) })}</p>
      {barreira.recursoEm ? (
        <p>{t('O seu recurso foi recebido em {quando}. Quem cuida do Syden vai ler e responder.', { quando: quando(barreira.recursoEm) })}</p>
      ) : (
        <form className="barreira-form" onSubmit={enviar}>
          <label>
            {t('Recorrer da decisão')}
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={2000} required placeholder={t('Conte por que a decisão deve mudar.')} />
          </label>
          {erro && <p className="form-error">{erro}</p>}
          <button className="btn-primary" disabled={ocupado || texto.trim().length < 10}>
            {t('Enviar recurso')}
          </button>
        </form>
      )}
      <p className="auth-hint">{t('Também dá para escrever para contato@syden.chat.')}</p>
    </>
  );
}

/** De 13 a 15 anos, sem responsável depois do prazo: o código para mandar a ele. */
function Responsavel({ aoResolver }: { aoResolver: AoResolver }) {
  const t = useT();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function gerar() {
    setErro(null);
    try {
      setCodigo((await api<{ codigo: string }>('/api/me/responsavel/codigo', { method: 'POST' })).codigo);
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <>
      <h2>
        <UserRoundCheck size={20} aria-hidden="true" /> {t('Falta ligar a sua conta a um responsável')}
      </h2>
      <p>{t('Quem tem de 13 a 15 anos usa o Syden com a conta ligada à de um pai, mãe ou responsável. É a lei (ECA Digital), e é para a sua segurança.')}</p>
      <CodigoParaResponsavel codigo={codigo} aoGerar={() => void gerar()} />
      {erro && <p className="form-error">{erro}</p>}
      <button type="button" className="btn-secondary" onClick={() => void aoResolver()}>
        {t('Já ligamos')}
      </button>
    </>
  );
}

/** O código e o passo a passo para o responsável (usado na barreira e nas Configurações). */
export function CodigoParaResponsavel({ codigo, aoGerar }: { codigo: string | null; aoGerar: () => void }) {
  const t = useT();
  if (!codigo) {
    return (
      <button type="button" className="btn-primary" onClick={aoGerar}>
        {t('Gerar o código para o responsável')}
      </button>
    );
  }
  return (
    <div className="codigo-responsavel">
      <p className="codigo-responsavel-codigo" aria-label={t('Código')}>
        {codigo}
      </p>
      <ol>
        <li>{t('Mande este código para o seu pai, mãe ou responsável.')}</li>
        <li>{t('Ele entra no Syden com a conta dele (ou cria uma) e abre Configurações → Família.')}</li>
        <li>{t('Lá, digita o código. O código vale 7 dias.')}</li>
      </ol>
    </div>
  );
}

/** Levar os dados continua sendo um direito, com ou sem pendência (LGPD). */
function LevarDados() {
  const t = useT();
  async function baixar() {
    const r = await fetch(`${API_URL}/api/me/dados`, { headers: { authorization: `Bearer ${loadToken() ?? ''}` } });
    if (!r.ok) return;
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meus-dados-no-syden.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return (
    <button type="button" className="link" onClick={() => void baixar()}>
      {t('Baixar meus dados')}
    </button>
  );
}
