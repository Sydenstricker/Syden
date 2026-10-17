import { AppWindow, Archive, Check, Coffee, Copy, Ellipsis, Frame, Grid2x2, Home, LayoutGrid, Moon, Mouse, Move, Pencil, Redo2, RotateCcw, RotateCw, Save, Search, Settings, Sofa, Sprout, Sun, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, loadToken } from './api';
import { desktopBridge } from './desktop';
import { Mascote } from './Mascote';
import { useT } from './i18n';
import { casaComABusca, type GrupoDaCena, nomeDaPeca } from './nomesDaCena';
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
 * O EDITOR (EditorDaCena, abaixo) é o layout dele de 16/10/2026: o catálogo com figuras e os nomes traduzidos
 * (nomesDaCena.ts), e o rascunho até Aplicar.
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
  /** Todos os móveis, com a figura de cada um (no catálogo, o que já está no quarto ganha uma cópia). */
  moveis?: Record<string, string>;
  /** Os que se podem guardar (os sem função). */
  guardaveis?: string[];
  /** Cada tipo de janela, com a figura dele (só a original tem cortina e abre). */
  janelas?: Record<string, string>;
}
export interface Arrumacao {
  /** Há o que desfazer e o que refazer (a cena guarda os passos da arrumação). */
  desfazer?: boolean;
  refazer?: boolean;
  /** No Editar: há mudanças que ainda não foram ao servidor (o Salvar acende). */
  pendente?: boolean;
  /** O servidor aceita cópias (a cena só oferece o Duplicar então). */
  copias?: boolean;
  /** Quantos de cada tipo estão na cena: móveis, objetos da parede e objetos de cima. */
  presentes?: { m: Record<string, number>; p: Record<string, number>; o: Record<string, number> };
  /** O que está escolhido na cena ("m" + móvel, "p" + objeto da parede, "o" + objeto de cima, "j" a janela). */
  selecao?: string | null;
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
    <EditorDaCena
      titulo={t('Meu quarto')}
      figuras={figuras}
      arrumacao={arrumacao}
      enviar={enviar}
      podeEditar={pronto}
      carregando={!pronto}
      noite={noite}
      // a engrenagem abre a Aparência (os gráficos do quarto moram lá), como o guarda-roupa
      aoConfigurar={acoes.gavetas ? () => acoesRef.current.gavetas?.onClick() : undefined}
    >
      <div className="quarto-novo-caixa">
        <div className="quarto-novo">
          <iframe ref={ref} src={endereco} title={t('Início')} />
        </div>
      </div>
    </EditorDaCena>
  );
}

/**
 * O EDITOR DA CENA, o mesmo no quarto e no salão (SalaoNovo.tsx), pelo layout dele de 16/10/2026. Fora do Editar, é só a
 * cena e o botão Editar embaixo. No Editar, ocupa a tela: em cima, o nome, Salvar, Desfazer/Refazer, dia e noite e as
 * configurações; à esquerda, as categorias, a busca e o catálogo; no meio, a cena (com a barrinha do que está escolhido,
 * desenhada pela página dela); embaixo, os atalhos, Cancelar e Aplicar.
 *
 * O IFRAME DA CENA NUNCA MUDA DE LUGAR: as partes do Editar entram e saem em volta dele (com o lugar delas guardado
 * mesmo vazias), e o "tela inteira" é só CSS. Mudá-lo de pai na árvore recarregaria a página da cena.
 *
 * As mudanças do Editar ficam PENDENTES até Aplicar (decisão dele): a página da cena guarda o rascunho; Salvar grava sem
 * sair, Cancelar volta ao que estava. Os comandos vão por mensagem e a página faz o mesmo que os botões de teste dela.
 */
type Categoria = 'tudo' | 'moveis' | 'plantas' | 'parede' | 'emCima' | 'tapete' | 'janela';
const PLANTAS = new Set(['planta-alta', 'planta-baixa', 'plantinha']);

/** Um item do catálogo: o que ele põe (grupo e códigos: os iguais com número no salão vão juntos) e a figura. */
interface ItemDoCatalogo {
  chave: string;
  grupo: GrupoDaCena;
  ids: string[];
  src?: string;
  cor?: string;
}

export function EditorDaCena({
  titulo,
  figuras,
  arrumacao,
  enviar,
  podeEditar,
  carregando,
  noite,
  aoConfigurar,
  children,
}: {
  titulo: string;
  figuras: Figuras | null;
  arrumacao: Arrumacao | null;
  enviar: (msg: Record<string, unknown>) => void;
  /** Sem a cena pronta (ou no salão de quem não administra), não há Editar. */
  podeEditar: boolean;
  /** A cena ainda não disse "pronto": no lugar dela, o mascote esperando. */
  carregando?: boolean;
  /** O dia e a noite do app: o do Editar é só uma prévia, e volta a este ao sair. */
  noite: boolean;
  aoConfigurar?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const [editando, setEditando] = useState(false);
  const [categoria, setCategoria] = useState<Categoria>('tudo');
  const [busca, setBusca] = useState('');
  const [previa, setPrevia] = useState<boolean | null>(null);
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;

  useEffect(() => {
    enviarRef.current({ editando });
  }, [editando]);
  // Os nomes da barrinha que a cena põe em cima do que está escolhido.
  useEffect(() => {
    enviarRef.current({ rotulos: { mover: t('Mover'), girar: t('Girar'), tirar: t('Tirar'), duplicar: t('Duplicar'), opcoes: t('Mais opções'), cortina: t('Cortina'), janela: t('Janela') } });
  }, [t]);
  // A prévia de dia ou de noite vale só no Editar; ao sair, volta o do app.
  useEffect(() => {
    if (!editando && previa !== null) {
      setPrevia(null);
      enviarRef.current({ noite });
    }
  }, [editando, previa, noite]);

  const sair = (como: 'aplicar' | 'cancelar') => {
    enviar({ comando: como });
    setEditando(false);
  };

  // Os atalhos com o foco aqui fora (depois de clicar num botão do editor); com o foco na cena, ela mesma os atende.
  useEffect(() => {
    if (!editando) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest('input, textarea, [contenteditable="true"]')) return;
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      const cmd = (comando: string) => {
        e.preventDefault();
        enviarRef.current({ comando });
      };
      if (ctrl && !e.shiftKey && k === 'z') cmd('desfazer');
      else if (ctrl && (k === 'y' || (e.shiftKey && k === 'z'))) cmd('refazer');
      else if (ctrl && k === 's') cmd('salvar');
      else if (ctrl && k === 'd') cmd('duplicar');
      else if (!ctrl && (k === 'delete' || k === 'backspace')) cmd('tirar');
      else if (!ctrl && k === 'g') cmd('mover');
      else if (!ctrl && k === 'r') cmd('girar');
      else if (!ctrl && k === 'e') cmd('opcoes');
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [editando]);

  // O CATÁLOGO: tudo o que se pode pôr, por categoria e pela busca.
  const itens = useMemo(() => {
    if (!figuras) return [] as ItemDoCatalogo[];
    const r: ItemDoCatalogo[] = [];
    // os iguais com número no salão (cadeira, cadeira-2…) são um item só: a mesma figura
    const porFigura = new Map<string, ItemDoCatalogo>();
    for (const [id, src] of Object.entries(figuras.moveis ?? {})) {
      const junto = porFigura.get(src);
      if (junto) junto.ids.push(id);
      else {
        const it: ItemDoCatalogo = { chave: 'm' + id, grupo: 'm', ids: [id], src };
        porFigura.set(src, it);
        r.push(it);
      }
    }
    for (const id of figuras.ordem) r.push({ chave: 'p' + id, grupo: 'p', ids: [id], src: figuras.miniaturas[id] });
    for (const [id, src] of Object.entries(figuras.deCima ?? {})) r.push({ chave: 'o' + id, grupo: 'o', ids: [id], src });
    for (const [id, cor] of Object.entries(figuras.cores)) r.push({ chave: 'c' + id, grupo: 'c', ids: [id], cor });
    for (const [id, src] of Object.entries(figuras.janelas ?? {})) r.push({ chave: 'j' + id, grupo: 'j', ids: [id], src });
    return r;
  }, [figuras]);
  const noGrupo = (cat: Categoria, it: ItemDoCatalogo) => {
    switch (cat) {
      case 'moveis':
        return it.grupo === 'm' && !PLANTAS.has(it.ids[0]);
      case 'plantas':
        return PLANTAS.has(it.ids[0]);
      case 'parede':
        return it.grupo === 'p';
      case 'emCima':
        return it.grupo === 'o' && !PLANTAS.has(it.ids[0]);
      case 'tapete':
        return it.grupo === 'c';
      case 'janela':
        return it.grupo === 'j';
      default:
        return true;
    }
  };
  // a busca vale em todas as categorias
  const visiveis = itens.filter((it) => (busca.trim() ? casaComABusca(t, it.grupo, it.ids[0], busca) : noGrupo(categoria, it)));
  const quantos = (it: ItemDoCatalogo) => {
    const p = arrumacao?.presentes;
    if (it.grupo === 'c') return arrumacao?.tapete === it.ids[0] ? 1 : 0;
    if (it.grupo === 'j') return arrumacao?.janela === it.ids[0] ? 1 : 0;
    const tabela = it.grupo === 'm' ? p?.m : it.grupo === 'p' ? p?.p : p?.o;
    return it.ids.reduce((s, id) => s + (tabela?.[id] ?? 0), 0);
  };
  const por = (it: ItemDoCatalogo) => {
    if (it.grupo === 'c') return enviar({ comando: 'tapete', cor: it.ids[0] });
    if (it.grupo === 'j') return enviar({ comando: 'janela', tipo: it.ids[0] });
    // O QUE JÁ ESTÁ NA CENA (marcado em amarelo) SAI, como a lixeira (pedido dele, 16/10/2026); o que não está, entra.
    // (os iguais com número no salão: entra o primeiro que estiver fora). Mais um igual é o Duplicar.
    if (quantos(it) > 0) return enviar({ comando: 'tirarTipo', grupo: it.grupo, ids: it.ids });
    const tabela = it.grupo === 'm' ? arrumacao?.presentes?.m : it.grupo === 'p' ? arrumacao?.presentes?.p : undefined;
    const fora = it.ids.find((id) => !(tabela?.[id] ?? 0));
    enviar({ comando: 'por', grupo: it.grupo, id: fora ?? it.ids[0] });
  };
  const categorias: { id: Categoria; rotulo: string; Icone: typeof Sofa }[] = [
    { id: 'tudo', rotulo: t('Tudo'), Icone: LayoutGrid },
    { id: 'moveis', rotulo: t('Móveis'), Icone: Sofa },
    { id: 'plantas', rotulo: t('Plantas'), Icone: Sprout },
    { id: 'parede', rotulo: t('Objetos da parede'), Icone: Frame },
    { id: 'emCima', rotulo: t('Em cima dos móveis'), Icone: Coffee },
    { id: 'tapete', rotulo: t('Tapete'), Icone: Grid2x2 },
    { id: 'janela', rotulo: t('Janela'), Icone: AppWindow },
  ];
  const atalhos: { comando: string; rotulo: string; tecla: string; Icone: typeof Sofa }[] = [
    { comando: 'mover', rotulo: t('Mover'), tecla: 'g', Icone: Move },
    { comando: 'girar', rotulo: t('Girar'), tecla: 'r', Icone: RotateCw },
    { comando: 'tirar', rotulo: t('Tirar'), tecla: 'del', Icone: Archive },
    { comando: 'duplicar', rotulo: t('Duplicar'), tecla: 'ctrl+d', Icone: Copy },
    { comando: 'opcoes', rotulo: t('Mais opções'), tecla: 'e', Icone: Ellipsis },
  ];
  // Na aba Tudo (sem busca), um grupo por categoria, com o nome dela; nas outras, uma grade só.
  const secoes =
    categoria === 'tudo' && !busca.trim()
      ? categorias
          .slice(1)
          .map((c) => ({ id: c.id, rotulo: c.rotulo, itens: itens.filter((it) => noGrupo(c.id, it)) }))
          .filter((sec) => sec.itens.length)
      : [{ id: categoria, rotulo: '', itens: visiveis }];
  const semEscolha = !arrumacao?.selecao;
  const noiteAgora = previa ?? noite;

  return (
    // (no app de desktop, o editor começa abaixo da faixa de título: senão os botões da direita ficavam por baixo do
    // minimizar, maximizar e fechar do Windows)
    <div className={'editor-cena' + (editando ? ' editando' : '') + (desktopBridge ? ' no-desktop' : '')}>
      {editando ? (
        <header className="editor-topo">
          <div className="editor-titulo">
            <Home size={20} aria-hidden="true" /> <span>{titulo}</span>
          </div>
          <button type="button" className="editor-botao" disabled={!arrumacao?.pendente} onClick={() => enviar({ comando: 'salvar' })}>
            <Save size={18} aria-hidden="true" /> {t('Salvar')} <kbd>{'ctrl+s'}</kbd>
          </button>
          <div className="editor-par">
            <button type="button" className="editor-botao" disabled={!arrumacao?.desfazer} onClick={() => enviar({ comando: 'desfazer' })}>
              <Undo2 size={18} aria-hidden="true" /> {t('Desfazer')} <kbd>{'ctrl+z'}</kbd>
            </button>
            <button type="button" className="editor-botao" disabled={!arrumacao?.refazer} onClick={() => enviar({ comando: 'refazer' })}>
              <Redo2 size={18} aria-hidden="true" /> {t('Refazer')} <kbd>{'ctrl+y'}</kbd>
            </button>
          </div>
          {/* volta a arrumação de fábrica (no rascunho: Cancelar ainda desfaz) */}
          <button type="button" className="editor-botao" onClick={() => enviar({ comando: 'inicial' })}>
            <RotateCcw size={18} aria-hidden="true" /> {t('Voltar ao padrão')}
          </button>
          <div className="editor-vao" />
          <div className="editor-par editor-dia-noite" role="group">
            <button type="button" aria-pressed={!noiteAgora} aria-label={t('Dia')} title={t('Dia')} onClick={() => { setPrevia(false); enviar({ noite: false }); }}>
              <Sun size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-pressed={noiteAgora} aria-label={t('Noite')} title={t('Noite')} onClick={() => { setPrevia(true); enviar({ noite: true }); }}>
              <Moon size={18} aria-hidden="true" />
            </button>
          </div>
          {aoConfigurar && (
            <button type="button" className="editor-botao editor-icone" aria-label={t('Configurações')} title={t('Configurações')} onClick={aoConfigurar}>
              <Settings size={18} aria-hidden="true" />
            </button>
          )}
        </header>
      ) : null}
      {editando ? (
        <aside className="editor-lado">
          <nav className="editor-categorias">
            {categorias.map(({ id, rotulo, Icone }) => (
              <button key={id} type="button" aria-pressed={!busca.trim() && categoria === id} onClick={() => { setCategoria(id); setBusca(''); }}>
                <Icone size={18} aria-hidden="true" /> <span>{rotulo}</span>
              </button>
            ))}
          </nav>
          <div className="editor-catalogo">
            <label className="editor-busca">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={busca} placeholder={t('Buscar objeto…')} onChange={(e) => setBusca(e.target.value)} />
            </label>
            <div className="editor-lista">
              {secoes.map((sec) => (
                <section key={sec.id} className="editor-secao">
                  {sec.rotulo && <h3>{sec.rotulo}</h3>}
                  <div className="editor-grade">
                    {sec.itens.map((it) => {
                      const nome = nomeDaPeca(t, it.grupo, it.ids[0]), n = quantos(it);
                      return (
                        <button key={it.chave} type="button" className="editor-item" title={nome} aria-label={nome} aria-pressed={n > 0} onClick={() => por(it)}>
                          {it.cor ? <span className="editor-cor" style={{ background: it.cor }} /> : <img src={it.src} alt="" />}
                          {n > 1 && <span className="editor-quantos">×{n}</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
      <div className="editor-palco">
        {children}
        {/* O MASCOTE ESPERANDO enquanto a cena se monta (pedido dele, 16/10/2026: o salão ficava vazio uns segundos). Sem
            texto, como toda espera do Syden (ver CLAUDE.md, "Animações"). */}
        {carregando && (
          <div className="editor-carregando" aria-hidden="true">
            <Mascote nome="introducao" tamanho={180} />
          </div>
        )}
      </div>
      {editando ? (
        <footer className="editor-base">
          <div className="editor-atalhos">
            <span className="editor-atalhos-nome">
              <Mouse size={18} aria-hidden="true" /> {t('Atalhos')}
            </span>
            {atalhos.map(({ comando, rotulo, tecla, Icone }) => (
              <button key={comando} type="button" disabled={semEscolha} onClick={() => enviar({ comando })}>
                <Icone size={18} aria-hidden="true" />
                <span>
                  {rotulo} <kbd>{tecla}</kbd>
                </span>
              </button>
            ))}
          </div>
          <div className="editor-fim">
            <button type="button" className="editor-botao" onClick={() => sair('cancelar')}>
              <X size={18} aria-hidden="true" /> {t('Cancelar')}
            </button>
            <button type="button" className="editor-botao editor-aplicar" onClick={() => sair('aplicar')}>
              <Check size={18} aria-hidden="true" /> {t('Aplicar')}
            </button>
          </div>
        </footer>
      ) : podeEditar ? (
        <div className="editor-entrar">
          <button type="button" className="editor-botao" onClick={() => setEditando(true)}>
            <Pencil size={16} aria-hidden="true" /> {t('Editar')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
