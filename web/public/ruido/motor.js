// Um interpretador mínimo de ONNX, em JavaScript puro, para o GTCRN (o modelo de supressão de ruído).
//
// POR QUE ESCRITO À MÃO, e não o onnxruntime-web: todo motor de rede neural para navegador roda em
// WebAssembly, e WebAssembly só roda com 'wasm-unsafe-eval' na política de segurança do site — uma
// permissão que o Syden decidiu não dar (decisão do Sydenstricker, 04/10/2026). JavaScript comum não
// precisa de permissão nenhuma. O GTCRN cabe nisso porque é pequeno: 48 mil pesos, 24 tipos de operação.
//
// FEITO PARA A THREAD DE ÁUDIO: toda memória é reservada uma vez, na criação. Rodar um quadro não cria
// objeto nenhum, então o coletor de lixo nunca para o áudio no meio de uma frase.
//
// As formas são todas fixas (o grafo foi exportado com elas, ver scripts/ruido/exportar-gtcrn.py), e
// por isso cada operação calcula seus índices uma vez só, na montagem, e não a cada quadro.

const tamanho = (forma) => forma.reduce((a, b) => a * b, 1);
const passos = (forma) => {
  const p = new Array(forma.length);
  let s = 1;
  for (let i = forma.length - 1; i >= 0; i--) { p[i] = s; s *= forma[i]; }
  return p;
};
const eixo = (a, n) => (a < 0 ? a + n : a);

/** Mapa de índices de broadcasting: para cada posição da saída, a posição correspondente na entrada. */
function mapaBroadcast(formaEnt, formaSai) {
  const n = formaSai.length;
  const ent = new Array(n - formaEnt.length).fill(1).concat(formaEnt);
  const pe = passos(ent), ps = passos(formaSai);
  const total = tamanho(formaSai);
  const mapa = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    let resto = i, j = 0;
    for (let d = 0; d < n; d++) {
      const c = Math.floor(resto / ps[d]);
      resto -= c * ps[d];
      if (ent[d] !== 1) j += c * pe[d];
    }
    mapa[i] = j;
  }
  return mapa;
}

const sigmoide = (x) => 1 / (1 + Math.exp(-x));

/**
 * Monta o motor. `grafo` é o JSON exportado; `pesos` o ArrayBuffer do .bin.
 * Devolve { rodar(entradas) }, onde `entradas` é { nome: Float32Array } e a saída idem.
 */
export function criarMotor(grafo, pesos) {
  const todos = new Float32Array(pesos);
  const t = new Map(); // nome → { forma, dados }

  for (const [nome, p] of Object.entries(grafo.pesos)) t.set(nome, { forma: p.forma, dados: todos.subarray(p.inicio, p.inicio + p.tamanho) });
  for (const [nome, f] of Object.entries(grafo.formasEntrada)) t.set(nome, { forma: f, dados: new Float32Array(tamanho(f)) });
  const inteiro = (nome) => grafo.inteiros[nome]?.dados;

  const passosDoQuadro = [];

  // Quem é o último a ler cada memória? Serve para o ScatterND escrever POR CIMA da entrada em vez de
  // copiá-la inteira (são 18 deles, cada um sobre um cache de até 17 mil números — copiar tudo era um
  // quarto do tempo do quadro). Só pode quando ninguém depois dele ainda vai ler a versão antiga.
  // Reshape, Unsqueeze e Squeeze dividem a memória com a entrada, então contam como a mesma.
  const base = {}, ultimoUso = {};
  const baseDe = (n) => base[n] ?? n;
  grafo.nos.forEach((no, i) => {
    for (const n of no.ent) if (n) ultimoUso[baseDe(n)] = i;
    if (no.op === 'Reshape' || no.op === 'Unsqueeze' || no.op === 'Squeeze') base[no.sai[0]] = baseDe(no.ent[0]);
  });
  for (const n of grafo.saidas) ultimoUso[baseDe(n)] = Infinity;

  let indice = -1;
  for (const no of grafo.nos) {
    indice++;
    const A = no.attr;
    const ent = no.ent.map((n) => (n ? t.get(n) : undefined));
    const formaSai = no.formas[0];
    const nova = (forma = formaSai) => ({ forma, dados: new Float32Array(tamanho(forma)) });
    let sai;

    switch (no.op) {
      // Mudanças de forma que não mexem nos dados: a saída É a entrada, vista de outro jeito.
      case 'Reshape': case 'Unsqueeze': case 'Squeeze':
        sai = { forma: formaSai, dados: ent[0].dados };
        break;

      case 'Add': case 'Sub': case 'Mul': case 'Div': case 'Pow': case 'PRelu': {
        sai = nova();
        const [a, b] = ent;
        const ma = mapaBroadcast(a.forma, formaSai), mb = mapaBroadcast(b.forma, formaSai);
        const o = sai.dados, n = o.length;
        const f = {
          Add: () => { const x = a.dados, y = b.dados; for (let i = 0; i < n; i++) o[i] = x[ma[i]] + y[mb[i]]; },
          Sub: () => { const x = a.dados, y = b.dados; for (let i = 0; i < n; i++) o[i] = x[ma[i]] - y[mb[i]]; },
          Mul: () => { const x = a.dados, y = b.dados; for (let i = 0; i < n; i++) o[i] = x[ma[i]] * y[mb[i]]; },
          Div: () => { const x = a.dados, y = b.dados; for (let i = 0; i < n; i++) o[i] = x[ma[i]] / y[mb[i]]; },
          Pow: () => {
            const x = a.dados, y = b.dados;
            for (let i = 0; i < n; i++) { const e = y[mb[i]]; o[i] = e === 2 ? x[ma[i]] * x[ma[i]] : Math.pow(x[ma[i]], e); }
          },
          PRelu: () => { const x = a.dados, y = b.dados; for (let i = 0; i < n; i++) { const v = x[ma[i]]; o[i] = v < 0 ? v * y[mb[i]] : v; } },
        }[no.op];
        passosDoQuadro.push(f);
        break;
      }

      case 'Sigmoid': case 'Tanh': case 'Sqrt': {
        sai = nova();
        const x = ent[0].dados, o = sai.dados;
        const fn = no.op === 'Sigmoid' ? sigmoide : no.op === 'Tanh' ? Math.tanh : Math.sqrt;
        passosDoQuadro.push(() => { for (let i = 0; i < o.length; i++) o[i] = fn(x[i]); });
        break;
      }

      case 'Transpose': {
        sai = nova();
        const perm = A.perm, pe = passos(ent[0].forma);
        const mapa = new Int32Array(sai.dados.length);
        const ps = passos(formaSai);
        for (let i = 0; i < mapa.length; i++) {
          let resto = i, j = 0;
          for (let d = 0; d < formaSai.length; d++) { const c = Math.floor(resto / ps[d]); resto -= c * ps[d]; j += c * pe[perm[d]]; }
          mapa[i] = j;
        }
        const x = () => ent[0].dados, o = sai.dados;
        passosDoQuadro.push(() => { const d = x(); for (let i = 0; i < o.length; i++) o[i] = d[mapa[i]]; });
        break;
      }

      case 'Slice': {
        sai = nova();
        const fe = ent[0].forma, n = fe.length;
        const ini = inteiro(no.ent[1]), fim = inteiro(no.ent[2]);
        const eixos = no.ent[3] ? inteiro(no.ent[3]) : ini.map((_, i) => i);
        const pas = no.ent[4] ? inteiro(no.ent[4]) : eixos.map(() => 1);
        const comeco = new Array(n).fill(0), passo = new Array(n).fill(1);
        eixos.forEach((e0, k) => {
          const e = eixo(e0, n), dim = fe[e];
          let s = ini[k];
          if (s < 0) s += dim;
          comeco[e] = Math.max(0, Math.min(s, pas[k] > 0 ? dim : dim - 1));
          passo[e] = pas[k];
          void fim;
        });
        const pe = passos(fe), ps = passos(formaSai);
        const mapa = new Int32Array(sai.dados.length);
        for (let i = 0; i < mapa.length; i++) {
          let resto = i, j = 0;
          for (let d = 0; d < n; d++) { const c = Math.floor(resto / ps[d]); resto -= c * ps[d]; j += (comeco[d] + c * passo[d]) * pe[d]; }
          mapa[i] = j;
        }
        const o = sai.dados;
        passosDoQuadro.push(() => { const x = ent[0].dados; for (let i = 0; i < o.length; i++) o[i] = x[mapa[i]]; });
        break;
      }

      case 'Gather': {
        sai = nova();
        const fe = ent[0].forma, e = eixo(A.axis ?? 0, fe.length);
        const idx = inteiro(no.ent[1]).map((i) => (i < 0 ? i + fe[e] : i));
        const fora = tamanho(fe.slice(0, e)), dentro = tamanho(fe.slice(e + 1));
        const mapa = new Int32Array(sai.dados.length);
        let k = 0;
        for (let a = 0; a < fora; a++) for (const i of idx) for (let b = 0; b < dentro; b++) mapa[k++] = (a * fe[e] + i) * dentro + b;
        const o = sai.dados;
        passosDoQuadro.push(() => { const x = ent[0].dados; for (let i = 0; i < o.length; i++) o[i] = x[mapa[i]]; });
        break;
      }

      case 'Concat': {
        sai = nova();
        const e = eixo(A.axis, formaSai.length);
        const fora = tamanho(formaSai.slice(0, e)), dentroSai = tamanho(formaSai.slice(e));
        const blocos = ent.map((x) => tamanho(x.forma.slice(e)));
        const o = sai.dados;
        passosDoQuadro.push(() => {
          for (let a = 0; a < fora; a++) {
            let pos = a * dentroSai;
            for (let k = 0; k < ent.length; k++) { o.set(ent[k].dados.subarray(a * blocos[k], (a + 1) * blocos[k]), pos); pos += blocos[k]; }
          }
        });
        break;
      }

      case 'ScatterND': {
        const b0 = baseDe(no.ent[0]);
        const noLugar = ultimoUso[b0] === indice && !grafo.entradas.includes(b0) && !(b0 in grafo.pesos);
        sai = noLugar ? { forma: formaSai, dados: ent[0].dados } : nova();
        const fd = ent[0].forma, pd = passos(fd);
        const indices = grafo.inteiros[no.ent[1]];
        const q = indices.forma[indices.forma.length - 1];
        const nAtual = tamanho(indices.forma.slice(0, -1));
        const bloco = tamanho(fd.slice(q));
        const destinos = new Int32Array(nAtual);
        for (let i = 0; i < nAtual; i++) { let j = 0; for (let d = 0; d < q; d++) j += indices.dados[i * q + d] * pd[d]; destinos[i] = j; }
        const o = sai.dados;
        passosDoQuadro.push(() => {
          if (!noLugar) o.set(ent[0].dados);
          const u = ent[2].dados;
          for (let i = 0; i < nAtual; i++) o.set(u.subarray(i * bloco, (i + 1) * bloco), destinos[i]);
        });
        break;
      }

      case 'ReduceMean': {
        sai = nova();
        const fe = ent[0].forma, n = fe.length;
        const eixos = A.axes.map((a) => eixo(a, n));
        const pe = passos(fe), ps = passos(formaSai);
        const manter = (A.keepdims ?? 1) === 1;
        const mapa = new Int32Array(tamanho(fe));
        for (let i = 0; i < mapa.length; i++) {
          let resto = i, j = 0, ds = 0;
          for (let d = 0; d < n; d++) {
            const c = Math.floor(resto / pe[d]); resto -= c * pe[d];
            if (eixos.includes(d)) { if (manter) ds++; continue; }
            j += c * ps[ds++];
          }
          mapa[i] = j;
        }
        const div = mapa.length / sai.dados.length, o = sai.dados;
        passosDoQuadro.push(() => {
          const x = ent[0].dados;
          o.fill(0);
          for (let i = 0; i < x.length; i++) o[mapa[i]] += x[i];
          for (let i = 0; i < o.length; i++) o[i] /= div;
        });
        break;
      }

      case 'BatchNormalization': {
        sai = nova();
        const [x, escala, desloc, media, vari] = ent;
        const C = x.forma[1], dentro = tamanho(x.forma.slice(2)), fora = x.forma[0];
        const mult = new Float32Array(C), soma = new Float32Array(C);
        for (let c = 0; c < C; c++) {
          mult[c] = escala.dados[c] / Math.sqrt(vari.dados[c] + A.epsilon);
          soma[c] = desloc.dados[c] - media.dados[c] * mult[c];
        }
        const o = sai.dados;
        passosDoQuadro.push(() => {
          const d = x.dados;
          for (let a = 0; a < fora; a++) for (let c = 0; c < C; c++) {
            const base = (a * C + c) * dentro;
            for (let i = 0; i < dentro; i++) o[base + i] = d[base + i] * mult[c] + soma[c];
          }
        });
        break;
      }

      case 'Pad': {
        sai = nova();
        const fe = ent[0].forma, n = fe.length;
        const pads = inteiro(no.ent[1]);
        const pe = passos(fe), ps = passos(formaSai);
        const destino = new Int32Array(tamanho(fe));
        for (let i = 0; i < destino.length; i++) {
          let resto = i, j = 0;
          for (let d = 0; d < n; d++) { const c = Math.floor(resto / pe[d]); resto -= c * pe[d]; j += (c + pads[d]) * ps[d]; }
          destino[i] = j;
        }
        const o = sai.dados;
        passosDoQuadro.push(() => { const x = ent[0].dados; o.fill(0); for (let i = 0; i < x.length; i++) o[destino[i]] = x[i]; });
        break;
      }

      case 'MatMul': {
        sai = nova();
        const [a, b] = ent;
        const fa = a.forma, fb = b.forma;
        const M = fa[fa.length - 2], K = fa[fa.length - 1], N = fb[fb.length - 1];
        const lotes = tamanho(formaSai.slice(0, -2));
        const loteA = tamanho(fa.slice(0, -2)), loteB = tamanho(fb.slice(0, -2));
        const o = sai.dados;
        passosDoQuadro.push(() => {
          const x = a.dados, y = b.dados;
          for (let l = 0; l < lotes; l++) {
            const oa = (loteA === 1 ? 0 : l) * M * K, ob = (loteB === 1 ? 0 : l) * K * N, oo = l * M * N;
            for (let i = 0; i < M; i++) for (let j = 0; j < N; j++) {
              let s = 0;
              for (let k = 0; k < K; k++) s += x[oa + i * K + k] * y[ob + k * N + j];
              o[oo + i * N + j] = s;
            }
          }
        });
        break;
      }

      case 'Conv': case 'ConvTranspose': {
        sai = nova();
        const [x, w, bias] = ent;
        const [, Ci, Hi, Wi] = x.forma, [, Co, Ho, Wo] = formaSai;
        const G = A.group ?? 1, [kh, kw] = A.kernel_shape, [dh, dw] = A.dilations ?? [1, 1];
        const [sh, sw] = A.strides ?? [1, 1], [ph, pw] = A.pads ?? [0, 0, 0, 0];
        const ciG = Ci / G, coG = Co / G;
        const o = sai.dados, peso = w.dados, b = bias?.dados;
        if (no.op === 'Conv') {
          // A lista de (posição na entrada, posição no peso) de cada saída é fixa: monta uma vez, e o
          // quadro vira só multiplicar e somar, sem conta de índice nem teste de borda.
          const inicio = new Int32Array(Co * Ho * Wo + 1);
          const pares = [];
          for (let co = 0; co < Co; co++) {
            const g = Math.floor(co / coG);
            for (let oh = 0; oh < Ho; oh++) for (let ow = 0; ow < Wo; ow++) {
              inicio[(co * Ho + oh) * Wo + ow] = pares.length / 2;
              for (let c = 0; c < ciG; c++) {
                const ci = g * ciG + c;
                for (let i = 0; i < kh; i++) {
                  const ih = oh * sh - ph + i * dh;
                  if (ih < 0 || ih >= Hi) continue;
                  for (let j = 0; j < kw; j++) {
                    const iw = ow * sw - pw + j * dw;
                    if (iw < 0 || iw >= Wi) continue;
                    pares.push((ci * Hi + ih) * Wi + iw, ((co * ciG + c) * kh + i) * kw + j);
                  }
                }
              }
            }
          }
          inicio[Co * Ho * Wo] = pares.length / 2;
          const ix = new Int32Array(pares.filter((_, k) => k % 2 === 0));
          const pw2 = new Float32Array(pares.filter((_, k) => k % 2 === 1).map((k) => peso[k]));
          const porSaida = Ho * Wo;
          passosDoQuadro.push(() => {
            const d = x.dados;
            for (let s = 0; s < o.length; s++) {
              let acc = b ? b[Math.floor(s / porSaida)] : 0;
              for (let k = inicio[s], fim = inicio[s + 1]; k < fim; k++) acc += d[ix[k]] * pw2[k];
              o[s] = acc;
            }
          });
        } else {
          // ConvTranspose: cada entrada espalha sua contribuição pela saída (peso em [Ci, Co/G, kh, kw]).
          // Na montagem, o espalhamento é invertido em "cada saída recolhe de quem", e o quadro roda igual
          // ao da Conv.
          const listas = Array.from({ length: Co * Ho * Wo }, () => []);
          for (let ci = 0; ci < Ci; ci++) {
            const g = Math.floor(ci / ciG);
            for (let ih = 0; ih < Hi; ih++) for (let iw = 0; iw < Wi; iw++) {
              for (let c = 0; c < coG; c++) {
                const co = g * coG + c;
                for (let i = 0; i < kh; i++) {
                  const oh = ih * sh - ph + i * dh;
                  if (oh < 0 || oh >= Ho) continue;
                  for (let j = 0; j < kw; j++) {
                    const ow = iw * sw - pw + j * dw;
                    if (ow < 0 || ow >= Wo) continue;
                    listas[(co * Ho + oh) * Wo + ow].push((ci * Hi + ih) * Wi + iw, ((ci * coG + c) * kh + i) * kw + j);
                  }
                }
              }
            }
          }
          const inicio = new Int32Array(listas.length + 1);
          let total = 0;
          listas.forEach((l, s) => { inicio[s] = total; total += l.length / 2; });
          inicio[listas.length] = total;
          const ix = new Int32Array(total), pw2 = new Float32Array(total);
          let k = 0;
          for (const l of listas) for (let p = 0; p < l.length; p += 2) { ix[k] = l[p]; pw2[k++] = peso[l[p + 1]]; }
          const porSaida = Ho * Wo;
          passosDoQuadro.push(() => {
            const d = x.dados;
            for (let s = 0; s < o.length; s++) {
              let acc = b ? b[Math.floor(s / porSaida)] : 0;
              for (let q = inicio[s], fim = inicio[s + 1]; q < fim; q++) acc += d[ix[q]] * pw2[q];
              o[s] = acc;
            }
          });
        }
        break;
      }

      case 'GRU': {
        // Formato ONNX: X [seq, lote, entrada]; W [dir, 3H, entrada]; R [dir, 3H, H]; B [dir, 6H];
        // portas na ordem z, r, h; linear_before_reset = 1 (o r multiplica DEPOIS de somar o viés de R).
        const [X, W, R, Bv, , H0] = ent;
        const H = A.hidden_size, dirs = A.direction === 'bidirectional' ? 2 : 1;
        const [S, L, I] = X.forma;
        const Y = { forma: [S, dirs, L, H], dados: new Float32Array(S * dirs * L * H) };
        const Yh = { forma: [dirs, L, H], dados: new Float32Array(dirs * L * H) };
        const h = new Float32Array(H), xw = new Float32Array(3 * H), hr = new Float32Array(3 * H);
        passosDoQuadro.push(() => {
          const x = X.dados, w = W.dados, r = R.dados, bv = Bv ? Bv.dados : null;
          for (let dir = 0; dir < dirs; dir++) {
            const ow = dir * 3 * H * I, or = dir * 3 * H * H, ob = dir * 6 * H;
            for (let l = 0; l < L; l++) {
              for (let k = 0; k < H; k++) h[k] = H0 ? H0.dados[(dir * L + l) * H + k] : 0;
              for (let p = 0; p < S; p++) {
                const s = dir === 0 ? p : S - 1 - p;
                const xb = (s * L + l) * I;
                for (let k = 0; k < 3 * H; k++) {
                  let a = bv ? bv[ob + k] : 0;
                  for (let i = 0; i < I; i++) a += x[xb + i] * w[ow + k * I + i];
                  xw[k] = a;
                  let c = bv ? bv[ob + 3 * H + k] : 0;
                  for (let i = 0; i < H; i++) c += h[i] * r[or + k * H + i];
                  hr[k] = c;
                }
                for (let k = 0; k < H; k++) {
                  const z = sigmoide(xw[k] + hr[k]);
                  const rr = sigmoide(xw[H + k] + hr[H + k]);
                  const n = Math.tanh(xw[2 * H + k] + rr * hr[2 * H + k]);
                  h[k] = (1 - z) * n + z * h[k];
                }
                Y.dados.set(h, ((s * dirs + dir) * L + l) * H);
              }
              Yh.dados.set(h, (dir * L + l) * H);
            }
          }
        });
        if (no.sai[0]) t.set(no.sai[0], Y);
        if (no.sai[1]) t.set(no.sai[1], Yh);
        continue;
      }

      default:
        throw new Error(`operação não implementada: ${no.op}`);
    }
    t.set(no.sai[0], sai);
  }

  const destinos = Object.fromEntries(grafo.entradas.map((n) => [n, t.get(n).dados]));
  const saida = Object.fromEntries(grafo.saidas.map((n) => [n, t.get(n).dados]));
  return {
    /**
     * Escreve as entradas, roda o grafo e devolve as saídas. Os arrays da saída são SEMPRE os mesmos,
     * reescritos a cada chamada: quem precisar guardar um resultado copia antes de rodar de novo.
     */
    rodar(entradas) {
      for (const nome in entradas) destinos[nome].set(entradas[nome]);
      for (let i = 0; i < passosDoQuadro.length; i++) passosDoQuadro[i]();
      return saida;
    },
  };
}
