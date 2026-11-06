import { useState } from 'react';
import { chave, useT } from '../i18n';
import { ehAperto, microjogoDaTela, useFormatos, useRelogio, useTeclas, type PropsDoMicro } from './comum';

// Os mesmos números do servidor (server/src/festa/relogio.ts).
const RELOGIO_MS = 15000;
const RELOGIO_SOME_MS = 3000;

/** O relógio: conta a partir do zero, e os números somem depois de 3 s. */
function Relogio({ inicio, ativo, enviar }: PropsDoMicro) {
  const t = useT();
  const f = useFormatos();
  const [parado, setParado] = useState<number | null>(null);
  const agora = useRelogio(ativo && parado === null);
  const tempo = parado ?? Math.min(RELOGIO_MS, Math.max(0, agora - inicio));
  const escondido = parado === null && tempo >= RELOGIO_SOME_MS;
  const parar = () => {
    if (!ativo || parado !== null || Date.now() < inicio) return;
    const ms = Math.min(RELOGIO_MS, Date.now() - inicio);
    setParado(ms);
    enviar({ t: Math.round(ms) });
  };
  useTeclas(ativo && parado === null, (e) => {
    if (!ehAperto(e)) return false;
    parar();
    return true;
  });
  return (
    <div className="festa-relogio">
      <span className={`festa-mostrador grande${escondido ? ' escondido' : ''}`}>{escondido ? '?' : f.numero.format(tempo / 1000)}</span>
      <span className="festa-meta" aria-hidden="true">
        {f.numero.format(10)}
      </span>
      <button type="button" className="btn-primary" disabled={!ativo || parado !== null} onPointerDown={(e) => (e.preventDefault(), parar())}>
        {t('Parar')}
      </button>
    </div>
  );
}

export default microjogoDaTela({
  id: 'relogio',
  nome: chave('Parar o relógio'),
  dica: chave('Pare o relógio em 10 segundos exatos. Os números somem depois de 3.'),
  Tela: Relogio,
  valor: (v, f) => f.s.format(v / 1000),
});
