import * as THREE from 'three';

/**
 * OS CÉUS DA KENNEY (20/11/2026, da pesquisa de assets livres): os pacotes Skyboxes e Skyboxes Space (CC0, as licenças em
 * `web/public/ceus/`), cada céu uma imagem equirretangular reduzida de 4096 × 2048 para 2048 × 1024 em JPEG (~40 KB).
 *
 * A CÚPULA é um céu infinito: o vértice sai na profundidade máxima, então não depende do raio nem do `far` da câmera, e não
 * precisa seguir a câmera. Ela mistura dois céus (a Rota Estelar passa do planeta ao espaço) e, abaixo do horizonte, vira a
 * COR DO CHÃO, que cada jogo põe igual à névoa: o chão ao longe some na névoa, e a névoa encosta no céu sem emenda.
 *
 * Carrega só quando o jogo pede (`carregarCeu`), uma vez por página. Até chegar, ou se não chegar, o jogo continua com o céu
 * dele de sempre: quem chama troca o céu só com a textura na mão.
 */

const BASE = `${import.meta.env.BASE_URL}ceus/`;

/** Os céus que estão em `web/public/ceus/`, a cor média da linha do horizonte de cada um (medida na imagem reduzida) e o u do sol (ou da galáxia) na imagem. */
export const CEUS = {
  dia: { arquivo: 'skybox-day.jpg', horizonte: '#b3c7f2', sol: 0.916 },
  alienigena: { arquivo: 'skybox-alien.jpg', horizonte: '#d9c7e9', sol: 0.916 },
  galaxia: { arquivo: 'skybox-space-galaxy.jpg', horizonte: '#343975', sol: 0.5 },
} as const;
export type Ceu = keyof typeof CEUS;

const carregados = new Map<Ceu, Promise<THREE.Texture>>();

/** A textura de um céu. A promessa fica guardada (a mesma textura serve a todas as partidas); falhou, tenta de novo da próxima. */
export function carregarCeu(ceu: Ceu): Promise<THREE.Texture> {
  let p = carregados.get(ceu);
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(BASE + CEUS[ceu].arquivo).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      // sem mipmap: o céu está sempre AMPLIADO na tela, e o mipmap faria um risco na emenda do atan (a derivada salta ali)
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    });
    carregados.set(ceu, p);
    p.catch(() => carregados.delete(ceu));
  }
  return p;
}

/**
 * O giro (em voltas) que leva o ponto `u` da imagem (0 a 1, da esquerda para a direita) para a direção (x, z) do mundo.
 * Serve para pôr o sol da imagem do lado da luz da cena, ou a galáxia na frente de quem voa.
 */
export function giroPara(u: number, x: number, z: number): number {
  return u - (Math.atan2(z, x) / (Math.PI * 2) + 0.5);
}

export interface CupulaDoCeu {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  /** 0 = só o primeiro céu, 1 = só o segundo. */
  misturar(t: number): void;
  /** A cor abaixo do horizonte (a mesma da névoa). */
  chao: THREE.Color;
}

/** Monta a cúpula com um ou dois céus. `giro` em voltas (ver `giroPara`). */
export function cupulaDoCeu(a: THREE.Texture, b: THREE.Texture | null, giroA: number, giroB: number, chao: THREE.ColorRepresentation): CupulaDoCeu {
  const corDoChao = new THREE.Color(chao);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uA: { value: a },
      uB: { value: b ?? a },
      uGiroA: { value: giroA },
      uGiroB: { value: giroB },
      uMistura: { value: 0 },
      uChao: { value: corDoChao },
    },
    vertexShader: `varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `uniform sampler2D uA; uniform sampler2D uB; uniform float uGiroA; uniform float uGiroB; uniform float uMistura;
      uniform vec3 uChao; varying vec3 vDir;
      const float PI = 3.141592653589793;
      void main() {
        vec3 d = normalize(vDir);
        float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
        float v = 0.5 + asin(clamp(d.y, -1.0, 1.0)) / PI;
        vec3 c = texture2D(uA, vec2(u + uGiroA, v)).rgb;
        if (uMistura > 0.0) c = mix(c, texture2D(uB, vec2(u + uGiroB, v)).rgb, uMistura);
        // abaixo do horizonte, o chão (a cor da névoa); no espaço (o segundo céu inteiro) não há chão
        c = mix(c, uChao, smoothstep(0.015, -0.06, d.y) * (1.0 - uMistura));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return {
    mesh,
    material,
    chao: corDoChao,
    misturar(t) {
      material.uniforms.uMistura.value = Math.max(0, Math.min(1, t));
    },
  };
}
