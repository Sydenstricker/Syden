import { type FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { ARTES, ARTE_PADRAO, acharArte } from './boasVindas';
import { useT } from './i18n';
import type { Community } from './types';

// Onde o dono monta o espaço de boas-vindas da comunidade (ver InicioDaComunidade.tsx).
//
// A PRÉVIA É O COMPONENTE INTEIRO DA DECISÃO. Escolher entre oito degradês por NOME — "Aurora",
// "Brasa", "Vinho" — é escolher às cegas, e quem escolhe às cegas escolhe o primeiro. Com a prévia
// desenhada com o texto de verdade por cima, a escolha leva três segundos e acerta.

interface Resposta {
  boasVindas: { titulo: string; texto: string; arte: string } | null;
}

export function EditorDeBoasVindas({ community }: { community: Community }) {
  const t = useT();
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [arte, setArte] = useState(ARTE_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let valeu = true;
    void api<Resposta>(`/api/communities/${community.id}/boas-vindas`)
      .then((r) => {
        if (!valeu) return;
        setTitulo(r.boasVindas?.titulo ?? '');
        setTexto(r.boasVindas?.texto ?? '');
        setArte(r.boasVindas?.arte ?? ARTE_PADRAO);
      })
      .catch(() => {})
      .finally(() => valeu && setCarregando(false));
    return () => {
      valeu = false;
    };
  }, [community.id]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setAviso(null);
    try {
      await api(`/api/communities/${community.id}/boas-vindas`, { method: 'PUT', body: { titulo, texto, arte } });
      setAviso({
        ok: true,
        texto: titulo.trim() || texto.trim() ? t('Pronto. Quem entrar agora vai ver isto.') : t('Espaço desmontado.'),
      });
    } catch (erro) {
      setAviso({ ok: false, texto: (erro as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="settings-hint">{t('Abrindo…')}</p>;

  const escolhida = acharArte(arte);

  return (
    <form className="bv-editor" onSubmit={salvar}>
      <h3>{t('Tela de boas-vindas')}</h3>
      <p className="settings-hint">
        {t(
          'É a primeira coisa que alguém vê ao entrar na comunidade, uma vez só. Sem isto, a pessoa cai direto na lista de canais.',
        )}
      </p>

      <label>
        {t('Título')}
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder={t('Ex.: Chegou!')} />
      </label>

      <label>
        {t('Recado')}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={t('Conte o que é esta comunidade e o que fazer primeiro.')}
        />
      </label>

      <span className="settings-label">{t('Arte de fundo')}</span>
      <div className="bv-artes">
        {Object.entries(ARTES).map(([codigo, a]) => (
          <button
            key={codigo}
            type="button"
            className={`bv-arte-opcao${arte === codigo ? ' escolhida' : ''}`}
            style={{ background: a.fundo }}
            onClick={() => setArte(codigo)}
            title={a.nome}
            aria-label={a.nome}
            aria-pressed={arte === codigo}
          />
        ))}
      </div>

      {/* A prévia usa o MESMO degradê e o MESMO tom de texto da tela de verdade. Se um dia as duas
          divergirem, o dono escolhe uma coisa e a comunidade vê outra. */}
      <span className="settings-label">{t('Como vai ficar')}</span>
      <div className="bv-previa" data-tom={escolhida.tom} style={{ background: escolhida.fundo }}>
        <strong>{titulo || t('Bem-vindo!')}</strong>
        {texto && <p>{texto}</p>}
      </div>

      <div className="settings-actions">
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? t('Aguarde…') : t('Salvar')}
        </button>
      </div>

      {aviso && <p className={aviso.ok ? 'form-success' : 'form-error'}>{aviso.texto}</p>}

      <p className="settings-hint">
        {t('Deixe o título e o recado em branco para desmontar a tela: a comunidade volta a abrir direto nos canais.')}
      </p>
    </form>
  );
}
