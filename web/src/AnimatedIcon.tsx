import { AlarmClock, CircleUser, Mic, Monitor, Music, PersonStanding, Smile, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from './settings';

// Ícones animados (formato Lottie, os que o usuário baixou na pasta IconesAnimados) para os botões de
// destaque: parados eles são um desenho comum, e ao passar o mouse ou clicar fazem a animação curta que
// vem dentro do próprio arquivo, como no Discord.
//
// Duas decisões que valem explicação:
// - A biblioteca que toca esses arquivos pesa uns 70 KB, então ela só é baixada quando o primeiro ícone
//   animado aparece na tela — quem nunca chega perto desses botões não paga por isso.
// - As cores vêm gravadas no arquivo (o desenho tem um azul quase preto que sumiria no fundo escuro do
//   Syden), então elas são trocadas na hora de carregar: a cor mais escura vira a cor do texto e a outra
//   vira o destaque do app.

export type AnimatedIconName = 'tela' | 'emoji' | 'musica' | 'microfone' | 'avatar' | 'alarme' | 'pessoa' | 'chamada';

/**
 * O MESMO ÍCONE, DESENHADO EM TRAÇO, PARA QUANDO A ANIMAÇÃO NÃO VIER.
 *
 * ISTO EXISTE POR CAUSA DE UMA TELA EM BRANCO QUE NINGUÉM CONSEGUIU EXPLICAR. No menu de
 * Configurações, cinco itens apareceram sem ícone nenhum — e eram exatamente os cinco animados; os de
 * traço estavam lá. A causa nunca foi reproduzida: o arquivo é o mesmo em produção (conferido por
 * md5), a política de segurança libera a busca, e o menu desenha certo tanto no servidor de
 * desenvolvimento quanto na build de produção, medido nos dois.
 *
 * O que dava para explicar era o SINTOMA. Qualquer falha aqui dentro caía num \`catch\` vazio, e o CSS
 * deixa \`opacity: 0\` até a animação ficar pronta — então qualquer tropeço, em qualquer navegador,
 * vira um buraco de vinte pixels. Um desenho que depende de buscar um arquivo, carregar uma
 * biblioteca de 70 KB e interpretar um formato tem muito por onde falhar, e nenhuma dessas falhas
 * justifica um menu sem ícone.
 *
 * Então o traço é desenhado PRIMEIRO, sempre, e some quando a animação assume. Se ela não assumir, em
 * que computador for e pelo motivo que for, o menu continua inteiro.
 */
const DE_TRACO: Record<AnimatedIconName, typeof Mic> = {
  tela: Monitor,
  emoji: Smile,
  musica: Music,
  microfone: Mic,
  avatar: CircleUser,
  alarme: AlarmClock,
  pessoa: PersonStanding,
  chamada: Video,
};

/*
 * A VERSÃO LEVE, SEM EXPRESSÕES — E ELA É O CONSERTO DOS ÍCONES INVISÍVEIS, QUE VOLTARAM TRÊS VEZES.
 *
 * Estes arquivos pintam as formas com EXPRESSÕES (o "primary"/"secondary" da camada de controle), e o
 * lottie-web completo executa expressão com `eval`. A política de segurança do site, que mora na
 * Cloudflare, diz `script-src 'self'` sem `unsafe-eval` — e deve dizer. Resultado: em produção as
 * expressões morriam caladas, cada ícone desenhava só uma ou duas das suas formas, e o menu ficava
 * com cinco buracos. No servidor de desenvolvimento não há essa política, e por isso nunca se
 * reproduzia aqui: medido com a política aplicada na build, os cinco somem; sem ela, aparecem.
 *
 * A versão leve ignora as expressões e usa o valor parado de cada propriedade, que é justamente o que
 * `recolor` reescreve. Ela também é menor. A saída errada seria liberar `unsafe-eval` no site inteiro
 * para enfeitar cinco ícones de menu.
 */
type Lottie = typeof import('lottie-web/build/player/lottie_light').default;

let lottiePromise: Promise<Lottie> | null = null;
const cache = new Map<AnimatedIconName, unknown>();

function loadLottie(): Promise<Lottie> {
  lottiePromise ??= import('lottie-web/build/player/lottie_light').then((mod) => mod.default);
  return lottiePromise;
}

async function loadIcon(name: AnimatedIconName): Promise<unknown> {
  const cached = cache.get(name);
  if (cached) return structuredClone(cached);
  const data = await fetch(`${import.meta.env.BASE_URL}icones/${name}.json`).then((r) => r.json());
  cache.set(name, data);
  return structuredClone(data);
}

const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Lê um "#rrggbb" no formato que o Lottie usa (três números de 0 a 1). */
function toLottieColor(hex: string): number[] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}

/**
 * Troca as cores do desenho.
 *
 * Estes ícones trazem uma camada de controle com efeitos de cor chamados "primary" e "secondary"; as
 * formas puxam a cor de lá. Então é o valor desses efeitos que muda — mexer no preenchimento de cada
 * forma não adiantaria, porque a expressão sobrescreveria na hora de desenhar.
 *
 * Depois disso, o que tiver ficado escuro demais no desenho (traço preto do estilo "doodle", por exemplo)
 * também recebe a cor do ícone, senão sumiria no fundo escuro do Syden. Cores vivas ficam como estão.
 */
function recolor(animation: unknown, primary: string, secondary: string) {
  const walk = (node: unknown, visit: (node: Record<string, unknown>) => void) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    visit(node as Record<string, unknown>);
    for (const value of Object.values(node as Record<string, unknown>)) walk(value, visit);
  };

  // 1) Os controles de cor da camada de controle, que é de onde a maioria dos desenhos puxa a sua cor.
  walk(animation, (node) => {
    const efeitos = node.ef as { nm?: string; ef?: { ty?: number; v?: { k?: unknown } }[] }[] | undefined;
    if (!Array.isArray(efeitos)) return;
    for (const efeito of efeitos) {
      const alvo = String(efeito.nm ?? '').toLowerCase();
      const valor = efeito.ef?.find((item) => item.ty === 2)?.v;
      if (!valor || !Array.isArray(valor.k)) continue;
      valor.k = toLottieColor(alvo.includes('secondary') ? secondary : primary);
    }
  });

  // 2) O que ficou preto no desenho (os traços do estilo "doodle", por exemplo) sumiria no fundo escuro
  //    do Syden: essas partes ganham a cor do ícone. As cores vivas ficam como estão.
  const clara = toLottieColor(primary);
  const escuro = (color: number[]) => luminance(color.slice(0, 3)) < 0.35;
  walk(animation, (node) => {
    const shape = node as { ty?: string; c?: { k?: unknown } };
    if ((shape.ty !== 'fl' && shape.ty !== 'st') || !shape.c) return;
    const cor = shape.c;
    if (Array.isArray(cor.k) && typeof cor.k[0] === 'number') {
      const atual = cor.k as number[];
      if (escuro(atual)) cor.k = [...clara, atual[3] ?? 1];
    } else if (Array.isArray(cor.k)) {
      for (const quadro of cor.k as { s?: number[] }[]) {
        if (Array.isArray(quadro.s) && escuro(quadro.s)) quadro.s = [...clara, quadro.s[3] ?? 1];
      }
    }
  });
}

/** Lê uma cor do tema atual (as variáveis do CSS), para o desenho combinar com o resto da tela. */
function themeColor(variable: string, fallback: string): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : fallback;
}

/**
 * Há desenho visível aí dentro? Soma a área das formas, descontando as que estão transparentes — inclusive
 * por causa de um grupo acima delas, que é como o Lottie some com o desenho entre uma cena e outra.
 */
function temDesenho(box: HTMLElement | null): boolean {
  if (!box) return false;
  let area = 0;
  for (const el of box.querySelectorAll('path, rect, circle, ellipse')) {
    let opacidade = 1;
    for (let atual: Element | null = el; atual && atual !== box; atual = atual.parentElement) {
      opacidade *= Number(getComputedStyle(atual).opacity || 1);
    }
    if (opacidade < 0.05) continue;
    try {
      const caixa = (el as SVGGraphicsElement).getBBox();
      area += caixa.width * caixa.height;
    } catch {
      // Forma ainda não medível: ignora.
    }
  }
  return area > 1000;
}

interface Props {
  name: AnimatedIconName;
  size?: number;
  /** Cor da parte principal do desenho; por padrão, a cor do texto do tema. O detalhe usa `accent`. */
  color?: string;
  accent?: string;
  /**
   * Ritmo da animação: 1 é o que vem no arquivo, menos que isso deixa o movimento mais calmo. Alguns
   * desenhos (o despertador, por exemplo) sacodem demais no ritmo original para um menu.
   */
  speed?: number;
  className?: string;
}

export function AnimatedIcon({ name, size = 22, color, accent, speed = 1, className }: Props) {
  // O tema entra como dependência: trocando de claro para escuro, o desenho é remontado na cor certa.
  const { theme } = useSettings();
  const box = useRef<HTMLSpanElement>(null);
  const player = useRef<{
    playSegments: (s: number[], f: boolean) => void;
    destroy: () => void;
    goToAndStop: (v: number, f?: boolean) => void;
    setSpeed: (s: number) => void;
  } | null>(null);
  const segment = useRef<[number, number] | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    (async () => {
      try {
        const [lottie, data] = await Promise.all([loadLottie(), loadIcon(name)]);
        if (cancelled || !box.current) return;
        recolor(data, color ?? themeColor('--text', '#dbdee1'), accent ?? themeColor('--accent', '#5865f2'));

        // O arquivo traz marcadores: "hover-pinch" é a animação de reagir ao toque, e "in-reveal" é a de
        // entrada, que termina com o desenho inteiro na tela.
        const marcadores = (data as { markers?: { cm: string; tm: number; dr: number }[] }).markers ?? [];
        const marcador = marcadores.find((m) => m.cm.includes('hover-pinch')) ?? marcadores.at(-1);
        const entrada = marcadores.find((m) => m.cm.includes('in-reveal'));
        segment.current = marcador ? [marcador.tm, marcador.tm + marcador.dr] : null;
        const candidatos = [
          entrada ? entrada.tm + entrada.dr - 1 : null,
          marcador ? marcador.tm : 0,
          marcador ? marcador.tm + marcador.dr - 1 : null,
          marcador ? Math.round(marcador.tm + marcador.dr / 2) : null,
        ].filter((quadro): quadro is number => quadro !== null);

        const anim = lottie.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: data as object,
        });
        instance = anim;
        player.current = anim as unknown as typeof player.current;
        anim.setSpeed(speed);
        // Fica no primeiro quadro em que o desenho realmente aparece.
        let desenhou = false;
        for (const quadro of candidatos) {
          anim.goToAndStop(quadro, true);
          if (temDesenho(box.current)) {
            desenhou = true;
            break;
          }
        }

        // ESTE `if` ERA UM `setReady(true)` SOLTO, E ESSE ERA O BURACO QUE SOBROU.
        //
        // A ideia do traço por baixo é: ele só some quando a animação ASSUME. Mas o `setReady` vinha
        // depois do laço sem olhar o resultado dele — então, quando nenhum dos quatro quadros
        // candidatos tinha desenho, o traço era removido e no lugar não entrava nada. É exatamente o
        // buraco de vinte pixels do relato, e explica por que ele voltou mesmo com a reserva no lugar:
        // a reserva existia e era desligada pela própria falha que deveria cobrir.
        //
        // Agora, sem desenho, a animação é jogada fora e o traço FICA. Pior do que um menu sem
        // animação é um menu sem ícone.
        if (desenhou) setReady(true);
        else {
          console.warn(`[syden] o ícone animado "${name}" carregou mas não desenhou em nenhum quadro; ficou o de traço.`);
          anim.destroy();
          instance = null;
          player.current = null;
        }
      } catch (erro) {
        // Sem a biblioteca ou sem o arquivo: fica o ícone de traço, e o botão continua funcionando.
        //
        // O AVISO NO CONSOLE NÃO É ENFEITE. Antes daqui havia um `catch` vazio, e por isso a falha
        // que tirou os ícones do menu de Configurações de um dos computadores não deixou rastro
        // nenhum — nem para quem viu, nem para quem foi procurar. Falha silenciosa não se conserta.
        console.warn(`[syden] o ícone animado "${name}" não carregou; ficou o de traço.`, erro);
      }
    })();

    return () => {
      cancelled = true;
      instance?.destroy();
      player.current = null;
    };
  }, [name, color, accent, speed, theme]);

  /**
   * Quem dispara a animação é a linha inteira (o botão ou a etiqueta em volta), não só o desenho: passar
   * o mouse no texto "Voz e vídeo" tem que mexer o microfone do lado.
   */
  useEffect(() => {
    if (!ready || !box.current) return;
    const alvo = box.current.closest('button, label, a') ?? box.current;

    const play = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const anim = player.current;
      if (!anim || !segment.current) return;
      anim.playSegments(segment.current, true);
    };

    alvo.addEventListener('mouseenter', play);
    alvo.addEventListener('click', play);
    return () => {
      alvo.removeEventListener('mouseenter', play);
      alvo.removeEventListener('click', play);
    };
  }, [ready]);

  const Traco = DE_TRACO[name];

  return (
    <span className={`animated-icon-caixa${className ? ` ${className}` : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      {/* O traço fica por baixo e some quando a animação assume. Os dois ocupam a mesma casa, para a
          troca não mexer uma linha do menu de lugar. */}
      {!ready && <Traco size={size} />}
      <span ref={box} className={`animated-icon${ready ? ' ready' : ''}`} style={{ width: size, height: size }} />
    </span>
  );
}
