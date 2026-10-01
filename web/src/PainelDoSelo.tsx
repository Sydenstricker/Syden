import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { ApiError, api } from './api';
import { SeloDaComunidade } from './SeloDaComunidade';
import { useT } from './i18n';

interface Selo {
  texto: string;
  icone: string;
  cor: string;
}

interface MarcoNaTela {
  codigo: string;
  nome: string;
  comoSeGanha: string;
  alcancado: boolean;
  progresso: number;
}

interface Dados {
  selo: Selo | null;
  destravado: boolean;
  podeEditar: boolean;
  marcos: MarcoNaTela[];
  icones: string[];
  cores: string[];
}

/**
 * O selo da comunidade e os marcos que o destravam.
 *
 * A tela mostra os marcos para QUALQUER MEMBRO, e não só para quem administra, porque o selo é
 * mérito do grupo: esconder o progresso de quem o está construindo tira metade da graça. Quem
 * administra vê a mais o formulário de escolher.
 *
 * Os marcos já alcançados ficam à mostra mesmo depois de conquistados — viram a história da
 * comunidade, e é o que faz alguém querer o próximo.
 */
export function PainelDoSelo({ communityId }: { communityId: number }) {
  const t = useT();
  const [dados, setDados] = useState<Dados | null>(null);
  const [rascunho, setRascunho] = useState<Selo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api<Dados>(`/api/communities/${communityId}/selo`)
      .then((d) => {
        setDados(d);
        setRascunho(d.selo ?? { texto: '', icone: d.icones[0], cor: d.cores[0] });
      })
      .catch(() => setDados(null));
  }, [communityId]);

  if (!dados) return null;

  const salvar = async () => {
    if (!rascunho) return;
    setSalvando(true);
    setErro(null);
    try {
      const { selo } = await api<{ selo: Selo }>(`/api/communities/${communityId}/selo`, {
        method: 'PUT',
        body: rascunho,
      });
      setDados({ ...dados, selo });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t('Não deu para salvar o selo.'));
    } finally {
      setSalvando(false);
    }
  };

  const tirar = async () => {
    setSalvando(true);
    try {
      await api(`/api/communities/${communityId}/selo`, { method: 'DELETE' });
      setDados({ ...dados, selo: null });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t('Não deu para tirar o selo.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="usage-card">
      <h3>{t('Selo da comunidade')}</h3>
      <p className="settings-hint">
        Quatro caracteres, um ícone e uma cor que aparecem ao lado do nome de quem é daqui.{' '}
        <strong>{t('Não se compra: conquista-se.')}</strong> Os marcos abaixo foram escolhidos para não haver
        como alcançá-los sozinho — todos precisam de mais de uma pessoa, ao longo do tempo.
      </p>

      <ul className="marcos">
        {dados.marcos.map((m) => (
          <li key={m.codigo} className={m.alcancado ? 'feito' : undefined}>
            <span className="marcos-icone" aria-hidden="true">
              {m.alcancado ? <Check size={15} /> : <Lock size={14} />}
            </span>
            <span className="marcos-texto">
              <strong>{m.nome}</strong>
              <small>{m.comoSeGanha}</small>
              {/* A barra só aparece no que falta: barra cheia num marco já feito é ruído, e o
                  símbolo ao lado já diz que ele caiu. */}
              {!m.alcancado && (
                <span
                  className="marcos-barra"
                  role="progressbar"
                  aria-valuenow={Math.round(m.progresso * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progresso de ${m.nome}`}
                >
                  <span style={{ width: `${Math.round(m.progresso * 100)}%` }} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {!dados.destravado && (
        <p className="settings-hint">
          {t('O selo aparece aqui quando o primeiro marco cair. Até lá ele fica guardado — e chegar nele é justamente o que ele vai significar.')}
        </p>
      )}

      {dados.destravado && dados.podeEditar && rascunho && (
        <div className="selo-editor">
          <h4 className="disponibilidade-titulo">{t('Escolha o selo')}</h4>

          <label htmlFor="selo-texto">{t('Texto (até 4 caracteres)')}</label>
          <input
            id="selo-texto"
            value={rascunho.texto}
            maxLength={4}
            onChange={(e) => setRascunho({ ...rascunho, texto: e.target.value })}
            placeholder={t('ZECA')}
          />

          <span className="selo-rotulo">{t('Ícone')}</span>
          <div className="selo-opcoes">
            {dados.icones.map((icone) => (
              <button
                key={icone}
                className={`selo-opcao${rascunho.icone === icone ? ' escolhida' : ''}`}
                aria-pressed={rascunho.icone === icone}
                aria-label={icone}
                onClick={() => setRascunho({ ...rascunho, icone })}
              >
                <SeloDaComunidade selo={{ ...rascunho, icone, texto: '' }} soIcone />
              </button>
            ))}
          </div>

          <span className="selo-rotulo">{t('Cor')}</span>
          <div className="selo-opcoes">
            {dados.cores.map((cor) => (
              <button
                key={cor}
                className={`selo-opcao cor${rascunho.cor === cor ? ' escolhida' : ''}`}
                style={{ background: cor }}
                aria-pressed={rascunho.cor === cor}
                aria-label={`Cor ${cor}`}
                onClick={() => setRascunho({ ...rascunho, cor })}
              />
            ))}
          </div>

          <div className="selo-previa">
            <span>{t('Fica assim:')}</span>
            <SeloDaComunidade selo={rascunho} />
            <em>nome de quem é daqui</em>
          </div>

          {erro && <p className="form-error">{erro}</p>}

          <div className="selo-acoes">
            <button className="btn-primary" disabled={salvando || !rascunho.texto.trim()} onClick={() => void salvar()}>
              {t('Salvar selo')}
            </button>
            {dados.selo && (
              <button className="btn-sutil" disabled={salvando} onClick={() => void tirar()}>
                {t('Tirar o selo')}
              </button>
            )}
          </div>
        </div>
      )}

      {dados.destravado && !dados.podeEditar && (
        <p className="settings-hint">
          {dados.selo ? (
            <>
              {t('O selo desta comunidade é')} <SeloDaComunidade selo={dados.selo} />. Quem administra escolhe qual é.
            </>
          ) : (
            t('A comunidade já conquistou o selo, e quem administra ainda não escolheu qual será.')
          )}
        </p>
      )}
    </section>
  );
}
