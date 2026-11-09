import { useEffect } from 'react';
import { CommunityIcon } from './CommunityIcon';
import { useT } from './i18n';

/** O que o servidor conta de um convite antes de entrar (GET /api/convite/:code). */
export type PreviaDoConvite = { id: number; name: string; iconVersion: number | null; membros: number; jaParticipa: boolean };

/**
 * ABRIR UM LINK DE CONVITE NÃO PÕE NINGUÉM NA COMUNIDADE (pedido de 09/11/2026: "ao entrar num servidor, perguntar se
 * a pessoa quer mesmo entrar"). Antes, o Shell entrava assim que a sessão abria. Agora a comunidade aparece — a imagem,
 * o nome e quanta gente há — e só o "Entrar na comunidade" entra; "Agora não" (ou Esc, ou clicar fora) volta para
 * onde a pessoa estava.
 *
 * Quem acabou de criar a conta pelo próprio convite NÃO vê isto: o cadastro já o pôs na comunidade (a tela dizia "Você
 * foi convidado"), e o servidor responde jaParticipa — depois do "sim", não se pergunta de novo.
 */
export function ConviteParaComunidade({
  previa,
  entrando,
  erro,
  aoEntrar,
  aoFechar,
}: {
  previa: PreviaDoConvite;
  entrando: boolean;
  erro: string | null;
  aoEntrar: () => void;
  aoFechar: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const aoTeclar = (event: KeyboardEvent) => event.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog convite-comunidade" role="dialog" aria-modal="true" aria-labelledby="convite-comunidade-nome">
        <p className="convite-comunidade-rotulo">{t('Convite para a comunidade')}</p>
        <div className="convite-comunidade-quem">
          <CommunityIcon community={previa} size={64} standalone />
          <div>
            <h2 id="convite-comunidade-nome">{previa.name}</h2>
            {previa.membros > 1 && <span className="convite-comunidade-gente">{t('{n} pessoas', { n: previa.membros })}</span>}
          </div>
        </div>
        {erro && <p className="form-error">{erro}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={aoFechar}>
            {t('Agora não')}
          </button>
          <button type="button" className="btn-primary" onClick={aoEntrar} disabled={entrando} autoFocus>
            {entrando ? t('Aguarde…') : t('Entrar na comunidade')}
          </button>
        </div>
      </div>
    </div>
  );
}
