import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { api, loadToken } from './api';
import { MOLETOM_DO_MASCOTE } from './corrida/coresDosAvatares';
import { coresDoJogador, type AvatarDoJogo } from './coelho/cores';
import type { User } from './types';

/**
 * O COELHO 3D DOS JOGOS (05/11/2026): carregar, copiar e pintar o NOSSO coelho (cidades3d/coelho-animado.glb, de
 * e2e/pixel-art/personagem/blender/meshy/glb.py) num lugar só, para todo jogo 3D o mostrar igual.
 *
 * Por que ele parecia "uma massa sem textura" (relato dele, 05/11/2026): a textura CHEGAVA (o mapa, o sRGB e as UVs estão
 * certos; a do GLB é idêntica à do Meshy, conferido), mas ela é pintura LISA, em retalhos de cor chapada (lavanda no pelo,
 * quase preto, #1d0e1d, no moletom); o mapa de relevo do Meshy, que o glb.py deixa de fora, também é liso. Sem desenho na
 * textura, quem dá forma é a luz — e o moletom quase preto não mostra luz nenhuma: de costas, na câmera do jogo, era um
 * borrão preto com uma bola lilás em cima. O conserto é de desenho, não de carregamento:
 *  - A TROCA DE PALETA do Cidades (a do kart, no shader): o moletom vira a cor do avatar (ou a do mascote em 2D, um pouco
 *    mais clara que a da textura), e o pelo, a do avatar, as duas MULTIPLICADAS pela luminância da textura — o desenho
 *    (olhos, focinho, a parte de dentro das orelhas) fica, e a luz passa a aparecer no moletom.
 *  - Uma LUZ DE BORDA (fresnel) suave, que separa o coelho do fundo.
 *  - O CONTORNO de desenho animado (a malha de novo, por trás e inflada na TELA, ~1,5 px): o que faz um modelo de cor
 *    chapada ler como personagem, e não como massinha.
 */

export const URL_DO_COELHO = `${import.meta.env.BASE_URL}cidades3d/coelho-animado.glb`;
/**
 * O RELEVO do Meshy (as dobras e as costuras do moletom), reduzido a 1024 e à parte do GLB: o glb.py, ao exportar, fica só
 * com a cor. A pintura é a mesma do arquivo do Meshy (o mesmo desenho das UVs), então o mapa serve como está; sem ele, o
 * coelho só perde as dobras.
 */
const URL_DO_RELEVO = `${import.meta.env.BASE_URL}cidades3d/coelho-relevo.jpg`;

// As regiões da malha em T, no shader (de 0 a 8,4 de altura, a frente no +z; medidas no GLB): o rosto vai de 4,1 a 5,4 na
// frente (z > 1); acima de 5,4, as orelhas. Fora do rosto, o escuro é o moletom (o capuz incluído).

let carregando: Promise<GLTF> | null = null;
/** O GLB, uma vez por página (a geometria e a textura servem a todas as cópias). */
export function carregarCoelho(): Promise<GLTF> {
  if (!carregando) {
    carregando = Promise.all([
      new GLTFLoader().loadAsync(URL_DO_COELHO),
      new THREE.TextureLoader().loadAsync(URL_DO_RELEVO).catch(() => null),
    ]).then(([g, relevo]) => {
      if (relevo) {
        relevo.flipY = false;
        relevo.colorSpace = THREE.NoColorSpace;
        g.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (!(o as THREE.Mesh).isMesh || !m || m.normalMap) return;
          m.normalMap = relevo;
          // sem tangentes no GLB, o three.js tira a direção das derivadas, e o verde do glTF fica invertido
          m.normalScale.set(1, -1);
          m.needsUpdate = true;
        });
      }
      return g;
    });
    carregando.catch(() => (carregando = null));
  }
  return carregando;
}

/** As cores de um coelho: `pelo` null deixa o pelo da textura (o mascote). */
export interface CoresDoCoelho {
  pelo: string | null;
  roupa: string;
}

const hex = ([r, g, b]: [number, number, number]) => `rgb(${r},${g},${b})`;
/** O mascote como é: o pelo da textura, o moletom do mascote em 2D. */
export const CORES_DO_MASCOTE: CoresDoCoelho = { pelo: null, roupa: hex(MOLETOM_DO_MASCOTE[0]) };

/** As cores do avatar pronto (as do kart); sem avatar pronto, o mascote. */
export function coresDoAvatar(avatar: number | string | null | undefined): CoresDoCoelho {
  const a = coresDoJogador(avatar);
  return a ? { pelo: hex(a.pelo), roupa: hex(a.roupa) } : CORES_DO_MASCOTE;
}

let minhas: Promise<CoresDoCoelho> | null = null;
/** As cores do MEU coelho, pelo avatar pronto da conta (uma pergunta por página; sem resposta, o mascote). */
export function minhasCoresDoCoelho(): Promise<CoresDoCoelho> {
  // só no site de desenvolvimento: as fotos de conferência escolhem um avatar (window.coelhoAvatarDoTeste)
  const teste = import.meta.env.DEV ? (window as { coelhoAvatarDoTeste?: number }).coelhoAvatarDoTeste : undefined;
  if (teste !== undefined) return Promise.resolve(coresDoAvatar(teste));
  // sem sessão (as páginas de conferência), nem pergunta
  if (!loadToken()) return Promise.resolve(CORES_DO_MASCOTE);
  if (!minhas)
    minhas = api<User>('/api/me').then(
      (u) => coresDoAvatar(u.coelho ?? u.avatarPronto),
      () => {
        minhas = null;
        return CORES_DO_MASCOTE;
      },
    );
  return minhas;
}

export interface MaterialDoCoelho {
  m: THREE.MeshStandardMaterial;
  uPelo: { value: THREE.Color };
  uTrocaPelo: { value: number };
  uRoupa: { value: THREE.Color };
  uOpaco: { value: number };
  /** Troca as cores na hora (os uniforms; o shader é o mesmo). */
  pintar(cores: CoresDoCoelho): void;
}

let ambiente: THREE.Texture | null = null;
/**
 * A LUZ DE AMBIENTE DO COELHO (05/11/2026, relato dele: "o minigolfe usa o coelho sem textura; a animação que baixei tem
 * textura"). O arquivo do Meshy é o MESMO modelo, com a mesma pintura: o que o visualizador dele tem e os nossos jogos não
 * tinham é luz de AMBIENTE (o reflexo do lugar em volta, em todas as direções). Só com o sol e o céu chapado, o pelo ficava
 * cinza e o moletom um borrão; com ela, o volume e as dobras aparecem (conferido lado a lado). É um céu pequeno pintado por
 * código (claro em cima, o horizonte quente, o chão esverdeado e duas manchas de luz), posto SÓ no material do coelho: as
 * peças dos jogos continuam com a luz delas. O three.js transforma a imagem no reflexo sozinho, uma vez.
 */
function ambienteDoCoelho(): THREE.Texture {
  if (ambiente) return ambiente;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const fundo = g.createLinearGradient(0, 0, 0, 128);
  fundo.addColorStop(0, '#f4f1ff');
  fundo.addColorStop(0.45, '#fff4e4');
  fundo.addColorStop(0.55, '#c9c2b0');
  fundo.addColorStop(1, '#6f8a62');
  g.fillStyle = fundo;
  g.fillRect(0, 0, 256, 128);
  for (const [x, y, r, a] of [
    [70, 30, 34, 0.95],
    [190, 40, 46, 0.6],
  ] as const) {
    const l = g.createRadialGradient(x, y, 0, x, y, r);
    l.addColorStop(0, `rgba(255,255,255,${a})`);
    l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l;
    g.fillRect(0, 0, 256, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  ambiente = t;
  return t;
}

/**
 * O material do coelho: a textura do GLB com a troca de paleta (o escuro do corpo é o moletom; o claro e pouco saturado, o
 * pelo), MULTIPLICANDO a luminância da textura, mais a luz de borda. `uOpaco` deixa o coelho meio transparente (quem saiu).
 */
export function materialDoCoelho(base: THREE.MeshStandardMaterial, cores: CoresDoCoelho = CORES_DO_MASCOTE): MaterialDoCoelho {
  const m = base.clone();
  // Na luz em degraus o relevo (as dobras do moletom) quebraria cada faixa em manchas: os degraus saem da forma do corpo,
  // como no render da Briga.
  m.normalMap = null;
  // e sem o reflexo do sol (a mancha branca no alto da cabeça, que nos degraus vira uma tampa): só a cor e a luz
  m.roughness = 1;
  m.metalness = 0;
  const uPelo = { value: new THREE.Color(cores.pelo ?? '#ffffff') };
  const uTrocaPelo = { value: cores.pelo ? 1 : 0 };
  const uRoupa = { value: new THREE.Color(cores.roupa) };
  const uOpaco = { value: 1 };
  const uBorda = { value: new THREE.Color('#fff4e6').multiplyScalar(0.28) };
  m.transparent = true;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uPelo, uTrocaPelo, uRoupa, uOpaco, uBorda });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMalha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMalha = position;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vMalha;\nuniform vec3 uPelo;\nuniform float uTrocaPelo;\nuniform vec3 uRoupa;\nuniform float uOpaco;\nuniform vec3 uBorda;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 cor = diffuseColor.rgb;
          float l = dot(cor, vec3(0.3, 0.59, 0.11));
          float sat = max(cor.r, max(cor.g, cor.b)) - min(cor.r, min(cor.g, cor.b));
          float y = vMalha.y;
          // o rosto (olhos, focinho, boca): a frente da cabeça, entre o pescoço e as orelhas; lá o escuro é desenho e fica
          bool rosto = y > 4.1 && y < 5.4 && vMalha.z > 1.0;
          vec3 pelo = uTrocaPelo > 0.5 ? uPelo * clamp(l / 0.62, 0.6, 1.15) : cor;
          // o rosado (a parte de dentro das orelhas, o nariz, as mãos e os pés) fica como a textura pintou
          bool rosa = cor.r > cor.b * 1.25 && l > 0.05;
          if (sat < 0.3 && !rosa) {
            if (rosto) {
              if (l > 0.28) diffuseColor.rgb = pelo;
            } else if (y > 5.4) {
              // as orelhas: só pelo (os riscos escuros da textura nelas são borda de retalho, não desenho)
              diffuseColor.rgb = uTrocaPelo > 0.5 ? uPelo * clamp(max(l, 0.4) / 0.62, 0.6, 1.15) : cor;
            } else {
              // o corpo e o capuz: do escuro (o moletom) ao claro (o pelo), sem degrau — as bordas dos retalhos, que a
              // textura mistura, não viram manchas pretas no moletom colorido
              vec3 roupa = uRoupa * (0.8 + 2.5 * l);
              diffuseColor.rgb = mix(roupa, pelo, smoothstep(0.05, 0.26, l));
            }
          }
          diffuseColor.a *= uOpaco;
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          // A LUZ EM DEGRAUS, como a do coelho da Briga (o render do Blender: 3 degraus que só multiplicam a cor; pedido dele,
          // 06/11/2026: "o da briga tem textura, o do skate não"). A luz da cena (o sol, o céu, a noite do quarto) continua
          // decidindo QUANTO chega; aqui só se arredonda isso a degraus de ~1,41× (um passo a cada meio log2), e a luz lisa,
          // que numa pintura de cor chapada vira massa, passa a desenhar a forma em faixas.
          float lCor = max(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), 1e-3);
          float lLuz = max(dot(outgoingLight, vec3(0.3, 0.59, 0.11)), 1e-4);
          float chega = lLuz / lCor;
          // PARA BAIXO, nunca para o mais perto: arredondar para cima levava o coelho do sol forte (o Rolê) a 1,4× ou 2× a luz, e
          // a cor clara do avatar estourava em branco (relato dele, 06/11/2026: "o coelho ainda está branco, sem textura").
          float degrau = exp2(floor(log2(chega) * 2.0) / 2.0);
          outgoingLight *= degrau / chega;
        }
        {
          float borda = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
          outgoingLight += uBorda * pow(borda, 2.5);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'coelho3d-paleta-degraus';
  if (typeof document !== 'undefined') {
    m.envMap = ambienteDoCoelho();
    m.envMapIntensity = 1;
  }
  const pintar = (c: CoresDoCoelho) => {
    uTrocaPelo.value = c.pelo ? 1 : 0;
    if (c.pelo) uPelo.value.set(c.pelo);
    uRoupa.value.set(c.roupa);
  };
  return { m, uPelo, uTrocaPelo, uRoupa, uOpaco, pintar };
}

/** A espessura do contorno, em pixels da tela (vezes a densidade de pixels). */
const CONTORNO_PX = 2;
const tamanhoDaTela = new THREE.Vector2(1, 1);

/** O material do contorno: a malha por trás, inflada pela normal NA TELA (a espessura não muda com a distância). */
function materialDoContorno(uOpaco: { value: number }): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: '#2a1d26', side: THREE.BackSide, transparent: true });
  const uTela = { value: tamanhoDaTela };
  const uPx = { value: CONTORNO_PX };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uTela, uPx, uOpaco });
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uTela;\nuniform float uPx;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        #ifdef USE_SKINNING
          vec3 nv = transformedNormal;
        #else
          vec3 nv = normalMatrix * normal;
        #endif
        // A malha do contorno é desenhada pelo avesso (BackSide), e aí o three.js VIRA a normal (FLIP_SIDED): sem desvirar, o
        // contorno encolhia para dentro do corpo e nunca aparecia no coelho animado (achado em 06/11/2026).
        #ifdef FLIP_SIDED
          #ifdef USE_SKINNING
            nv = -nv;
          #endif
        #endif
        vec2 d = (projectionMatrix * vec4(nv, 0.0)).xy;
        float n = length(d);
        if (n > 1e-5) gl_Position.xy += (d / n) * uPx * 2.0 * gl_Position.w / uTela;
        // um tico para trás na profundidade: nas dobras do corpo (o vão do braço, o capuz) a malha inflada passava na frente e
        // desenhava riscos pretos por dentro; empurrada, ela só aparece na silhueta
        gl_Position.z += 0.004 * gl_Position.w;
      }`,
    );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uOpaco;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= uOpaco;\noutgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'coelho3d-contorno';
  return m;
}

export interface CoelhoCopiado {
  /** O corpo já em escala, com o pé no y = 0 (o grupo a pôr na cena). */
  corpo: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  acoes: Map<string, THREE.AnimationAction>;
  material: MaterialDoCoelho;
  /** Devolve o que é só desta cópia (os materiais; a geometria e a textura são do GLB, que fica no cache). */
  descartar(): void;
}

/**
 * Uma cópia do coelho com o esqueleto junto (SkeletonUtils), na `altura` pedida, com o material de paleta e o contorno.
 * `contorno: false` para quem não quer (no mapa de longe, por exemplo).
 */
export function copiarCoelho(
  g: GLTF,
  { altura, sombras = false, cores = CORES_DO_MASCOTE, contorno = true }: { altura: number; sombras?: boolean; cores?: CoresDoCoelho; contorno?: boolean },
): CoelhoCopiado {
  const corpo = SkeletonUtils.clone(g.scene);
  const caixa = new THREE.Box3().setFromObject(corpo);
  const k = altura / (caixa.max.y - caixa.min.y);
  corpo.scale.setScalar(k);
  corpo.position.y = -caixa.min.y * k;
  let base: THREE.MeshStandardMaterial | null = null;
  const malhas: THREE.Mesh[] = [];
  corpo.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      malhas.push(m);
      if (!base) base = m.material as THREE.MeshStandardMaterial;
    }
  });
  const material = materialDoCoelho(base ?? new THREE.MeshStandardMaterial(), cores);
  const doContorno = contorno ? materialDoContorno(material.uOpaco) : null;
  for (const m of malhas) {
    m.material = material.m;
    m.castShadow = sombras;
    m.frustumCulled = false;
    if (doContorno && m.parent) {
      const s = m as THREE.SkinnedMesh;
      let c: THREE.Mesh;
      if (s.isSkinnedMesh) {
        const pele = new THREE.SkinnedMesh(s.geometry, doContorno);
        pele.bind(s.skeleton, s.bindMatrix);
        c = pele;
      } else c = new THREE.Mesh(m.geometry, doContorno);
      c.position.copy(m.position);
      c.quaternion.copy(m.quaternion);
      c.scale.copy(m.scale);
      c.frustumCulled = false;
      c.renderOrder = m.renderOrder - 1;
      c.userData.contornoDoCoelho = true;
      c.onBeforeRender = (r) => r.getDrawingBufferSize(tamanhoDaTela);
      m.parent.add(c);
    }
  }
  const mixer = new THREE.AnimationMixer(corpo);
  const acoes = new Map(g.animations.map((a) => [a.name, mixer.clipAction(a)]));
  return {
    corpo,
    mixer,
    acoes,
    material,
    descartar() {
      mixer.stopAllAction();
      material.m.dispose();
      doContorno?.dispose();
    },
  };
}
