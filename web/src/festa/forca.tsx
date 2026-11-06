import { useState } from 'react';
import { chave, useT } from '../i18n';
import { ehAperto, microjogoDaTela, useFormatos, useRelogio, useTeclas, type PropsDoMicro } from './comum';

// Os mesmos números do servidor (server/src/festa/forca.ts).
const FORCA_MS = 8000;

const valorDaForca = (periodoMs: number, t: number) => {
  const fase = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 100 * (1 - Math.abs(fase * 2 - 1));
};

/** A barra de força: sobe e desce, e para no aperto. */
function Forca({ dados, inicio, ativo, enviar }: PropsDoMicro<{ periodoMs?: number }>) {
  const t = useT();
  const f = useFormatos();
  const [parado, setParado] = useState<number | null>(null);
  const agora = useRelogio(ativo && parado === null);
  const periodo = dados.periodoMs ?? 1400;
  const tempo = Math.min(FORCA_MS, Math.max(0, agora - inicio));
  const valor = parado ?? (agora < inicio ? 0 : valorDaForca(periodo, tempo));
  // os 8 s da barra acabaram: ela para, e o aperto já não conta (o servidor espera um pouco mais só pela rede)
  const acabou = agora - inicio >= FORCA_MS;
  const parar = () => {
    if (!ativo || parado !== null || Date.now() < inicio || Date.now() - inicio > FORCA_MS) return;
    const ms = Date.now() - inicio;
    const v = valorDaForca(periodo, ms);
    setParado(v);
    enviar({ t: Math.round(ms) });
  };
  useTeclas(ativo && parado === null && !acabou, (e) => {
    if (!ehAperto(e)) return false;
    parar();
    return true;
  });
  return (
    <div className="festa-forca">
      <div className="festa-forca-barra" aria-hidden="true">
        <span className="festa-forca-cheia" style={{ height: `${valor}%` }} />
        <span className="festa-forca-topo" />
      </div>
      <div className="festa-forca-lado">
        <span className="festa-mostrador">{f.pct.format((parado ?? valor) / 100)}</span>
        <button type="button" className="btn-primary" disabled={!ativo || parado !== null || acabou} onPointerDown={(e) => (e.preventDefault(), parar())}>
          {t('Parar')}
        </button>
      </div>
    </div>
  );
}

export default microjogoDaTela({
  id: 'forca',
  nome: chave('Medidor de força'),
  dica: chave('Pare a barra o mais perto possível de 100%.'),
  Tela: Forca,
  valor: (v, f) => f.pct.format(v / 100),
});
