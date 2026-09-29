import { useEffect, useState } from 'react';
import { Gauge, KeyRound, TriangleAlert } from 'lucide-react';
import { api } from './api';
import { useT } from './i18n';

interface Dados {
  pageviews: number;
  visitas: number;
  lcpMedianaMs: number | null;
  lcpP75Ms: number | null;
  ttfbMedianaMs: number | null;
  porDia: { dia: string; visitas: number; pageviews: number }[];
}

type Audiencia =
  | ({ situacao: 'ok'; aviso: { venceEm: string; diasAteVencer: number } | null } & Dados)
  | { situacao: 'falhou'; motivo: string; chaveVencida: boolean };

/** Abaixo de um segundo, milissegundo é mais legível; acima, segundo com uma casa. */
const tempo = (ms: number | null) => (ms === null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

const diaCurto = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const dataLonga = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'long' });

const ONDE = 'dash.cloudflare.com → perfil → API Tokens';

// As faixas são as oficiais do Core Web Vitals, as mesmas que o Google usa para julgar um site.
// Mostrar "2,8 s" sem dizer que 2,8 s é ruim deixa a conclusão por conta de quem olha — e quem olha
// não tem obrigação de saber onde fica a linha.
const LCP_BOM = 2500;
const LCP_RUIM = 4000;

/** O veredito vem ESCRITO, nunca só na cor: quem não distingue as cores precisa ler a mesma coisa. */
function julgar(ms: number | null): { texto: string; classe: string } | null {
  if (ms === null) return null;
  if (ms <= LCP_BOM) return { texto: 'bom', classe: 'bom' };
  if (ms <= LCP_RUIM) return { texto: 'dá para melhorar', classe: 'medio' };
  return { texto: 'ruim', classe: 'ruim' };
}

/**
 * Quanta gente abre o site, e quanto ele demora para abrir na casa dela.
 *
 * É o único número do painel que vem de FORA do nosso servidor. O painel de crescimento conta contas,
 * que é coisa nossa; este conta visitas, inclusive de quem nunca se cadastrou — e mede o carregamento
 * na rede de quem está abrindo, que é a única medição que a nossa máquina não sabe fazer.
 *
 * Três estados, e a diferença entre eles é o ponto principal desta tela:
 *
 *   nulo      sem chave configurada. A seção não existe. É o estado de quem nunca ligou isto.
 *   'falhou'  chave configurada e não funcionando. GRITA em vermelho, com o motivo e onde resolver —
 *             porque a chave vence em um ano, e sumir em silêncio faria parecer que o site esvaziou.
 *   'ok'      os números. E, se o vencimento estiver a menos de 30 dias, um aviso âmbar por cima
 *             deles: o melhor momento para renovar é enquanto ainda funciona.
 */
export function PainelDeAudiencia() {
  const t = useT();
  const [dados, setDados] = useState<Audiencia | null | 'carregando'>('carregando');

  useEffect(() => {
    api<Audiencia | null>('/api/status/audiencia')
      .then(setDados)
      .catch(() => setDados(null));
  }, []);

  if (dados === 'carregando' || dados === null) return null;

  if (dados.situacao === 'falhou') {
    return (
      <section className="usage-card audiencia-parou">
        <h3>
          <TriangleAlert size={16} aria-hidden="true" /> {t('A medição de audiência parou')}
        </h3>
        <p className="audiencia-motivo">{dados.motivo}</p>
        {dados.chaveVencida ? (
          <p className="settings-hint">
            A chave de leitura da Cloudflare tinha validade e chegou ao fim. Crie outra em <strong>{ONDE}</strong>, com
            a permissão <strong>Account · Account Analytics · Read</strong>, e troque o valor de{' '}
            <code>CLOUDFLARE_API_TOKEN</code> no <code>.env</code> do servidor.
          </p>
        ) : (
          <p className="settings-hint">
            {t('Enquanto isto aparecer, os números abaixo não existem —')} <strong>não é que ninguém esteja entrando no
            site</strong>. O motivo acima veio da própria Cloudflare, e o registro do servidor tem a mensagem completa.
          </p>
        )}
      </section>
    );
  }

  // O maior dia define a altura das barras. Sem ele (ou com tudo zerado) não se divide por zero.
  const teto = Math.max(1, ...dados.porDia.map((d) => d.visitas));
  const veredito = julgar(dados.lcpMedianaMs);

  return (
    <section className="usage-card">
      <h3>
        <Gauge size={16} aria-hidden="true" /> {t('Quem abre o site')}
      </h3>
      <p className="settings-hint">
        Últimos 7 dias, medidos pelo Web Analytics da Cloudflare. Conta quem abre a página, tenha conta ou não — e o
        tempo de carregamento é o da rede de quem abriu, não o da nossa.
      </p>

      {dados.aviso && (
        <p className="audiencia-vencendo">
          <KeyRound size={15} aria-hidden="true" />
          <span>
            {dados.aviso.diasAteVencer <= 0 ? (
              <>
                A chave da Cloudflare <strong>vence hoje</strong>.
              </>
            ) : (
              <>
                A chave da Cloudflare vence em <strong>{dados.aviso.diasAteVencer} dias</strong> (
                {dataLonga(dados.aviso.venceEm)}).
              </>
            )}{' '}
            Renove agora, enquanto ainda funciona: {ONDE}, permissão <strong>Account · Account Analytics · Read</strong>
            , e troque <code>CLOUDFLARE_API_TOKEN</code> no <code>.env</code> do servidor.
          </span>
        </p>
      )}

      <div className="painel-numeros">
        <div>
          <strong>{dados.visitas.toLocaleString('pt-BR')}</strong>
          <small>{t('Visitas')}</small>
        </div>
        <div>
          <strong>{dados.pageviews.toLocaleString('pt-BR')}</strong>
          <small>{t('Páginas abertas')}</small>
        </div>
        <div>
          <strong>{tempo(dados.lcpMedianaMs)}</strong>
          <small>Tela pronta</small>
          {veredito && <em className={`audiencia-veredito ${veredito.classe}`}>{veredito.texto}</em>}
        </div>
      </div>

      {dados.lcpP75Ms !== null && (
        <p className="audiencia-p75">
          <strong>Tela pronta</strong> é o instante em que o maior elemento da página termina de desenhar — a medida
          que mais se parece com “já dá para usar”. Até {tempo(LCP_BOM)} é bom; acima de {tempo(LCP_RUIM)}, ruim. Na
          quarta parte mais lenta o Syden levou <strong>{tempo(dados.lcpP75Ms)}</strong>, e é esse número que diz se
          alguém desistiu de esperar — a média esconde justamente quem teve a pior experiência.
          {dados.ttfbMedianaMs !== null && (
            <>
              {' '}
              Desse tempo, <strong>{tempo(dados.ttfbMedianaMs)}</strong> foi só o servidor começar a responder: se esse
              pedaço for grande, o lento é o servidor; se for pequeno, é a página que está pesada.
            </>
          )}
        </p>
      )}

      {dados.porDia.length > 0 && (
        <>
          <h4 className="disponibilidade-titulo">Visitas por dia</h4>
          <ul className="audiencia-barras">
            {dados.porDia.map((d) => (
              <li key={d.dia} title={`${diaCurto(d.dia)}: ${d.visitas} visitas, ${d.pageviews} páginas`}>
                <b>{d.visitas}</b>
                {/* O trilho tem altura FIXA, e é isso que faz a porcentagem da barra significar algo.
                    Com `min-height` a altura não é definida, a porcentagem não resolve, e toda barra
                    desaba para o mínimo — vira um risco de 2px igual para todos os dias. */}
                <span className="audiencia-trilho">
                  <span className="audiencia-barra" style={{ height: `${Math.round((d.visitas / teto) * 100)}%` }} />
                </span>
                <small>{diaCurto(d.dia)}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
