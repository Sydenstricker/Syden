import * as THREE from 'three';

/**
 * O AMBIENTE DAS MESAS (06/11/2026, pedido dele: "uma textura para a mesa, para ficar mais aconchegante"): o feltro, a madeira
 * da borda, o fundo de sala desfocado e a luz quente de um pendente, TUDO POR CÓDIGO (canvas → textura, sem arquivo e sem
 * material de terceiro). Os desenhos (os canvas) ficam guardados para a próxima partida; as texturas são de cada cena e vão
 * embora com ela (`descartaveis`). Leve de propósito: nenhuma sombra a mais além da de sempre, que continua só com "Sombras"
 * ligado em Gráficos.
 */

/** Um gerador de números que não muda entre partidas (o mesmo feltro sempre). */
function sorteador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const desenhos = new Map<string, HTMLCanvasElement>();
function desenho(nome: string, w: number, h: number, pintar: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  let c = desenhos.get(nome);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    pintar(c.getContext('2d')!, w, h);
    desenhos.set(nome, c);
  }
  return c;
}

/** Ruído fino, pixel a pixel, em torno de `base` (0–255 por canal), somado à imagem que já está no canvas. */
function granular(c: CanvasRenderingContext2D, w: number, h: number, forca: number, semente: number) {
  const img = c.getImageData(0, 0, w, h);
  const r = sorteador(semente);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = (r() - 0.5) * forca;
    img.data[i] += d;
    img.data[i + 1] += d;
    img.data[i + 2] += d;
  }
  c.putImageData(img, 0, 0);
}

/** O feltro verde: o tom com manchinhas largas, as fibras curtas cruzadas e o grão. Repete sem emenda (as fibras dão a volta). */
function desenhoDoFeltro() {
  return desenho('feltro', 512, 512, (c, w, h) => {
    c.fillStyle = '#2b6a45';
    c.fillRect(0, 0, w, h);
    const r = sorteador(11);
    // manchas largas, para o verde não ser chapado
    for (let k = 0; k < 40; k++) {
      const x = r() * w;
      const y = r() * h;
      const raio = 40 + r() * 90;
      const g = c.createRadialGradient(x, y, 0, x, y, raio);
      const claro = r() < 0.5;
      g.addColorStop(0, claro ? 'rgba(120,190,140,0.07)' : 'rgba(10,40,20,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) c.fillRect(x - raio + dx, y - raio + dy, raio * 2, raio * 2);
    }
    // as fibras
    c.lineWidth = 1;
    for (let k = 0; k < 5200; k++) {
      const x = r() * w;
      const y = r() * h;
      const a = r() * Math.PI * 2;
      const l = 2 + r() * 5;
      c.strokeStyle = r() < 0.5 ? 'rgba(150,210,165,0.10)' : 'rgba(5,30,15,0.14)';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
    granular(c, w, h, 22, 12);
  });
}

/** A madeira da borda: veios compridos ondulando, num marrom de móvel antigo. */
function desenhoDaMadeira() {
  return desenho('madeira', 1024, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6e4527');
    g.addColorStop(0.5, '#7c5030');
    g.addColorStop(1, '#5e3a20');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = sorteador(21);
    for (let k = 0; k < 70; k++) {
      const y0 = r() * h;
      const amp = 1 + r() * 4;
      const freq = (1 + r() * 3) * ((Math.PI * 2) / w);
      const fase = r() * 6;
      c.strokeStyle = r() < 0.6 ? `rgba(40,20,8,${0.12 + r() * 0.2})` : `rgba(190,130,80,${0.06 + r() * 0.1})`;
      c.lineWidth = 0.6 + r() * 1.6;
      c.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + Math.sin(x * freq + fase) * amp + Math.sin(x * freq * 3.1 + fase) * amp * 0.3;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    granular(c, w, h, 14, 22);
  });
}

/** O fundo: a parede da sala, quente e escura, com as luzes de longe desfocadas (bokeh) e o canto escurecido. */
function desenhoDoFundo() {
  return desenho('fundo', 512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#24150d');
    g.addColorStop(0.55, '#3a2416');
    g.addColorStop(1, '#2a190f');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = sorteador(31);
    for (let k = 0; k < 22; k++) {
      const x = r() * w;
      const y = h * (0.1 + r() * 0.5);
      const raio = 10 + r() * 34;
      const b = c.createRadialGradient(x, y, 0, x, y, raio);
      b.addColorStop(0, `rgba(255,${180 + Math.floor(r() * 50)},110,${0.1 + r() * 0.14})`);
      b.addColorStop(0.7, 'rgba(255,190,120,0.03)');
      b.addColorStop(1, 'rgba(255,190,120,0)');
      c.fillStyle = b;
      c.fillRect(x - raio, y - raio, raio * 2, raio * 2);
    }
    const v = c.createRadialGradient(w / 2, h * 0.6, w * 0.15, w / 2, h * 0.6, w * 0.75);
    v.addColorStop(0, 'rgba(255,200,140,0.10)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  });
}

function textura(canvas: HTMLCanvasElement, descartaveis: { dispose(): void }[], repetir?: [number, number]) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetir[0], repetir[1]);
  }
  descartaveis.push(t);
  return t;
}

/** O fundo de sala aconchegante, desfocado, atrás da mesa. */
export function fundoAconchegante(cena: THREE.Scene, descartaveis: { dispose(): void }[]) {
  cena.background = textura(desenhoDoFundo(), descartaveis);
}

/**
 * A mesa de jogo: o tampo de feltro e a borda de madeira em volta, um pouco mais alta que o feltro (o "trilho" das mesas de
 * carteado). O feltro fica em cima em y = 0. Ele é empurrado para trás na profundidade (polygonOffset), para nunca disputar
 * o pixel com o que se deita nele (06/11/2026, relato dele: "a mesa está atravessando as cartas").
 */
export function mesaDeFeltro(cena: THREE.Scene, largura: number, fundo: number, sombras: boolean, descartaveis: { dispose(): void }[]) {
  const feltroTex = textura(desenhoDoFeltro(), descartaveis, [largura / 3.2, fundo / 3.2]);
  const feltroMat = new THREE.MeshStandardMaterial({
    map: feltroTex,
    bumpMap: feltroTex,
    bumpScale: 1.2,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const feltroGeo = new THREE.BoxGeometry(largura, 0.4, fundo);
  const feltro = new THREE.Mesh(feltroGeo, feltroMat);
  feltro.position.y = -0.2;
  feltro.receiveShadow = sombras;

  const madeiraTex = textura(desenhoDaMadeira(), descartaveis);
  const madeiraMat = new THREE.MeshStandardMaterial({ map: madeiraTex, bumpMap: madeiraTex, bumpScale: 0.8, roughness: 0.55, metalness: 0 });
  const largo = 0.42;
  const alto = 0.5;
  const topo = 0.07;
  const geoX = new THREE.BoxGeometry(largura + largo * 2, alto, largo);
  const geoZ = new THREE.BoxGeometry(largo, alto, fundo);
  const lados = [
    new THREE.Mesh(geoX, madeiraMat).translateZ(fundo / 2 + largo / 2),
    new THREE.Mesh(geoX, madeiraMat).translateZ(-fundo / 2 - largo / 2),
    new THREE.Mesh(geoZ, madeiraMat).translateX(largura / 2 + largo / 2),
    new THREE.Mesh(geoZ, madeiraMat).translateX(-largura / 2 - largo / 2),
  ];
  for (const l of lados) {
    l.position.y = topo - alto / 2;
    l.receiveShadow = sombras;
  }
  descartaveis.push(feltroGeo, feltroMat, madeiraMat, geoX, geoZ);
  cena.add(feltro, ...lados);
}

/** A madeira da mesa, para quem tem a mesa própria (as Damas, com o tabuleiro em cima de uma mesa redonda). */
export function materialDeMadeira(descartaveis: { dispose(): void }[], repetir: [number, number] = [1, 1]) {
  const t = textura(desenhoDaMadeira(), descartaveis, repetir);
  const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.8, roughness: 0.6 });
  descartaveis.push(m);
  return m;
}
