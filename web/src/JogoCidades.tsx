import { useRef, useState } from 'react';
import { idiomaAtual, useT } from './i18n';
import { Placar, Relogio } from './Minijogo';
import { coresDe, Dado, Peca, useAgora } from './JogoTabuleiro';
import type { CartaDasCidades, EstadoCidades, OcorridoDasCidades, Partida, PropostaDasCidades } from './minijogos';

/**
 * CIDADES À VENDA (04/11/2026, server/src/minijogo-cidades.ts): o jogo de comprar cidades e cobrar aluguel, SÓ A MECÂNICA.
 * O tabuleiro é nosso e desenhado aqui por código: uma volta retangular de 32 casas (10 × 8), cada capital com a SIGLA do
 * estado em letras grandes e a cor da região, a borda na cor de quem é dono e os prédios em quadradinhos. O servidor decide
 * tudo; a tela só conta e pede.
 */

// Os mesmos números do servidor.
const PASSO_MS = 220;
const TEMPO_DA_VEZ = 20_000;
const TEMPO_DA_COMPRA = 15_000;
const TEMPO_DAS_ACOES = 30_000;
const TEMPO_DA_TROCA = 20_000;
const TEMPO_DO_LEILAO = 12_000;

const CASA = 40;
const COLUNAS = 10;
const LINHAS = 8;

/** Onde fica cada casa (0 a 31): a fileira de cima da esquerda para a direita, desce pela direita, volta por baixo e sobe. */
export function lugarDaCasaDasCidades(i: number): { x: number; y: number } {
  let c: number;
  let l: number;
  if (i <= 9) [c, l] = [i, 0];
  else if (i <= 16) [c, l] = [9, i - 9];
  else if (i <= 25) [c, l] = [25 - i, 7];
  else [c, l] = [0, 32 - i];
  return { x: c * CASA, y: l * CASA };
}

/** A cor de cada grupo, do Norte ao Sudeste. */
export const COR_DO_GRUPO = ['#6fa86a', '#3f8a72', '#e0b04a', '#d98448', '#b8743f', '#6d8fc4', '#9a72b8'];

const ICONE: Record<string, string> = {
  largada: '➜',
  noticia: '📰',
  pedagio: '🚧',
  engarrafamento: '🚗',
  feriado: '⛱️',
  rodoviaria: '🚌',
  porto: '⛴️',
  aeroporto: '✈️',
  ferrovia: '🚆',
};

const reais = (n: number) => `R$ ${n.toLocaleString(idiomaAtual())}`;

type T = ReturnType<typeof useT>;

/** O nome de uma casa: a cidade (nome próprio), ou o tipo traduzido. */
function nomeDaCasa(e: EstadoCidades, i: number, t: T): string {
  const c = e.casas[i];
  if (!c) return '';
  if (c.tipo === 'cidade') return c.nome ?? '';
  if (c.tipo === 'transporte') {
    if (c.nome === 'rodoviaria') return t('Rodoviária');
    if (c.nome === 'porto') return t('Porto');
    if (c.nome === 'aeroporto') return t('Aeroporto');
    return t('Ferrovia');
  }
  if (c.tipo === 'largada') return t('Largada');
  if (c.tipo === 'noticia') return t('Notícia');
  if (c.tipo === 'pedagio') return t('Pedágio');
  if (c.tipo === 'engarrafamento') return t('Engarrafamento');
  return t('Feriado');
}

function textoDaCarta(carta: CartaDasCidades, valor: number | null, t: T): string {
  const n = valor ?? 0;
  switch (carta) {
    case 'quadrilha':
      return t('Sua quadrilha ganhou o festival junino: receba {valor}.', { valor: reais(n) });
    case 'bolso':
      return t('Achou dinheiro no bolso da calça: receba {valor}.', { valor: reais(n) });
    case 'feira':
      return t('Vendeu tudo na feira: receba {valor}.', { valor: reais(n) });
    case 'carro':
      return t('O carro quebrou na estrada: pague {valor}.', { valor: reais(n) });
    case 'multa':
      return t('Multa por parar na calçada: pague {valor}.', { valor: reais(n) });
    case 'largada':
      return t('Volte para a Largada e receba o salário.');
    case 'carona':
      return t('Pegou uma carona: avance 3 casas.');
    case 'onibus-errado':
      return t('Pegou o ônibus errado: volte 3 casas.');
    case 'chuva':
      return t('A chuva fechou a estrada: vá para o Engarrafamento.');
    case 'reforma':
      return t('Reforma geral: pague {valor} por prédio.', { valor: reais(n) });
    case 'aniversario':
      return t('É o seu aniversário: cada um te dá {valor}.', { valor: reais(n) });
    case 'festa':
      return t('Você pagou a festa: dê {valor} a cada um.', { valor: reais(n) });
    case 'passagem':
      return t('Ganhou uma passagem: avance até o próximo transporte.');
  }
}

function textoDoOcorrido(o: OcorridoDasCidades, e: EstadoCidades, nomeDe: (id: number) => string, t: T): string {
  const casa = (i: number) => nomeDaCasa(e, i, t);
  switch (o.tipo) {
    case 'salario':
      return t('{nome} passou pela Largada: +{valor}.', { nome: nomeDe(o.userId), valor: reais(o.valor) });
    case 'aluguel':
      return t('{nome} pagou {valor} de aluguel a {outro} ({cidade}).', { nome: nomeDe(o.de), valor: reais(o.valor), outro: nomeDe(o.para), cidade: casa(o.casa) });
    case 'comprou':
      return t('{nome} comprou {cidade} por {valor}.', { nome: nomeDe(o.userId), cidade: casa(o.casa), valor: reais(o.valor) });
    case 'leilao':
      return o.userId === null
        ? t('Ninguém deu lance: {cidade} continua à venda.', { cidade: casa(o.casa) })
        : t('{nome} levou {cidade} no leilão por {valor}.', { nome: nomeDe(o.userId), cidade: casa(o.casa), valor: reais(o.valor) });
    case 'carta':
      return `📰 ${nomeDe(o.userId)}: ${textoDaCarta(o.carta, o.valor, t)}`;
    case 'pedagio':
      return t('{nome} pagou {valor} de pedágio.', { nome: nomeDe(o.userId), valor: reais(o.valor) });
    case 'engarrafado':
      return t('{nome} ficou no engarrafamento e perde a próxima vez.', { nome: nomeDe(o.userId) });
    case 'perdeu-vez':
      return t('{nome} ainda está no engarrafamento.', { nome: nomeDe(o.userId) });
    case 'vendeu-para-pagar':
      return t('{nome} vendeu prédios e hipotecou cidades para pagar ({valor}).', { nome: nomeDe(o.userId), valor: reais(o.valor) });
    case 'faliu':
      return o.credor === null
        ? t('{nome} faliu e as cidades voltaram ao banco.', { nome: nomeDe(o.userId) })
        : t('{nome} faliu, e tudo o que tinha foi para {outro}.', { nome: nomeDe(o.userId), outro: nomeDe(o.credor) });
    case 'troca':
      return o.aceita
        ? t('{nome} e {outro} fecharam uma troca.', { nome: nomeDe(o.de), outro: nomeDe(o.para) })
        : t('{outro} não aceitou a troca de {nome}.', { nome: nomeDe(o.de), outro: nomeDe(o.para) });
    case 'construiu':
      return t('{nome} construiu um prédio em {cidade}.', { nome: nomeDe(o.userId), cidade: casa(o.casa) });
    case 'vendeu-predio':
      return t('{nome} vendeu um prédio em {cidade}.', { nome: nomeDe(o.userId), cidade: casa(o.casa) });
    case 'hipotecou':
      return t('{nome} hipotecou {cidade}.', { nome: nomeDe(o.userId), cidade: casa(o.casa) });
    case 'resgatou':
      return t('{nome} resgatou {cidade}.', { nome: nomeDe(o.userId), cidade: casa(o.casa) });
  }
}

/** O desenho do tabuleiro. */
function Tabuleiro({
  estado,
  posDe,
  corDe,
  escolhida,
  aoEscolher,
}: {
  estado: EstadoCidades;
  posDe: (userId: number) => number;
  corDe: (userId: number) => { pelo: string; roupa: string };
  escolhida: number | null;
  aoEscolher: (i: number) => void;
}) {
  const t = useT();
  const largura = COLUNAS * CASA;
  const altura = LINHAS * CASA;
  const posse = new Map(estado.posses.map((p) => [p.casa, p]));
  const porCasa = new Map<number, number[]>();
  estado.jogadores
    .filter((j) => !j.falido)
    .forEach((j) => porCasa.set(posDe(j.userId), [...(porCasa.get(posDe(j.userId)) ?? []), j.userId]));
  const dados = estado.ultimo?.dados;
  return (
    <svg className="cid-tabuleiro" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={t('Cidades à venda')}>
      <rect width={largura} height={altura} fill="#2f4a3a" />
      {/* o meio: o mapa de estradas, os dados da última jogada */}
      <rect x={CASA} y={CASA} width={CASA * 8} height={CASA * 6} fill="#3b5a46" />
      {Array.from({ length: 7 }, (_, k) => (
        <rect key={`e${k}`} x={CASA + 12 + k * 44} y={CASA * 4 - 1} width="24" height="2" fill="#e8d9a8" opacity="0.35" />
      ))}
      {Array.from({ length: 5 }, (_, k) => (
        <rect key={`v${k}`} x={CASA * 5 - 1} y={CASA + 10 + k * 46} width="2" height="24" fill="#e8d9a8" opacity="0.35" />
      ))}
      {dados && (
        <g transform={`translate(${CASA * 5 - 44} ${CASA * 4 - 20})`}>
          <foreignObject width="88" height="40">
            <div className="cid-dados-meio">
              <Dado n={dados[0]} tamanho={36} />
              <Dado n={dados[1]} tamanho={36} />
            </div>
          </foreignObject>
        </g>
      )}
      {estado.casas.map((c, i) => {
        const { x, y } = lugarDaCasaDasCidades(i);
        const p = posse.get(i);
        const dono = p ? corDe(p.dono) : null;
        const fundo = c.tipo === 'cidade' ? COR_DO_GRUPO[c.grupo ?? 0] : c.tipo === 'transporte' ? '#cfc4ae' : '#e8dcc4';
        return (
          <g
            key={i}
            className={`cid-casa${escolhida === i ? ' escolhida' : ''}`}
            onClick={() => aoEscolher(i)}
            role="button"
            aria-label={nomeDaCasa(estado, i, t)}
          >
            <rect x={x + 1} y={y + 1} width={CASA - 2} height={CASA - 2} rx="3" fill={fundo} opacity={p?.hipotecada ? 0.45 : 1} />
            {dono && <rect x={x + 2.5} y={y + 2.5} width={CASA - 5} height={CASA - 5} rx="2" fill="none" stroke={dono.roupa} strokeWidth="3" />}
            {c.tipo === 'cidade' ? (
              <>
                <text x={x + CASA / 2} y={y + 16} textAnchor="middle" className="cid-uf">
                  {c.uf}
                </text>
                <text x={x + CASA / 2} y={y + 26} textAnchor="middle" className="cid-preco">
                  {p ? '' : c.preco}
                </text>
              </>
            ) : (
              <text x={x + CASA / 2} y={y + 21} textAnchor="middle" className="cid-icone">
                {ICONE[c.tipo === 'transporte' ? (c.nome ?? '') : c.tipo]}
              </text>
            )}
            {p && p.predios > 0 && (
              <g>
                {Array.from({ length: p.predios }, (_, k) => (
                  <rect key={k} x={x + 6 + k * 7.5} y={y + 18} width="6" height="5" fill="#f3ead8" stroke="#3a2e2a" strokeWidth="1" />
                ))}
              </g>
            )}
          </g>
        );
      })}
      {/* as peças: quem está na vez por cima */}
      {[...estado.jogadores]
        .filter((j) => !j.falido)
        .sort((a, b) => Number(a.userId === estado.vez) - Number(b.userId === estado.vez))
        .map((j) => {
          const casa = posDe(j.userId);
          const { x, y } = lugarDaCasaDasCidades(casa);
          const ids = porCasa.get(casa) ?? [j.userId];
          const k = ids.indexOf(j.userId);
          // embaixo da sigla, pequenas, lado a lado (até 3 por fileira)
          const dx = ids.length > 1 ? ((k % 3) - (Math.min(ids.length, 3) - 1) / 2) * 10 : 0;
          const dy = ids.length > 3 && k >= 3 ? -7 : 0;
          const cores = corDe(j.userId);
          return (
            <g key={j.userId} opacity={j.presente ? 1 : 0.45} pointerEvents="none">
              <g transform={`translate(${x + CASA / 2 + dx} ${y + CASA - 9 + dy}) scale(0.62)`}>
                <Peca pelo={cores.pelo} roupa={cores.roupa} x={0} y={0} vez={j.userId === estado.vez} />
              </g>
            </g>
          );
        })}
    </svg>
  );
}

/** O cartão da casa escolhida: o preço, o aluguel, o dono, e as ações de quem é dono, na vez dele. */
function CartaoDaCasa({
  estado,
  i,
  eu,
  posso,
  pedir,
  nomeDe,
}: {
  estado: EstadoCidades;
  i: number;
  eu: number;
  posso: boolean;
  pedir: (corpo: Record<string, unknown>) => void;
  nomeDe: (id: number) => string;
}) {
  const t = useT();
  const c = estado.casas[i];
  const p = estado.posses.find((x) => x.casa === i);
  const meu = p?.dono === eu;
  return (
    <div className="cid-cartao">
      <p className="cid-cartao-nome">
        {c.tipo === 'cidade' && <span className="cid-cartao-cor" style={{ background: COR_DO_GRUPO[c.grupo ?? 0] }} aria-hidden="true" />}
        <strong>{nomeDaCasa(estado, i, t)}</strong>
        {c.uf && <span className="cid-cartao-uf">{c.uf}</span>}
      </p>
      {(c.tipo === 'cidade' || c.tipo === 'transporte') && (
        <>
          <p>
            {t('Preço')}: {reais(c.preco ?? 0)}
            {p ? ` · ${t('Dono')}: ${nomeDe(p.dono)}` : ''}
            {p?.hipotecada ? ` · ${t('Hipotecada')}` : ''}
          </p>
          {c.tipo === 'cidade' ? (
            <>
              <table className="cid-cartao-tabela">
                <tbody>
                  <tr className={p && p.predios === 0 ? 'agora' : ''}>
                    <th>{t('Aluguel')}</th>
                    <td>{reais(c.aluguel ?? 0)}</td>
                  </tr>
                  <tr>
                    <th>{t('Com a região inteira')}</th>
                    <td>{reais((c.aluguel ?? 0) * 2)}</td>
                  </tr>
                  {estado.multiplicador.slice(1).map((m, k) => (
                    <tr key={k} className={p?.predios === k + 1 ? 'agora' : ''}>
                      <th aria-label={t('Prédios: {n}', { n: k + 1 })}>
                        {Array.from({ length: k + 1 }, (_, q) => (
                          <span key={q} className="cid-predio" aria-hidden="true" />
                        ))}
                      </th>
                      <td>{reais((c.aluguel ?? 0) * m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cid-cartao-alugueis">{t('Cada prédio custa {valor}.', { valor: reais(c.custo ?? 0) })}</p>
            </>
          ) : (
            <p className="cid-cartao-alugueis">
              {t('Aluguel pelo número de transportes do mesmo dono')}: {estado.aluguelDoTransporte.map(reais).join(' · ')}
            </p>
          )}
          {p && <p>{t('Aluguel agora: {valor}', { valor: reais(p.aluguel) })}</p>}
          {meu && posso && (
            <div className="minijogo-acoes">
              {c.tipo === 'cidade' && !p.hipotecada && (
                <button type="button" className="btn-primary" onClick={() => pedir({ tipo: 'construir', casa: i })}>
                  {t('Construir')}
                </button>
              )}
              {p.predios > 0 && (
                <button type="button" className="btn-secondary" onClick={() => pedir({ tipo: 'vender', casa: i })}>
                  {t('Vender prédio')}
                </button>
              )}
              {!p.hipotecada && p.predios === 0 && (
                <button type="button" className="btn-secondary" onClick={() => pedir({ tipo: 'hipotecar', casa: i })}>
                  {t('Hipotecar por {valor}', { valor: reais(Math.floor((c.preco ?? 0) / 2)) })}
                </button>
              )}
              {p.hipotecada && (
                <button type="button" className="btn-secondary" onClick={() => pedir({ tipo: 'resgatar', casa: i })}>
                  {t('Resgatar por {valor}', { valor: reais(Math.ceil(Math.floor((c.preco ?? 0) / 2) * estado.jurosDoResgate)) })}
                </button>
              )}
            </div>
          )}
        </>
      )}
      {c.tipo === 'largada' && <p>{t('Quem passa por aqui recebe {valor}.', { valor: reais(estado.salario) })}</p>}
      {c.tipo === 'pedagio' && <p>{t('Quem para aqui paga {valor}.', { valor: reais(c.valor ?? 0) })}</p>}
      {c.tipo === 'engarrafamento' && <p>{t('Quem para aqui perde a próxima vez.')}</p>}
      {c.tipo === 'noticia' && <p>{t('Quem para aqui tira uma notícia.')}</p>}
      {c.tipo === 'feriado' && <p>{t('Um descanso: aqui não acontece nada.')}</p>}
    </div>
  );
}

/** Montar uma proposta de troca: com quem, o que dou e o que peço. */
function MontarTroca({
  estado,
  eu,
  nomeDe,
  aoEnviar,
  aoFechar,
}: {
  estado: EstadoCidades;
  eu: number;
  nomeDe: (id: number) => string;
  aoEnviar: (corpo: Omit<PropostaDasCidades, 'de'>) => void;
  aoFechar: () => void;
}) {
  const t = useT();
  const outros = estado.jogadores.filter((j) => j.userId !== eu && !j.falido && j.presente);
  const [para, setPara] = useState<number>(outros[0]?.userId ?? 0);
  const [dar, setDar] = useState<number[]>([]);
  const [pedir, setPedir] = useState<number[]>([]);
  const [darDinheiro, setDarDinheiro] = useState(0);
  const [pedirDinheiro, setPedirDinheiro] = useState(0);
  // com prédio no grupo não se troca (o servidor confere; aqui só não oferece)
  const prediosNoGrupo = (g: number | undefined) =>
    g === undefined ? 0 : estado.posses.filter((p) => estado.casas[p.casa].grupo === g && estado.casas[p.casa].tipo === 'cidade').reduce((n, p) => n + p.predios, 0);
  const trocaveis = (dono: number) =>
    estado.posses.filter((p) => p.dono === dono && (estado.casas[p.casa].tipo !== 'cidade' || prediosNoGrupo(estado.casas[p.casa].grupo) === 0)).map((p) => p.casa);
  const alternar = (lista: number[], set: (l: number[]) => void, i: number) => set(lista.includes(i) ? lista.filter((x) => x !== i) : [...lista, i]);
  const meu = estado.jogadores.find((j) => j.userId === eu)!;
  const dele = estado.jogadores.find((j) => j.userId === para);
  const lista = (casas: number[], escolhidas: number[], set: (l: number[]) => void) =>
    casas.length ? (
      <ul className="cid-troca-lista">
        {casas.map((i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={escolhidas.includes(i)} onChange={() => alternar(escolhidas, set, i)} />
              {estado.casas[i].tipo === 'cidade' && <span className="cid-cartao-cor" style={{ background: COR_DO_GRUPO[estado.casas[i].grupo ?? 0] }} aria-hidden="true" />}
              {nomeDaCasa(estado, i, t)}
            </label>
          </li>
        ))}
      </ul>
    ) : (
      <p className="cid-troca-vazia">{t('Nenhuma cidade para trocar.')}</p>
    );
  if (!outros.length) return null;
  return (
    <div className="cid-troca">
      <label className="cid-troca-com">
        {t('Trocar com')}{' '}
        <select
          value={para}
          onChange={(e) => {
            setPara(Number(e.target.value));
            setPedir([]);
            setPedirDinheiro(0);
          }}
        >
          {outros.map((j) => (
            <option key={j.userId} value={j.userId}>
              {j.username}
            </option>
          ))}
        </select>
      </label>
      <div className="cid-troca-lados">
        <div>
          <strong>{t('Você dá')}</strong>
          {lista(trocaveis(eu), dar, setDar)}
          <label>
            R${' '}
            <input type="number" min={0} max={meu.dinheiro} step={10} value={darDinheiro} onChange={(e) => setDarDinheiro(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
          </label>
        </div>
        <div>
          <strong>{t('Você pede')}</strong>
          {lista(trocaveis(para), pedir, setPedir)}
          <label>
            R${' '}
            <input
              type="number"
              min={0}
              max={dele?.dinheiro ?? 0}
              step={10}
              value={pedirDinheiro}
              onChange={(e) => setPedirDinheiro(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
          </label>
        </div>
      </div>
      <div className="minijogo-acoes">
        <button
          type="button"
          className="btn-primary"
          disabled={!dar.length && !pedir.length && !darDinheiro && !pedirDinheiro}
          onClick={() => aoEnviar({ para, darCasas: dar, pedirCasas: pedir, darDinheiro, pedirDinheiro })}
        >
          {t('Propor a {nome}', { nome: nomeDe(para) })}
        </button>
        <button type="button" className="btn-secondary" onClick={aoFechar}>
          {t('Cancelar')}
        </button>
      </div>
    </div>
  );
}

/** O que a troca proposta é, numa linha de cada lado. */
function ResumoDaTroca({ estado, troca, eu, nomeDe }: { estado: EstadoCidades; troca: PropostaDasCidades; eu: number; nomeDe: (id: number) => string }) {
  const t = useT();
  const lado = (casas: number[], dinheiro: number) => [...casas.map((i) => nomeDaCasa(estado, i, t)), ...(dinheiro ? [reais(dinheiro)] : [])].join(', ') || '—';
  const souEu = troca.para === eu;
  return (
    <div className="cid-troca-resumo">
      <p>
        <strong>{souEu ? t('Você recebe') : t('{nome} recebe', { nome: nomeDe(troca.para) })}:</strong> {lado(troca.darCasas, troca.darDinheiro)}
      </p>
      <p>
        <strong>{souEu ? t('Você dá') : t('{nome} dá', { nome: nomeDe(troca.para) })}:</strong> {lado(troca.pedirCasas, troca.pedirDinheiro)}
      </p>
    </div>
  );
}

export function JogoCidades({
  estado,
  eu,
  jogador,
  restante,
  agir,
}: {
  estado: EstadoCidades & Partida;
  eu: number;
  jogador: boolean;
  restante: number;
  agir: (corpo: Record<string, unknown>) => unknown;
}) {
  const t = useT();
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [trocando, setTrocando] = useState(false);
  const nomeDe = (id: number) => estado.jogadores.find((j) => j.userId === id)?.username ?? '';
  const indiceDe = new Map(estado.jogadores.map((j, i) => [j.userId, i]));
  const corDe = (id: number) => coresDe(estado.jogadores.find((j) => j.userId === id)?.avatar ?? null, indiceDe.get(id) ?? 0);

  // O ANDAR NA TELA: a peça passa casa a casa pelo caminho, a partir de quando o estado chegou aqui. O servidor só aplica a
  // casa quando a peça chega, então não há conta para segurar.
  const andando = useRef<{ id: number; em: number } | null>(null);
  const ultimo = estado.ultimo;
  if (ultimo && estado.fase === 'andando' && andando.current?.id !== ultimo.id) andando.current = { id: ultimo.id, em: estado.recebidaEm };
  const duracao = ultimo ? (ultimo.caminho.length - 1) * PASSO_MS : 0;
  const inicio = andando.current && ultimo && andando.current.id === ultimo.id ? andando.current.em : null;
  const animando = inicio !== null && Date.now() - inicio < duracao;
  const agora = useAgora(animando);
  const passo = animando && inicio !== null ? Math.floor((Math.max(agora, inicio) - inicio) / PASSO_MS) : Infinity;
  const posDe = (userId: number) => {
    if (ultimo && ultimo.userId === userId && passo < ultimo.caminho.length - 1) return ultimo.caminho[Math.max(0, passo)];
    return estado.jogadores.find((j) => j.userId === userId)?.pos ?? 0;
  };

  if (estado.terminada || estado.fase === 'fim') {
    const valor = (l: { patrimonio: number; falido: boolean }) => (l.falido ? t('Faliu') : reais(l.patrimonio));
    const comPosicao = estado.interrompida ? [] : estado.classificacao.filter((l) => l.posicao !== null);
    const semPosicao = estado.classificacao.filter((l) => !comPosicao.includes(l));
    return (
      <div className="cidades-jogo">
        {estado.interrompida && <p className="minijogo-situacao">{t('Faltou gente: a partida acabou antes do fim, sem troféus.')}</p>}
        {!estado.interrompida && comPosicao.length === 0 && <p className="minijogo-situacao">{t('Menos de duas pessoas ficaram até o fim: desta vez, sem pódio.')}</p>}
        {comPosicao.length > 0 && <Placar eu={eu} linhas={comPosicao.map((l) => ({ ...l, posicao: l.posicao ?? undefined, valor: valor(l) }))} />}
        {semPosicao.length > 0 && (
          <ol className="minijogo-placar tabuleiro-sem-posicao">
            {semPosicao.map((l) => (
              <li key={l.userId} className={l.userId === eu ? 'eu' : ''}>
                <span className="minijogo-medalha" aria-hidden="true" />
                <span className="minijogo-nome">{l.username}</span>
                {!estado.interrompida && l.saiu && <span className="tabuleiro-saiu">{t('Saiu antes do fim')}</span>}
                <span className="minijogo-pontos">{valor(l)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const eu_ = estado.jogadores.find((j) => j.userId === eu);
  const ativo = jogador && !!eu_ && !eu_.falido;
  const minhaVez = ativo && estado.vez === eu;
  const quemJoga = estado.vez !== null ? nomeDe(estado.vez) : '';
  const pedir = (corpo: Record<string, unknown>) => void agir(corpo);
  const casaDaVez = estado.vez !== null ? (estado.jogadores.find((j) => j.userId === estado.vez)?.pos ?? 0) : 0;

  const placar = (
    <ol className="cid-placar">
      {estado.jogadores.map((j) => {
        const cores = corDe(j.userId);
        return (
          <li key={j.userId} className={`${j.userId === eu ? 'eu' : ''}${j.userId === estado.vez ? ' vez' : ''}${j.presente ? '' : ' fora'}${j.falido ? ' falido' : ''}`}>
            <span className="tab-placar-cor" style={{ background: cores.roupa, borderColor: cores.pelo }} aria-hidden="true" />
            <span className="minijogo-nome">{j.username}</span>
            <span className="cid-placar-dinheiro">{j.falido ? t('Faliu') : reais(j.dinheiro)}</span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="cidades-jogo">
      <div className="cid-topo">
        {placar}
        <span className="cid-rodada">
          {estado.rodadas !== null ? t('Rodada {n} de {total}', { n: estado.rodada, total: estado.rodadas }) : t('Rodada {n} · até sobrar um', { n: estado.rodada })}
        </span>
      </div>
      <div className="cid-corpo">
        <Tabuleiro estado={estado} posDe={posDe} corDe={corDe} escolhida={escolhida} aoEscolher={(i) => setEscolhida(i === escolhida ? null : i)} />
        <div className="cid-lado">
          <div className="cid-vez" aria-live="polite">
            {estado.fase === 'vez' && (
              <>
                <p className="minijogo-situacao">{minhaVez ? t('Sua vez!') : t('Vez de {nome}.', { nome: quemJoga })}</p>
                {minhaVez && (
                  <button type="button" className="btn-primary" onClick={() => pedir({ tipo: 'dados' })}>
                    <Dado n={5} tamanho={20} /> {t('Jogar os dados')}
                  </button>
                )}
                <Relogio restante={restante} total={TEMPO_DA_VEZ} />
              </>
            )}
            {estado.fase === 'andando' && <p className="minijogo-situacao">{t('Vez de {nome}.', { nome: quemJoga })}</p>}
            {estado.fase === 'compra' && (
              <>
                {minhaVez ? (
                  <>
                    <p className="minijogo-situacao">
                      {t('Comprar {cidade} por {valor}?', { cidade: nomeDaCasa(estado, casaDaVez, t), valor: reais(estado.casas[casaDaVez].preco ?? 0) })}
                    </p>
                    <div className="minijogo-acoes">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={(eu_?.dinheiro ?? 0) < (estado.casas[casaDaVez].preco ?? 0)}
                        onClick={() => pedir({ tipo: 'comprar', sim: true })}
                      >
                        {t('Comprar')}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => pedir({ tipo: 'comprar', sim: false })}>
                        {t('Leiloar')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="minijogo-situacao">{t('{nome} está decidindo se compra {cidade}.', { nome: quemJoga, cidade: nomeDaCasa(estado, casaDaVez, t) })}</p>
                )}
                <Relogio restante={restante} total={TEMPO_DA_COMPRA} />
              </>
            )}
            {estado.fase === 'leilao' && estado.leilao && (
              <>
                <p className="minijogo-situacao">{t('Leilão: {cidade}', { cidade: nomeDaCasa(estado, estado.leilao.casa, t) })}</p>
                <p className="cid-lance">
                  {estado.leilao.lider === null
                    ? t('Nenhum lance ainda.')
                    : t('{valor}, de {nome}', { valor: reais(estado.leilao.lance), nome: nomeDe(estado.leilao.lider) })}
                </p>
                {ativo && eu_?.presente !== false && (
                  <div className="minijogo-acoes">
                    {[10, 50, 100].map((mais) => {
                      const valor = estado.leilao!.lance + mais;
                      return (
                        <button key={mais} type="button" className="btn-primary" disabled={valor > (eu_?.dinheiro ?? 0) || estado.leilao!.lider === eu} onClick={() => pedir({ tipo: 'lance', valor })}>
                          +{mais}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Relogio restante={restante} total={TEMPO_DO_LEILAO} />
              </>
            )}
            {estado.fase === 'acoes' && (
              <>
                {minhaVez ? (
                  <>
                    <p className="minijogo-situacao">{t('Toque numa cidade sua para construir ou hipotecar.')}</p>
                    {trocando ? (
                      <MontarTroca
                        estado={estado}
                        eu={eu}
                        nomeDe={nomeDe}
                        aoFechar={() => setTrocando(false)}
                        aoEnviar={(proposta) => {
                          setTrocando(false);
                          pedir({ tipo: 'propor', ...proposta });
                        }}
                      />
                    ) : (
                      <div className="minijogo-acoes">
                        <button type="button" className="btn-primary" onClick={() => pedir({ tipo: 'terminar' })}>
                          {t('Terminar a vez')}
                        </button>
                        {estado.trocasRestantes > 0 && (
                          <button type="button" className="btn-secondary" onClick={() => setTrocando(true)}>
                            {t('Propor troca')}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="minijogo-situacao">{t('{nome} está fazendo negócios.', { nome: quemJoga })}</p>
                )}
                <Relogio restante={restante} total={TEMPO_DAS_ACOES} />
              </>
            )}
            {estado.fase === 'troca' && estado.troca && (
              <>
                <p className="minijogo-situacao">{t('{nome} propõe uma troca a {outro}.', { nome: nomeDe(estado.troca.de), outro: nomeDe(estado.troca.para) })}</p>
                <ResumoDaTroca estado={estado} troca={estado.troca} eu={eu} nomeDe={nomeDe} />
                {estado.troca.para === eu && ativo && (
                  <div className="minijogo-acoes">
                    <button type="button" className="btn-primary" onClick={() => pedir({ tipo: 'responder', sim: true })}>
                      {t('Aceitar')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => pedir({ tipo: 'responder', sim: false })}>
                      {t('Recusar')}
                    </button>
                  </div>
                )}
                {estado.troca.de === eu && (
                  <div className="minijogo-acoes">
                    <button type="button" className="btn-secondary" onClick={() => pedir({ tipo: 'cancelar' })}>
                      {t('Desistir da troca')}
                    </button>
                  </div>
                )}
                <Relogio restante={restante} total={TEMPO_DA_TROCA} />
              </>
            )}
          </div>
          {escolhida !== null && (
            <CartaoDaCasa estado={estado} i={escolhida} eu={eu} posso={minhaVez && estado.fase === 'acoes'} pedir={pedir} nomeDe={nomeDe} />
          )}
          <ol className="cid-historico" aria-label={t('O que aconteceu')}>
            {[...estado.historico]
              .reverse()
              .slice(0, 6)
              .map((o) => (
                <li key={o.id}>{textoDoOcorrido(o, estado, nomeDe, t)}</li>
              ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Antes do convite: rodadas fixas (10, 20 ou 30) ou até sobrar um. */
export function EscolhaDasCidades({ aoEscolher, aoVoltar }: { aoEscolher: (corpo: Record<string, unknown>) => void; aoVoltar: () => void }) {
  const t = useT();
  return (
    <div className="tab-escolha">
      <p className="minijogo-situacao">{t('Até quando?')}</p>
      <ul className="tab-rodadas">
        {[10, 20, 30].map((n) => (
          <li key={n}>
            <button type="button" className="tab-rodadas-botao" onClick={() => aoEscolher({ modo: 'rodadas', rodadas: n })}>
              <strong>{n}</strong>
              <span>{t('rodadas')}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="tab-rodadas-botao" onClick={() => aoEscolher({ modo: 'falencia' })}>
            <strong>1</strong>
            <span>{t('Até sobrar um')}</span>
          </button>
        </li>
      </ul>
      <div className="minijogo-acoes">
        <button type="button" className="btn-secondary" onClick={aoVoltar}>
          {t('Outros jogos')}
        </button>
      </div>
    </div>
  );
}
