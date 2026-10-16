import { AppWindow, Coffee, Frame, Grid2x2, Pencil, RotateCw, Sofa, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { API_URL, loadToken } from './api';
import { useT } from './i18n';
import type { AcoesDoQuarto } from './Quarto';

/**
 * O QUARTO NOVO, o de móveis soltos que cada pessoa arruma (e2e/pixel-art/quarto/novo/quarto/), dentro do app. No ar
 * para todo mundo desde 16/10/2026: no build, a página sai de montar.mjs --publicar (vite.config.ts), e o Quarto.tsx só
 * volta se ela não puder abrir (cenaNova.ts).
 *
 * O quarto é a própria página do teste, num iframe do mesmo site, em "modo app" (?app): só o quarto. A conversa é por
 * mensagem, e só com a mesma origem:
 * - daqui para lá: as funções (o nome de cada uma já traduzido, as mesmas ações do Quarto.tsx), se é noite, o estado de
 *   quem mora aqui (em call, ausente), a conta (para a arrumação ir ao servidor, /api/quarto) e os comandos da barra de
 *   arrumar;
 * - de lá para cá: que o quarto está pronto (com as figuras da barra), o que está escolhido na arrumação, e o clique numa
 *   função (o fone, o quadro, o guarda-roupa…).
 *
 * A BARRA DE ARRUMAR mostra figuras e não nomes (o recorte de cada objeto da parede, a cor de cada tapete): é o que
 * fica igual nos 80 idiomas sem um texto novo por objeto.
 */
/** A página do quarto, servida pelo Vite no desenvolvimento (vite.config.ts). */
export const ENDERECO_DO_QUARTO = import.meta.env.BASE_URL + 'quarto-novo/';
const ENDERECO = ENDERECO_DO_QUARTO + '?app';

/** O que o coelho faz no quarto é o estado de VERDADE de quem mora nele (a tela não mente): em call, vai ao computador;
 *  ausente, dorme; senão, fica à toa. */
export type EstadoNoQuarto = 'atoa' | 'call' | 'ausente';

export interface Figuras {
  miniaturas: Record<string, string>;
  cores: Record<string, string>;
  ordem: string[];
  /** O primeiro desenho de cada objeto de cima (a caneca, os livros…): clicar põe um no tampo do último móvel tocado. */
  deCima?: Record<string, string>;
  /** As opções de um objeto da parede (o pôster: palco, neon, fogo), com o recorte de cada uma. */
  opcoes?: Record<string, Record<string, string>>;
  /** Os móveis que se podem guardar (os sem função), com a figura de cada um. */
  moveis?: Record<string, string>;
  /** Cada tipo de janela, com a figura dele (só a original tem cortina e abre). */
  janelas?: Record<string, string>;
}
export interface Arrumacao {
  janela: string;
  tapete: string;
  /** A opção escolhida de cada objeto que tem opções (o pôster). */
  opcoes?: Record<string, string>;
  /** Quais desses móveis estão no lugar (false: guardado). */
  moveis?: Record<string, boolean>;
  parede: Record<string, boolean>;
}

export function QuartoNovo({
  noite,
  acoes,
  estado,
  aoFalhar,
  ajustesAbertos,
}: {
  noite: boolean;
  acoes: AcoesDoQuarto;
  estado: EstadoNoQuarto;
  /** As configurações abertas (o guarda-roupa abre a de aparência): fechando, o guarda-roupa do quarto fecha junto. */
  ajustesAbertos?: boolean;
  /** A cena não disse "pronto" a tempo: quem mostra volta ao quarto antigo. */
  aoFalhar?: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLIFrameElement>(null);
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;
  // Se é noite vai no endereço, e não só na mensagem que segue o "pronto": senão o primeiro quadro sai de dia. Só o da
  // abertura (trocar o endereço recarregaria a cena; depois, a troca vai por mensagem).
  const [endereco] = useState(() => ENDERECO + (noite ? '&noite' : ''));
  const [pronto, setPronto] = useState(false);
  const [figuras, setFiguras] = useState<Figuras | null>(null);
  const [arrumacao, setArrumacao] = useState<Arrumacao | null>(null);

  const enviar = (msg: Record<string, unknown>) => ref.current?.contentWindow?.postMessage({ syden: 'quarto', ...msg }, location.origin);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== ref.current?.contentWindow || e.data?.syden !== 'quarto') return;
      if (e.data.pronto) {
        setPronto(true);
        if (e.data.figuras) setFiguras(e.data.figuras);
      }
      if (e.data.arrumacao) setArrumacao(e.data.arrumacao);
      if (typeof e.data.acao === 'string') acoesRef.current[e.data.acao]?.onClick();
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  // Sem o "pronto" da cena a tempo (a página não carregou, ou foi barrada): volta a cena antiga (ver cenaNova.ts).
  useEffect(() => {
    if (pronto || !aoFalhar) return;
    const prazo = setTimeout(aoFalhar, 20_000);
    return () => clearTimeout(prazo);
  }, [pronto, aoFalhar]);

  // Só o que se mostra de cada função (o clique volta para cá, onde mora a ação).
  const funcoes = JSON.stringify(Object.fromEntries(Object.entries(acoes).map(([id, a]) => [id, { rotulo: a?.rotulo, sub: a?.sub }])));
  useEffect(() => {
    if (pronto) enviar({ funcoes: JSON.parse(funcoes), noite });
  }, [pronto, funcoes, noite]);
  useEffect(() => {
    if (pronto) enviar({ estado });
  }, [pronto, estado]);
  // Fechou a aba de aparência (pedido dele, 16/10/2026): de volta ao quarto, as portas do guarda-roupa fecham animadas.
  const ajustesAntes = useRef(false);
  useEffect(() => {
    if (ajustesAntes.current && !ajustesAbertos && pronto) enviar({ fecharGuardaRoupa: true });
    ajustesAntes.current = !!ajustesAbertos;
  }, [ajustesAbertos, pronto]);
  useEffect(() => {
    const token = loadToken();
    if (pronto && token) enviar({ conta: { api: API_URL, token, nome: '', id: 0 } });
  }, [pronto]);

  return (
    <div className="quarto-novo-caixa">
      <div className="quarto-novo">
        <iframe ref={ref} src={endereco} title={t('Início')} />
      </div>
      {pronto && <BarraDeArrumar figuras={figuras} arrumacao={arrumacao} enviar={enviar} />}
    </div>
  );
}

/**
 * A BARRA DE ARRUMAR, a mesma no quarto e no salão (SalaoNovo.tsx): os comandos vão por mensagem para a página da cena,
 * que faz o mesmo que os botões da página de teste.
 *
 * EM ABAS (pedido dele, 16/10/2026: "essas opções precisam de um agrupamento mais adequado"): eram umas 40 figuras numa
 * fila só, misturando cores, objetos da parede, móveis e o que vai em cima deles. Agora a linha de cima tem o Editar, uma
 * aba por grupo e o Voltar ao padrão, e embaixo aparecem só as figuras da aba aberta. Os nomes das abas já existiam
 * traduzidos; nenhum texto novo.
 */
type Aba = 'moveis' | 'parede' | 'emCima' | 'tapete' | 'janela';

export function BarraDeArrumar({ figuras, arrumacao, enviar }: { figuras: Figuras | null; arrumacao: Arrumacao | null; enviar: (msg: Record<string, unknown>) => void }) {
  const t = useT();
  const [arrumando, setArrumando] = useState(false);
  const [aba, setAba] = useState<Aba>('moveis');
  // Editando, o clique na cena arruma (a cortina, abrir a janela) e não abre a função do objeto.
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  useEffect(() => {
    enviarRef.current({ editando: arrumando });
  }, [arrumando]);

  const moveis = figuras?.moveis ?? {};
  const deCima = figuras?.deCima ?? {};
  const janelas = figuras?.janelas ?? {};
  const abas: { id: Aba; rotulo: string; Icone: typeof Sofa }[] = [
    { id: 'moveis', rotulo: t('Móveis'), Icone: Sofa },
    { id: 'parede', rotulo: t('Objetos da parede'), Icone: Frame },
    { id: 'emCima', rotulo: t('Em cima dos móveis'), Icone: Coffee },
    { id: 'tapete', rotulo: t('Tapete'), Icone: Grid2x2 },
    { id: 'janela', rotulo: t('Janela'), Icone: AppWindow },
  ];
  const visiveis = abas.filter((a) => a.id !== 'emCima' || Object.keys(deCima).length > 0);
  const aberta = visiveis.some((a) => a.id === aba) ? aba : 'moveis';

  const figura = (chave: string, src: string, rotulo: string, ligada: boolean | undefined, msg: Record<string, unknown>) => (
    <button key={chave} type="button" className="quarto-novo-objeto" aria-label={rotulo} aria-pressed={ligada} onClick={() => enviar(msg)}>
      <img src={src} alt="" />
    </button>
  );

  return (
    <div className="quarto-novo-barra">
      <div className="quarto-novo-linha">
        <button type="button" aria-pressed={arrumando} onClick={() => setArrumando((a) => !a)}>
          <Pencil size={16} aria-hidden="true" /> {arrumando ? t('Pronto') : t('Editar')}
        </button>
        {arrumando && (
          <>
            <div className="quarto-novo-abas" role="tablist">
              {visiveis.map(({ id, rotulo, Icone }) => (
                <button key={id} type="button" role="tab" aria-selected={aberta === id} onClick={() => setAba(id)}>
                  <Icone size={16} aria-hidden="true" /> <span>{rotulo}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => enviar({ comando: 'inicial' })}>
              <Undo2 size={16} aria-hidden="true" /> {t('Voltar ao padrão')}
            </button>
          </>
        )}
      </div>
      {arrumando && figuras && (
        <div className="quarto-novo-gaveta" role="tabpanel">
          {aberta === 'moveis' && (
            <>
              {/* girar vale para o último móvel tocado na cena */}
              <button type="button" className="quarto-novo-acao" onClick={() => enviar({ comando: 'girar' })}>
                <RotateCw size={16} aria-hidden="true" /> {t('Girar')}
              </button>
              {Object.entries(moveis).map(([id, src], i) => figura(id, src, `${t('Móveis')} ${i + 1}`, arrumacao?.moveis?.[id] !== false, { comando: 'movel', id }))}
            </>
          )}
          {aberta === 'parede' && (
            <>
              {figuras.ordem.map((id, i) => figura(id, figuras.miniaturas[id], `${t('Objetos da parede')} ${i + 1}`, !!arrumacao?.parede[id], { comando: 'parede', id }))}
              {/* as opções de um objeto (o pôster), só enquanto ele está na parede, separadas por um traço */}
              {Object.entries(figuras.opcoes ?? {})
                .filter(([id]) => arrumacao?.parede[id])
                .map(([id, ops]) => (
                  <div key={id} className="quarto-novo-grupo quarto-novo-opcoes" role="group" aria-label={t('Objetos da parede')}>
                    {Object.entries(ops).map(([opcao, src], i) =>
                      figura(opcao, src, `${t('Objetos da parede')} ${i + 1}`, arrumacao?.opcoes?.[id] === opcao, { comando: 'opcao', id, opcao }),
                    )}
                  </div>
                ))}
            </>
          )}
          {aberta === 'emCima' && Object.entries(deCima).map(([id, src], i) => figura(id, src, `${t('Em cima dos móveis')} ${i + 1}`, undefined, { comando: 'objeto', tipo: id }))}
          {aberta === 'tapete' &&
            Object.entries(figuras.cores).map(([id, cor], i) => (
              <button
                key={id}
                type="button"
                className="quarto-novo-cor"
                style={{ background: cor }}
                aria-label={`${t('Tapete')} ${i + 1}`}
                aria-pressed={arrumacao?.tapete === id}
                onClick={() => enviar({ comando: 'tapete', cor: id })}
              />
            ))}
          {/* cada tipo de janela como figura: só a original tem cortina e abre (clicando nela, na cena) */}
          {aberta === 'janela' && Object.entries(janelas).map(([id, src], i) => figura(id, src, `${t('Janela')} ${i + 1}`, arrumacao?.janela === id, { comando: 'janela', tipo: id }))}
        </div>
      )}
    </div>
  );
}
