import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { CodigoParaResponsavel } from './TelaDaBarreira';
import { ehMenor, type MinhaProtecao, type PainelDoMenor, type Regras, tempoDeUso } from './protecao';
import { chave, useT } from './i18n';

/**
 * A FAMÍLIA (Configurações; 17/10/2026, ECA Digital): para o MENOR, as regras que valem para ele e o código para ligar
 * a conta ao responsável; para o ADULTO, ligar a conta de um filho pelo código e acompanhar (art. 18: o tempo de uso,
 * os adultos com quem ele fala, as regras e o limite diário). A decisão de tudo é do servidor (server/src/protecao.ts).
 */
export function FamiliaSection() {
  const t = useT();
  const [eu, setEu] = useState<MinhaProtecao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => {
    api<MinhaProtecao>('/api/me/protecao').then(setEu, (e) => setErro((e as Error).message));
  }, []);
  useEffect(() => {
    carregar();
    window.addEventListener('syden:protecao', carregar);
    return () => window.removeEventListener('syden:protecao', carregar);
  }, [carregar]);

  if (erro) return <p className="form-error">{erro}</p>;
  if (!eu) return null;
  return (
    <>
      <h2>{t('Família')}</h2>
      <p className="settings-lead">
        {t('Quem tem menos de 18 anos usa o Syden com proteções a mais, e de 13 a 15 anos com a conta ligada à de um responsável (a lei do ECA Digital).')}
      </p>
      {ehMenor(eu.faixa) ? <ParaOMenor eu={eu} aoMudar={carregar} /> : <ParaOResponsavel />}
    </>
  );
}

/** Guardar uma mudança nas regras. */
interface AoSalvar {
  (r: Partial<Regras>): Promise<void>;
}

const ROTULOS: { chave: keyof Omit<Regras, 'limiteMinutos'>; texto: string }[] = [
  { chave: 'dmSoAmigos', texto: chave('Conversa privada só com amigos') },
  { chave: 'transmitirSoAmigos', texto: chave('A tela e a câmera aparecem só para amigos') },
  { chave: 'assistirSoAmigos', texto: chave('Assistir só transmissões de amigos') },
];

/** As regras, com as caixinhas: desligadas quando quem lê não pode mudar. */
function EditorDeRegras({ regras, podeMudar, aoSalvar }: { regras: Regras; podeMudar: boolean; aoSalvar: AoSalvar }) {
  const t = useT();
  const [limite, setLimite] = useState(regras.limiteMinutos === null ? '' : String(regras.limiteMinutos));
  useEffect(() => setLimite(regras.limiteMinutos === null ? '' : String(regras.limiteMinutos)), [regras.limiteMinutos]);
  return (
    <div className="familia-regras">
      {ROTULOS.map((r) => (
        <label key={r.chave} className="familia-regra">
          <input type="checkbox" checked={regras[r.chave]} disabled={!podeMudar} onChange={(e) => void aoSalvar({ [r.chave]: e.target.checked })} />
          <span>{t(r.texto)}</span>
        </label>
      ))}
      <label className="settings-field">
        {t('Limite de uso por dia (minutos; vazio é sem limite)')}
        <input
          type="number"
          min={15}
          max={1440}
          step={15}
          value={limite}
          disabled={!podeMudar}
          onChange={(e) => setLimite(e.target.value)}
          onBlur={() => void aoSalvar({ limiteMinutos: limite === '' ? null : Number(limite) })}
        />
      </label>
    </div>
  );
}

function ParaOMenor({ eu, aoMudar }: { eu: MinhaProtecao; aoMudar: () => void }) {
  const t = useT();
  const [codigo, setCodigo] = useState<string | null>(eu.codigo?.codigo ?? null);
  const [erro, setErro] = useState<string | null>(null);
  async function gerar() {
    setErro(null);
    try {
      setCodigo((await api<{ codigo: string }>('/api/me/responsavel/codigo', { method: 'POST' })).codigo);
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  async function salvar(regras: Partial<Regras>) {
    setErro(null);
    try {
      await api('/api/me/regras', { method: 'PUT', body: regras });
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <>
      <h3>{t('O seu responsável')}</h3>
      <div className="settings-card">
        {eu.responsavel ? (
          <p>{t('A sua conta está ligada à de {nome}.', { nome: eu.responsavel.username })}</p>
        ) : (
          <>
            <p>
              {eu.responsavelObrigatorio
                ? t('Falta ligar a sua conta a um pai, mãe ou responsável. Até lá, as proteções ficam todas ligadas.')
                : t('Você pode ligar a sua conta a um pai, mãe ou responsável, se quiser.')}
            </p>
            <CodigoParaResponsavel codigo={codigo} aoGerar={() => void gerar()} />
          </>
        )}
      </div>
      <h3>{t('As proteções da sua conta')}</h3>
      <div className="settings-card">
        <EditorDeRegras regras={eu.regras!} podeMudar={eu.podeMudarRegras} aoSalvar={salvar} />
        {!eu.podeMudarRegras && <p className="settings-hint">{t('Quem muda estas regras é o seu responsável.')}</p>}
        {eu.usoHoje !== null && <p className="settings-hint">{t('Tempo de uso hoje: {tempo}', { tempo: tempoDeUso(eu.usoHoje, t) })}</p>}
      </div>
      {erro && <p className="form-error">{erro}</p>}
    </>
  );
}

function ParaOResponsavel() {
  const t = useT();
  const [menores, setMenores] = useState<PainelDoMenor[] | null>(null);
  const [codigo, setCodigo] = useState('');
  const [declaro, setDeclaro] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => {
    api<{ menores: PainelDoMenor[] }>('/api/responsavel/menores').then((r) => setMenores(r.menores), (e) => setErro((e as Error).message));
  }, []);
  useEffect(carregar, [carregar]);

  async function ligar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await api('/api/responsavel/ligar', { method: 'POST', body: { codigo, declaro } });
      setCodigo('');
      setDeclaro(false);
      carregar();
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  async function salvar(menorId: number, regras: Partial<Regras>) {
    setErro(null);
    try {
      const atualizado = await api<PainelDoMenor>(`/api/responsavel/menores/${menorId}/regras`, { method: 'PUT', body: regras });
      setMenores((lista) => lista?.map((m) => (m.menorId === menorId ? atualizado : m)) ?? null);
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  async function desligar(menor: PainelDoMenor) {
    if (!window.confirm(t('Desligar a conta de {nome}? De 13 a 15 anos, ela fica parada até ser ligada de novo.', { nome: menor.username }))) return;
    await api(`/api/responsavel/menores/${menor.menorId}`, { method: 'DELETE' }).catch((e) => setErro((e as Error).message));
    carregar();
  }

  return (
    <>
      <h3>{t('Ligar a conta de um filho')}</h3>
      <form className="settings-card settings-form" onSubmit={ligar}>
        <p className="settings-hint">{t('Na conta dele, em Configurações → Família, aparece um código. Digite aqui.')}</p>
        <label className="settings-field">
          {t('Código')}
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={12} autoComplete="off" />
        </label>
        <label className="familia-regra">
          <input type="checkbox" checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} />
          <span>{t('Declaro que sou o pai, a mãe ou o responsável legal por esta pessoa.')}</span>
        </label>
        <button className="btn-primary" disabled={!codigo.trim() || !declaro}>
          {t('Ligar as contas')}
        </button>
      </form>
      {erro && <p className="form-error">{erro}</p>}
      {menores?.map((m) => (
        <div key={m.menorId} className="familia-menor">
          <h4>
            {m.username} · {m.faixa === '13-15' ? t('13 a 15 anos') : t('16 e 17 anos')}
          </h4>
          <p className="settings-hint">
            {t('Tempo de uso hoje: {tempo}', { tempo: tempoDeUso(m.usoHoje, t) })} ·{' '}
            {t('nos últimos 7 dias: {tempo}', { tempo: tempoDeUso(m.usoSemana.reduce((s, d) => s + d.segundos, 0), t) })}
          </p>
          <EditorDeRegras regras={m.regras} podeMudar aoSalvar={(r) => salvar(m.menorId, r)} />
          <div>
            <strong>{t('Adultos com quem fala')}</strong>
            {m.adultos.length === 0 ? (
              <p className="settings-hint">{t('Nenhum.')}</p>
            ) : (
              <ul className="familia-adultos">
                {m.adultos.map((a) => (
                  <li key={a.id}>
                    {a.username}
                    {' · '}
                    {[a.amigo && t('amigo'), a.conversa && t('conversa no particular'), !a.idadeConhecida && t('idade não informada')]
                      .filter(Boolean)
                      .join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="btn-secondary" onClick={() => void desligar(m)}>
            {t('Desligar esta conta')}
          </button>
        </div>
      ))}
    </>
  );
}
