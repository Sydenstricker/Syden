import { Copyright, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { chave, useT } from './i18n';

interface Conteudo {
  tipo: 'som' | 'musica' | 'emoji';
  id: number;
  nome: string;
  onde: string;
  autorId: number | null;
  autorNome: string | null;
  retiradasAntes: number;
}

interface Retirada {
  id: number;
  at: string;
  tipo: Conteudo['tipo'];
  nome: string;
  onde: string;
  autorNome: string | null;
  reclamante: string;
  por: string;
}

const NOME_DO_TIPO: Record<Conteudo['tipo'], string> = { som: chave('O som'), musica: chave('A música'), emoji: chave('O emoji') };
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * O aviso que quem subiu recebe, já escrito. Ele cumpre o que os termos (seção 4) prometem: dizer o que
 * saiu e por quê, e abrir a porta para a pessoa contestar — a resposta dela cai nesta mesma conversa.
 * Fica editável na tela: quem retira pode trocar o tom, ou escrever na língua da pessoa.
 */
// SEM GÊNERO NA FRASE: "saiu" e "publicar" servem para o som, a música e o emoji ("A música foi retirado"
// era o erro da primeira versão), e nada nela supõe quem é a pessoa que subiu.
function avisoPadrao(c: Conteudo, reclamante: string, t: ReturnType<typeof useT>) {
  return t(
    '{tipo} «{item}» ({onde}) saiu do Syden porque {quem} disse ter os direitos. Se você tinha autorização para publicar, responda aqui contando: a sua resposta vai ser levada em conta. Enquanto isso não ficar claro, fica fora. Os termos explicam como funciona, na seção 4: https://syden.chat/termos.html#direito-autoral',
    { tipo: t(NOME_DO_TIPO[c.tipo]), item: c.nome, onde: c.onde, quem: reclamante || '…' },
  );
}

/**
 * RETIRADA POR DIREITO AUTORAL, para quem cuida do Syden (11/10/2026).
 *
 * Quem tem o direito escreve para direitos@syden.chat dizendo o que é e onde está. Aqui se procura pelo
 * nome, se retira e se avisa quem subiu, de uma vez — e o número de retiradas anteriores aparece ao lado
 * de cada pessoa, porque os termos dizem que a reincidência custa a conta. Essa decisão continua sendo
 * de uma pessoa: o painel mostra, não bane. Ver server/src/direito-autoral-routes.ts.
 */
export function PainelDireitoAutoral() {
  const t = useT();
  const [termo, setTermo] = useState('');
  const [achados, setAchados] = useState<Conteudo[] | null>(null);
  const [escolhido, setEscolhido] = useState<Conteudo | null>(null);
  const [reclamante, setReclamante] = useState('');
  const [aviso, setAviso] = useState('');
  const [avisoEditado, setAvisoEditado] = useState(false);
  const [historico, setHistorico] = useState<Retirada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregarHistorico = () =>
    void api<Retirada[]>('/api/direito-autoral')
      .then(setHistorico)
      .catch((e) => setErro((e as Error).message));
  useEffect(carregarHistorico, []);

  // Enquanto ninguém mexeu no aviso, ele acompanha quem reclamou.
  useEffect(() => {
    if (escolhido && !avisoEditado) setAviso(avisoPadrao(escolhido, reclamante.trim(), t));
  }, [escolhido, reclamante, avisoEditado, t]);

  async function procurar(event: { preventDefault(): void }) {
    event.preventDefault();
    setErro(null);
    setFeito(null);
    try {
      setAchados(await api<Conteudo[]>(`/api/direito-autoral/procurar?q=${encodeURIComponent(termo.trim())}`));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function retirar() {
    if (!escolhido) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await api<{ avisado: boolean; retiradasDoAutor: number }>('/api/direito-autoral/retirar', {
        method: 'POST',
        body: { tipo: escolhido.tipo, id: escolhido.id, reclamante: reclamante.trim(), aviso: aviso.trim() },
      });
      setFeito(
        t('«{nome}» saiu.', { nome: escolhido.nome }) +
          ' ' +
          (r.avisado ? t('Quem subiu recebeu o aviso numa conversa com você.') : t('Não havia a quem avisar.')) +
          (r.retiradasDoAutor > 1 ? ' ' + t('É a retirada número {n} desta pessoa.', { n: r.retiradasDoAutor }) : ''),
      );
      setAchados((lista) => lista?.filter((c) => !(c.tipo === escolhido.tipo && c.id === escolhido.id)) ?? null);
      setEscolhido(null);
      setReclamante('');
      setAvisoEditado(false);
      carregarHistorico();
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  return (
    <section className="usage-card direito-autoral">
      <h3>
        <Copyright size={16} aria-hidden="true" /> {t('Direito autoral')}
      </h3>
      <p className="settings-hint">
        {t(
          'Quem tem o direito escreve para direitos@syden.chat dizendo o que é e onde está. Procure pelo nome, retire, e quem subiu recebe o aviso numa conversa com você, onde pode contestar.',
        )}
      </p>

      <form className="direito-autoral-busca" onSubmit={(e) => void procurar(e)}>
        <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder={t('Nome do som, da música ou do emoji')} aria-label={t('Procurar conteúdo')} />
        <button type="submit" className="btn-secondary" disabled={termo.trim().length < 2}>
          <Search size={14} aria-hidden="true" /> {t('Procurar')}
        </button>
      </form>

      {erro && <p className="form-error">{erro}</p>}
      {feito && <p className="settings-hint direito-autoral-feito">{feito}</p>}

      {achados && achados.length === 0 && <p className="settings-hint">{t('Nada com esse nome.')}</p>}
      {achados && achados.length > 0 && (
        <ul className="denuncias-lista">
          {achados.map((c) => (
            <li key={`${c.tipo}-${c.id}`} className="denuncia-item">
              <div className="denuncia-topo">
                <strong>
                  {t(NOME_DO_TIPO[c.tipo])} «{c.nome}»
                </strong>
                <small>
                  {c.onde}
                  {c.autorNome && ` · ${t('quem subiu: {nome}', { nome: c.autorNome })}`}
                  {c.retiradasAntes > 0 && ` · ${t('{n} retirada(s) antes', { n: c.retiradasAntes })}`}
                </small>
              </div>
              {escolhido?.tipo === c.tipo && escolhido.id === c.id ? (
                <div className="denuncia-resolver">
                  <input
                    value={reclamante}
                    onChange={(e) => setReclamante(e.target.value)}
                    placeholder={t('Quem reclamou (nome e e-mail)')}
                    aria-label={t('Quem reclamou')}
                    autoFocus
                  />
                  {c.autorNome && (
                    <textarea
                      value={aviso}
                      onChange={(e) => {
                        setAviso(e.target.value);
                        setAvisoEditado(true);
                      }}
                      rows={5}
                      aria-label={t('Aviso para quem subiu')}
                    />
                  )}
                  <div className="dialog-actions">
                    <button type="button" className="btn-secondary" onClick={() => setEscolhido(null)}>
                      {t('Cancelar')}
                    </button>
                    <button type="button" className="btn-primary danger" disabled={ocupado || reclamante.trim().length < 3} onClick={() => void retirar()}>
                      {t('Retirar e avisar')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEscolhido(c);
                    setAvisoEditado(false);
                  }}
                >
                  {t('Retirar')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h4>{t('Retiradas feitas')}</h4>
      {historico && historico.length === 0 && <p className="settings-hint">{t('Nenhuma retirada até agora.')}</p>}
      {historico && historico.length > 0 && (
        <ul className="denuncias-lista">
          {historico.map((r) => (
            <li key={r.id} className="denuncia-item resolvida">
              <div className="denuncia-topo">
                <strong>
                  {t(NOME_DO_TIPO[r.tipo])} «{r.nome}»
                </strong>
                <small>
                  {quando(r.at)} · {r.onde}
                  {r.autorNome && ` · ${t('quem subiu: {nome}', { nome: r.autorNome })}`}
                </small>
              </div>
              <p className="settings-hint">{t('Reclamação de {quem}. Quem retirou: {por}.', { quem: r.reclamante, por: r.por })}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
