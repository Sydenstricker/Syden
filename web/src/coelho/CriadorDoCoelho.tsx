import { RotateCcw, RotateCw, Shuffle, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import { algarismos } from '../algarismos';
import { enderecoDoCoelhoPronto } from '../Avatar';
import { chave, useT } from '../i18n';
import { avisarQuartoMudou } from '../quartoMudou';
import { LinhaDoPersonagem } from '../personagemUi';
import { primeiraForma } from '../minijogos';
import { BustoDoCoelho, PalcoDoCoelho } from './CoelhoMontado';
import { carregarDados, DIRECOES, type Direcao } from './montar';
import { BASES, codigo, corpoDe, CORPOS, lerCodigo, mesmaReceita, partesDoCorpo, PRESETS, RECEITA_DO_MASCOTE, type Base, type Corpo, type Cor, type Receita, type Tipo, type Veste } from './receita';

/**
 * O CRIADOR DE COELHO NO APP (10/11/2026, pedido dele: "gostei da tela de criação, pode implementar ao Syden?", e "usar os 16
 * avatares como sugestões"). A prévia publicada virou a primeira folha da Aparência → Avatar:
 * - o PALCO mostra o coelho como ele aparece no quarto e no salão (o montado em camadas: coelho/montar.ts), girando e acenando
 *   ao clique; no canto, o AVATAR redondo como os outros vão vê-lo nas listas;
 * - a linha "Coelho" passa pelas 16 SUGESTÕES (os coelhos prontos, PRESETS em receita.ts). Escolhida e intacta, o avatar
 *   continua o desenho pronto dela; mexeu em qualquer traço, ela vira "Personalizado" e o avatar passa a ser o coelho montado;
 * - os traços: corpo, pelo, roupa, cabeça e pescoço, cada cor com as amostras e o seletor livre (RGB);
 * - o CÓDIGO do coelho para copiar e colar, e "Meus coelhos", guardados na conta.
 * Nada muda no servidor até o "Salvar" (a lição do carrossel de 10/11: a primeira seta não pode levar o avatar de agora).
 */

const NOME_DA_BASE: Record<Base, string> = { mascote: chave('Padrão'), 'orelha-caida': chave('Orelha caída'), musculoso: chave('Forte') };
const NOME_DO_TIPO: Record<Tipo, string> = { masculino: chave('Masculino'), feminino: chave('Feminino') };
/** O nome da roupa de cada combinação (a cor dela é a linha de cores logo abaixo). */
function nomeDaRoupa(c: Corpo): string {
  const { base, veste } = partesDoCorpo(c);
  if (base === 'musculoso') return veste === 'curta' ? chave('Regata curta e short') : chave('Regata e short');
  return veste === 'curta' ? chave('Moletom curto') : chave('Moletom');
}

/**
 * OS CORPOS QUE JÁ TÊM DESENHO (public/coelho/dados.json): o tipo de corpo e a roupa só aparecem quando a combinação existe,
 * para a tela não oferecer o que não há (a versão feminina de cada corpo chega aos poucos, com os créditos do PixelLab).
 */
function useCorposProntos(): Set<string> {
  const [prontos, setProntos] = useState<Set<string>>(new Set(['mascote']));
  useEffect(() => {
    let vivo = true;
    carregarDados().then(
      (d) => vivo && setProntos(new Set(Object.entries(d.corpos).filter(([, c]) => c.animacoes.parado?.['south-east']).map(([id]) => id))),
      () => {},
    );
    return () => {
      vivo = false;
    };
  }, []);
  return prontos;
}
const PELOS: { nome: string; cor: string }[] = [
  { nome: chave('Branco'), cor: '#f4f1f1' },
  { nome: chave('Creme'), cor: '#f0dcb8' },
  { nome: chave('Cinza'), cor: '#a9a9b3' },
  { nome: chave('Caramelo'), cor: '#d39a5e' },
  { nome: chave('Chocolate'), cor: '#7a4e35' },
  { nome: chave('Preto'), cor: '#4a4550' },
  { nome: chave('Rosa'), cor: '#f1b6c8' },
  { nome: chave('Lavanda'), cor: '#c9b8e8' },
];
const TECIDOS: { nome: string; cor: string }[] = [
  { nome: chave('Vermelho'), cor: '#c4343b' },
  { nome: chave('Azul'), cor: '#3d6fd1' },
  { nome: chave('Verde'), cor: '#5f7d3c' },
  { nome: chave('Mostarda'), cor: '#d8a32a' },
  { nome: chave('Roxo'), cor: '#7a4fc0' },
  { nome: chave('Rosa'), cor: '#e07aa6' },
  { nome: chave('Laranja'), cor: '#e8742a' },
  { nome: chave('Cinza'), cor: '#6d6f7a' },
  { nome: chave('Creme'), cor: '#e9dcc0' },
];
const SUGESTOES = 16;

interface Membro {
  avatarVersion: number | null;
  avatarPronto?: number | null;
  coelho?: string | null;
}

/** O coelho em montagem, guardado fora do componente (ver "O RASCUNHO" abaixo). */
let rascunho: { chave: string; receita: Receita; sugestao: number } | null = null;

export function CriadorDoCoelho({ eu, avatarAtual }: { eu: Membro | undefined; avatarAtual: ReactNode }) {
  const t = useT();
  const prontos = useCorposProntos();
  const atualPronto = eu?.avatarPronto ?? null;
  const atualFoto = (eu?.avatarVersion ?? null) !== null;
  const atualCodigo = eu?.coelho ?? null;
  // o coelho que está valendo: a receita guardada; sem ela, a da sugestão que a pessoa usa; sem nada, o mascote
  const salva = lerCodigo(atualCodigo) ?? (atualPronto ? PRESETS[atualPronto] : RECEITA_DO_MASCOTE);
  // O RASCUNHO (relato dele, 10/11/2026: "alterei entre a aba Avatar e Aplicativo, e resetou o coelho que eu estava
  // configurando"): trocar de aba desmonta o criador. O que está sendo montado fica guardado enquanto a página vive, e volta
  // ao reabrir, desde que o avatar não tenha mudado nesse meio-tempo (salvo aqui ou por outro caminho).
  const chaveDoAvatar = `${atualPronto}|${atualCodigo}|${eu?.avatarVersion ?? ''}`;
  const guardado = rascunho?.chave === chaveDoAvatar ? rascunho : null;
  const [receita, setReceita] = useState<Receita>(guardado?.receita ?? salva);
  // 0 é o ATUAL (o que vale agora, seja foto, sugestão ou coelho montado); 1 a 16, as sugestões
  const [sugestao, setSugestao] = useState(guardado?.sugestao ?? (atualPronto && !atualFoto ? atualPronto : 0));
  useEffect(() => {
    rascunho = { chave: chaveDoAvatar, receita, sugestao };
  }, [chaveDoAvatar, receita, sugestao]);
  const [dir, setDir] = useState<Direcao>('south-east');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // o avatar mudou (salvo aqui, pela foto, por um anterior): a tela volta ao que vale. Ao abrir com um rascunho, fica ele.
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      if (guardado) return;
    }
    setReceita(lerCodigo(atualCodigo) ?? (atualPronto ? PRESETS[atualPronto] : RECEITA_DO_MASCOTE));
    setSugestao(atualPronto && !atualFoto ? atualPronto : 0);
  }, [atualPronto, atualCodigo, atualFoto, eu?.avatarVersion]);

  const pronto = sugestao > 0 && mesmaReceita(receita, PRESETS[sugestao]) ? sugestao : null;
  const personalizado = sugestao > 0 ? pronto === null : !mesmaReceita(receita, salva);
  // o "Salvar" só aparece quando a escolha é outra que não a de agora
  const mudou = !(sugestao === 0 && !personalizado) && (atualFoto || pronto !== atualPronto || codigo(receita) !== codigo(salva));

  function mexer(mudanca: Partial<Receita>) {
    setErro(null);
    setAviso(null);
    setReceita((r) => ({ ...r, ...mudanca }));
  }
  function trocarSugestao(passo: number) {
    // com a foto ou o coelho montado valendo, o "Atual" entra na volta; com uma sugestão, o atual já é uma das 16
    const comAtual = !(atualPronto && !atualFoto);
    const posicoes = comAtual ? SUGESTOES + 1 : SUGESTOES;
    const indice = comAtual ? sugestao : sugestao - 1;
    const novo = (indice + passo + posicoes) % posicoes;
    const s = comAtual ? novo : novo + 1;
    setErro(null);
    setAviso(null);
    setSugestao(s);
    setReceita(s > 0 ? PRESETS[s] : salva);
  }
  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      // o servidor leva a foto (ou o GIF) de agora para os anteriores, de onde se volta a ela
      await api('/api/me/coelho', { method: 'PUT', body: { codigo: codigo(receita), pronto } });
      avisarQuartoMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  // o corpo de uma escolha: a combinação pedida, senão QUALQUER roupa pronta do mesmo tipo (a de fábrica primeiro), senão o
  // masculino do corpo base. Sem a roupa curta aqui, a forte feminina (só a de regata curta tem desenho) nunca era alcançada:
  // o "Tipo de corpo" aparecia no forte e caía de volta no masculino (relato dele, 10/11/2026).
  function corpoPronto(base: Base, tipo: Tipo, veste: Veste): Corpo {
    for (const c of [corpoDe(base, tipo, veste), corpoDe(base, tipo, 'padrao'), corpoDe(base, tipo, 'curta'), corpoDe(base, 'masculino', 'padrao')]) if (c && prontos.has(c)) return c;
    return base;
  }
  function sortear() {
    const r = (n: number) => Math.floor(Math.random() * n);
    const tecido = () => TECIDOS[r(TECIDOS.length)].cor;
    const cabeca = r(2) ? ('bone' as const) : null;
    const pescoco = r(2) ? ('bandana' as const) : null;
    const disponiveis = CORPOS.filter((c) => prontos.has(c));
    mexer({ corpo: disponiveis[r(disponiveis.length)] ?? 'mascote', pelo: PELOS[r(PELOS.length)].cor, roupa: tecido(), cabeca, cabecaCor: cabeca && tecido(), pescoco, pescocoCor: pescoco && tecido() });
  }

  const { base, tipo, veste } = partesDoCorpo(receita.corpo);
  const iBase = BASES.indexOf(base);
  const outroTipo: Tipo = tipo === 'masculino' ? 'feminino' : 'masculino';
  const temOutroTipo = [corpoDe(base, outroTipo, 'padrao'), corpoDe(base, outroTipo, 'curta')].some((c) => c && prontos.has(c));
  const outraVeste: Veste = veste === 'padrao' ? 'curta' : 'padrao';
  const temOutraVeste = !!corpoDe(base, tipo, outraVeste) && prontos.has(corpoDe(base, tipo, outraVeste)!);
  const rotuloDoCoelho = primeiraForma(t('Coelho'));
  const valorDoCoelho = personalizado
    ? t('Personalizado')
    : sugestao === 0
      ? t('Atual')
      : `${algarismos(sugestao)} / ${algarismos(SUGESTOES)}${sugestao === atualPronto && !atualFoto ? ` · ${t('Atual')}` : ''}`;
  const deFrente = dir.startsWith('south');

  // O AVATAR REDONDO DO CANTO: o que os outros vão ver nas listas com esta escolha
  const avatar =
    sugestao === 0 && !personalizado ? (
      avatarAtual
    ) : pronto !== null ? (
      <span className="avatar" style={{ width: 56, height: 56 }}>
        <img className="avatar-pronto" src={enderecoDoCoelhoPronto(pronto)} alt="" draggable={false} />
      </span>
    ) : (
      <span className="avatar" style={{ width: 56, height: 56 }}>
        <BustoDoCoelho receita={receita} estado={null} />
      </span>
    );

  return (
    <section className="personagem criador">
      <div className="criador-palco-e-giro">
        <div className="personagem-palco criador-palco">
          <PalcoDoCoelho receita={receita} dir={dir} escala={2} rotulo={t('Seu coelho. Clique para ele acenar.')} />
          <span className="criador-avatar" title={t('Como aparece nas listas e nas conversas')}>
            {avatar}
          </span>
        </div>
        <div className="criador-girar">
          <button type="button" className="personagem-seta" aria-label={t('Girar para a esquerda')} title={t('Girar para a esquerda')} onClick={() => setDir(DIRECOES[(DIRECOES.indexOf(dir) + 3) % 4])}>
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <span>{deFrente ? t('De frente') : t('De costas')}</span>
          <button type="button" className="personagem-seta" aria-label={t('Girar para a direita')} title={t('Girar para a direita')} onClick={() => setDir(DIRECOES[(DIRECOES.indexOf(dir) + 1) % 4])}>
            <RotateCw size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="personagem-linhas">
        <LinhaDoPersonagem rotulo={rotuloDoCoelho} valor={valorDoCoelho} anterior={() => trocarSugestao(-1)} proximo={() => trocarSugestao(1)} ocupado={salvando} />
        <LinhaDoPersonagem
          rotulo={t('Corpo')}
          valor={t(NOME_DA_BASE[base])}
          anterior={() => mexer({ corpo: corpoPronto(BASES[(iBase + BASES.length - 1) % BASES.length], tipo, veste) })}
          proximo={() => mexer({ corpo: corpoPronto(BASES[(iBase + 1) % BASES.length], tipo, veste) })}
        />
        {(temOutroTipo || tipo === 'feminino') && (
          <LinhaDoPersonagem
            rotulo={t('Tipo de corpo')}
            valor={t(NOME_DO_TIPO[tipo])}
            anterior={() => mexer({ corpo: corpoPronto(base, outroTipo, veste) })}
            proximo={() => mexer({ corpo: corpoPronto(base, outroTipo, veste) })}
          />
        )}
        {temOutraVeste && (
          <LinhaDoPersonagem
            rotulo={t('Roupa')}
            valor={t(nomeDaRoupa(receita.corpo))}
            anterior={() => mexer({ corpo: corpoPronto(base, tipo, outraVeste) })}
            proximo={() => mexer({ corpo: corpoPronto(base, tipo, outraVeste) })}
          />
        )}
        <Cores rotulo={t('Pelo')} lista={PELOS} valor={receita.pelo} mudar={(pelo) => mexer({ pelo })} />
        <Cores rotulo={`${t('Roupa')} · ${t(nomeDaRoupa(receita.corpo))}`} lista={TECIDOS} valor={receita.roupa} mudar={(roupa) => mexer({ roupa })} />
        <LinhaDoPersonagem
          rotulo={t('Cabeça')}
          valor={receita.cabeca ? t('Boné') : t('Nenhum')}
          anterior={() => mexer({ cabeca: receita.cabeca ? null : 'bone' })}
          proximo={() => mexer({ cabeca: receita.cabeca ? null : 'bone' })}
        />
        {receita.cabeca && <Cores rotulo={t('Boné')} lista={TECIDOS} valor={receita.cabecaCor} mudar={(cabecaCor) => mexer({ cabecaCor })} />}
        <LinhaDoPersonagem
          rotulo={t('Pescoço')}
          valor={receita.pescoco ? t('Bandana') : t('Nenhum')}
          anterior={() => mexer({ pescoco: receita.pescoco ? null : 'bandana' })}
          proximo={() => mexer({ pescoco: receita.pescoco ? null : 'bandana' })}
        />
        {receita.pescoco && <Cores rotulo={t('Bandana')} lista={TECIDOS} valor={receita.pescocoCor} mudar={(pescocoCor) => mexer({ pescocoCor })} />}

        <div className="criador-acoes">
          <button type="button" className="btn-secondary" onClick={sortear}>
            <Shuffle size={16} aria-hidden="true" /> {t('Sortear')}
          </button>
          {mudou && (
            <button type="button" className="btn-primary" disabled={salvando} aria-label={`${t('Salvar')}: ${rotuloDoCoelho}`} onClick={() => void salvar()}>
              {t('Salvar')}
            </button>
          )}
        </div>
        {erro && <p className="form-error">{erro}</p>}
        {aviso && (
          <p className="form-success" role="status">
            {aviso}
          </p>
        )}

        <CodigoDoCoelho
          receita={receita}
          usar={(r) => {
            mexer(r);
            setAviso(t('Coelho carregado do código.'));
          }}
          avisar={(texto, ruim) => {
            setErro(ruim ? texto : null);
            setAviso(ruim ? null : texto);
          }}
        />
        <MeusCoelhos
          receita={receita}
          usar={(r, nome) => {
            mexer(r);
            setAviso(t('"{nome}" carregado.', { nome }));
          }}
        />
      </div>
    </section>
  );
}

/** Uma linha de cores: a original, as amostras e a cor livre (o seletor do sistema, qualquer RGB). */
function Cores({ rotulo, lista, valor, mudar }: { rotulo: string; lista: { nome: string; cor: string }[]; valor: Cor; mudar: (c: Cor) => void }) {
  const t = useT();
  // ARRASTAR NO SELETOR DO SISTEMA (relato dele, 10/11/2026: "segurei para alterar a cor, ficou bem lento"): ele manda uma cor
  // a cada movimento do mouse, e cada uma remontava o coelho, o avatar do canto e a tela inteira. O quadradinho segue o mouse
  // na hora (o rascunho), e o coelho recebe no máximo uma cor a cada 120 ms, sempre a última.
  const [rascunho, setRascunho] = useState<string | null>(null);
  const espera = useRef<{ tempo: ReturnType<typeof setTimeout> | null; cor: string | null }>({ tempo: null, cor: null });
  useEffect(() => () => clearTimeout(espera.current.tempo ?? undefined), []);
  function arrastar(cor: string) {
    setRascunho(cor);
    espera.current.cor = cor;
    if (espera.current.tempo) return;
    espera.current.tempo = setTimeout(() => {
      espera.current.tempo = null;
      if (espera.current.cor) mudar(espera.current.cor);
    }, 120);
  }
  useEffect(() => setRascunho(null), [valor]);
  const mostrado = rascunho ?? valor;
  const livre = mostrado !== null && !lista.some((c) => c.cor === mostrado);
  return (
    <div className="criador-cores" role="group" aria-label={rotulo}>
      <small>{rotulo}</small>
      <div>
        <button type="button" className="criador-cor original" aria-pressed={valor === null} title={t('Original')} aria-label={t('Original')} onClick={() => mudar(null)} />
        {lista.map((c) => (
          <button
            key={c.cor}
            type="button"
            className="criador-cor"
            style={{ background: c.cor }}
            aria-pressed={valor === c.cor}
            title={t(c.nome)}
            aria-label={t(c.nome)}
            onClick={() => mudar(c.cor)}
          />
        ))}
        <label className="criador-cor livre" aria-pressed={livre} title={t('Escolher a cor')} style={livre ? { background: mostrado! } : undefined}>
          <input type="color" value={mostrado ?? '#ffffff'} aria-label={`${t('Escolher a cor')}: ${rotulo}`} onChange={(e) => arrastar(e.target.value.toLowerCase())} />
        </label>
      </div>
    </div>
  );
}

/** O código do coelho: copiar o deste, colar o de alguém. */
function CodigoDoCoelho({ receita, usar, avisar }: { receita: Receita; usar: (r: Receita) => void; avisar: (texto: string, ruim?: boolean) => void }) {
  const t = useT();
  const [colado, setColado] = useState('');
  const texto = codigo(receita);
  return (
    <details className="criador-codigo">
      <summary>{t('Código do coelho')}</summary>
      <div className="criador-linha-codigo">
        <input readOnly value={texto} aria-label={t('Código do coelho')} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              avisar(t('Código copiado.'));
            } catch {
              avisar(t('Selecione o código e copie com Ctrl+C.'));
            }
          }}
        >
          {t('Copiar')}
        </button>
      </div>
      <form
        className="criador-linha-codigo"
        onSubmit={(e) => {
          e.preventDefault();
          const r = lerCodigo(colado);
          if (!r) return avisar(t('Esse código não é de um coelho do Syden.'), true);
          usar(r);
          setColado('');
        }}
      >
        <input value={colado} placeholder={t('Cole um código aqui')} aria-label={t('Cole um código aqui')} onChange={(e) => setColado(e.target.value)} />
        <button className="btn-secondary" disabled={!colado.trim()}>
          {t('Usar')}
        </button>
      </form>
    </details>
  );
}

/** "MEUS COELHOS": receitas com nome, guardadas na conta (/api/me/coelhos-salvos), até 12. */
function MeusCoelhos({ receita, usar }: { receita: Receita; usar: (r: Receita, nome: string) => void }) {
  const t = useT();
  const [lista, setLista] = useState<{ nome: string; codigo: string }[] | null>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    void api<{ nome: string; codigo: string }[]>('/api/me/coelhos-salvos')
      .then(setLista)
      .catch(() => setLista([]));
  }, []);
  async function gravar(nova: { nome: string; codigo: string }[]) {
    setErro(null);
    try {
      setLista(await api<{ nome: string; codigo: string }[]>('/api/me/coelhos-salvos', { method: 'PUT', body: { lista: nova } }));
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  if (!lista) return null;
  return (
    <div className="criador-salvos">
      <small>{t('Meus coelhos')}</small>
      {lista.length > 0 && (
        <ul>
          {lista.map((c, i) => (
            <li key={c.nome}>
              <button type="button" className="criador-salvo" title={t('Usar este coelho')} onClick={() => lerCodigo(c.codigo) && usar(lerCodigo(c.codigo)!, c.nome)}>
                <span className="avatar" style={{ width: 28, height: 28 }}>
                  <BustoDoCoelho receita={lerCodigo(c.codigo) ?? RECEITA_DO_MASCOTE} estado={null} />
                </span>
                {c.nome}
              </button>
              <button type="button" className="icon-plain" title={t('Apagar')} aria-label={`${t('Apagar')}: ${c.nome}`} onClick={() => void gravar(lista.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="criador-linha-codigo"
        onSubmit={(e) => {
          e.preventDefault();
          const n = nome.trim() || `${primeiraForma(t('Coelho'))} ${algarismos(lista.length + 1)}`;
          void gravar([...lista.filter((c) => c.nome !== n), { nome: n, codigo: codigo(receita) }].slice(-12)).then(() => setNome(''));
        }}
      >
        <input value={nome} maxLength={24} placeholder={t('Nome deste coelho')} aria-label={t('Nome deste coelho')} onChange={(e) => setNome(e.target.value)} />
        <button className="btn-secondary">{t('Guardar')}</button>
      </form>
      {erro && <p className="form-error">{erro}</p>}
    </div>
  );
}
