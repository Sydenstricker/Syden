import { Link } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';

/**
 * "Ou cole um link": o som vem de um endereço (um link do MyInstants, por exemplo) em vez de um
 * arquivo do computador.
 *
 * QUEM BAIXA É O SERVIDOR, e ele devolve o arquivo sem guardar nada (ver /api/sons/do-endereco). Daqui
 * o arquivo segue pelo MESMO caminho de quem escolheu um no computador — `aoBaixar` recebe um File —,
 * com a mesma conferência de duração e tamanho, e entra como envio da pessoa. É isso que mantém o
 * som como algo que ela subiu, e não algo que o Syden trouxe.
 *
 * A PRÉVIA NÃO É ENFEITE. Colada a página do MyInstants, o servidor deduz o arquivo pelo nome dela,
 * e em nome repetido o palpite pode trazer o OUTRO som de mesmo nome. Ouvir antes de enviar é o que
 * faz esse erro aparecer em vez de ir parar no soundboard de todo mundo.
 */
export function SomPorEndereco({ aoBaixar, desligado }: { aoBaixar: (arquivo: File) => void; desligado?: boolean }) {
  const t = useT();
  const [endereco, setEndereco] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);

  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  async function buscar(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!endereco.trim()) return;
    setBuscando(true);
    setErro(null);
    try {
      const { audio, nome } = await api<{ audio: string; nome: string }>('/api/sons/do-endereco', {
        method: 'POST',
        body: { url: endereco.trim() },
      });
      const arquivo = arquivoDoDataUrl(audio, nome || 'som');
      setPrevia(URL.createObjectURL(arquivo));
      aoBaixar(arquivo);
      setEndereco('');
    } catch (e) {
      setErro((e as Error).message);
    }
    setBuscando(false);
  }

  return (
    <div className="som-por-endereco">
      {/* Não é <form>: estes campos moram DENTRO do formulário de envio, e formulário dentro de
          formulário não existe em HTML — o Enter aqui enviaria o som. */}
      <div className="som-por-endereco-linha">
        <Link size={14} aria-hidden="true" />
        <input
          type="url"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void buscar(e)}
          placeholder={t('ou cole um link (MyInstants, por exemplo)')}
          aria-label={t('Link do som')}
          disabled={desligado || buscando}
        />
        <button type="button" className="btn-secondary" onClick={(e) => void buscar(e)} disabled={desligado || buscando || !endereco.trim()}>
          {buscando ? t('Buscando…') : t('Buscar')}
        </button>
      </div>
      {erro && <p className="form-error small">{erro}</p>}
      {previa && (
        <div className="som-por-endereco-previa">
          <span className="settings-hint">{t('Ouça antes de enviar:')}</span>
          <audio controls src={previa} />
        </div>
      )}
    </div>
  );
}

/** data:audio/mpeg;base64,… → File. Sem fetch(), que a política de segurança não libera para data:. */
function arquivoDoDataUrl(dataUrl: string, nome: string): File {
  const [cabeca, base64] = dataUrl.split(',');
  const tipo = /^data:([^;]+)/.exec(cabeca)?.[1] ?? 'audio/mpeg';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const extensao = tipo.split('/')[1]?.replace('mpeg', 'mp3') ?? 'mp3';
  return new File([bytes], `${nome}.${extensao}`, { type: tipo });
}
