/**
 * A RECEITA DO COELHO (10/11/2026, pedido dele: "gostei da tela de criação, pode implementar ao Syden?"). O personagem é
 * feito de CAMADAS (CLAUDE.md, "O MÉTODO DAS CAMADAS"): um corpo, a cor do pelo e a da roupa (troca de paleta) e os
 * acessórios, cada um com a sua cor. A receita é isso, num texto curto que se copia e cola: "SYD1-" + o JSON em base64,
 * o mesmo formato da prévia do criador (os códigos feitos lá valem aqui).
 *
 * ESTE ARQUIVO EXISTE EM DUAS CÓPIAS IGUAIS BYTE A BYTE: web/src/coelho/receita.ts e server/src/coelho-receita.ts (o teste
 * web/test/coelho.test.ts confere). O servidor só guarda a receita que passa por `lerCodigo` e a guarda já CANÔNICA
 * (`codigo(lerCodigo(x))`), porque ela é desenhada na tela de todo mundo.
 */

/**
 * O CORPO É A PASTA DO DESENHO (e2e/pixel-art/personagem/<corpo>/): o corpo base, o TIPO DE CORPO e a roupa juntos, porque no
 * PixelLab cada combinação é um desenho com as poses dele. O criador mostra as três escolhas separadas (ver partesDoCorpo).
 * O TIPO DE CORPO (pedido dele, 10/11/2026, "como no Dark Souls"): cada corpo base ganha a versão feminina; a do mascote tem
 * duas roupas, o moletom comprido (a de fábrica) e o moletom curto com a barriga à mostra.
 */
export const CORPOS = ['mascote', 'orelha-caida', 'musculoso', 'mascote-f-moletom', 'mascote-f', 'orelha-caida-f-moletom', 'musculoso-f', 'musculoso-f-curta'] as const;
export type Corpo = (typeof CORPOS)[number];
export const BASES = ['mascote', 'orelha-caida', 'musculoso'] as const;
export type Base = (typeof BASES)[number];
export type Tipo = 'masculino' | 'feminino';
/** A roupa: a de fábrica de cada corpo (o moletom, ou a regata no forte), ou a CURTA (o moletom curto no feminino do mascote, a
 *  regata curta com as coxas fortes no feminino do forte: "a forte feminina merece duas versões", decisão dele de 10/11/2026). */
export type Veste = 'padrao' | 'curta';

const PARTES: Record<Corpo, { base: Base; tipo: Tipo; veste: Veste }> = {
  mascote: { base: 'mascote', tipo: 'masculino', veste: 'padrao' },
  'orelha-caida': { base: 'orelha-caida', tipo: 'masculino', veste: 'padrao' },
  musculoso: { base: 'musculoso', tipo: 'masculino', veste: 'padrao' },
  'mascote-f-moletom': { base: 'mascote', tipo: 'feminino', veste: 'padrao' },
  'mascote-f': { base: 'mascote', tipo: 'feminino', veste: 'curta' },
  'orelha-caida-f-moletom': { base: 'orelha-caida', tipo: 'feminino', veste: 'padrao' },
  'musculoso-f': { base: 'musculoso', tipo: 'feminino', veste: 'padrao' },
  'musculoso-f-curta': { base: 'musculoso', tipo: 'feminino', veste: 'curta' },
};

/** O corpo base, o tipo e a roupa de uma pasta. */
export function partesDoCorpo(c: Corpo): { base: Base; tipo: Tipo; veste: Veste } {
  return PARTES[c];
}

/** A pasta de uma combinação, ou null se ela não existe (não há moletom curto no forte, por exemplo). */
export function corpoDe(base: Base, tipo: Tipo, veste: Veste): Corpo | null {
  return (CORPOS.find((c) => PARTES[c].base === base && PARTES[c].tipo === tipo && PARTES[c].veste === veste) as Corpo | undefined) ?? null;
}
export const CABECAS = ['bone'] as const;
export const PESCOCOS = ['bandana'] as const;
export type Cabeca = (typeof CABECAS)[number];
export type Pescoco = (typeof PESCOCOS)[number];

/** Uma cor "#rrggbb", ou null para a cor ORIGINAL do desenho. */
export type Cor = string | null;

export interface Receita {
  corpo: Corpo;
  pelo: Cor;
  roupa: Cor;
  cabeca: Cabeca | null;
  cabecaCor: Cor;
  pescoco: Pescoco | null;
  pescocoCor: Cor;
}

export const RECEITA_DO_MASCOTE: Receita = { corpo: 'mascote', pelo: null, roupa: null, cabeca: null, cabecaCor: null, pescoco: null, pescocoCor: null };

const COR = /^#[0-9a-f]{6}$/;

function cor(valor: unknown): Cor {
  if (typeof valor !== 'string') return null;
  const v = valor.toLowerCase();
  return COR.test(v) ? v : null;
}

/** O código da receita. Os campos vazios ficam de fora, para o código ficar curto. */
export function codigo(r: Receita): string {
  const c: Record<string, string> = { c: r.corpo };
  if (r.pelo) c.p = r.pelo;
  if (r.roupa) c.r = r.roupa;
  if (r.cabeca) {
    c.h = r.cabeca;
    if (r.cabecaCor) c.hc = r.cabecaCor;
  }
  if (r.pescoco) {
    c.n = r.pescoco;
    if (r.pescocoCor) c.nc = r.pescocoCor;
  }
  return 'SYD1-' + btoa(JSON.stringify(c)).replace(/=+$/, '');
}

/** Lê um código; null se não é de um coelho do Syden. Cor inválida vira a original, e acessório que não existe some. */
export function lerCodigo(texto: unknown): Receita | null {
  if (typeof texto !== 'string' || texto.length > 300) return null;
  const m = /^SYD1-([A-Za-z0-9+/]+)=*$/.exec(texto.trim());
  if (!m) return null;
  let c: Record<string, unknown>;
  try {
    const bruto = m[1] + '='.repeat((4 - (m[1].length % 4)) % 4);
    c = JSON.parse(atob(bruto)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!c || typeof c !== 'object' || !(CORPOS as readonly unknown[]).includes(c.c)) return null;
  const cabeca = (CABECAS as readonly unknown[]).includes(c.h) ? (c.h as Cabeca) : null;
  const pescoco = (PESCOCOS as readonly unknown[]).includes(c.n) ? (c.n as Pescoco) : null;
  return {
    corpo: c.c as Corpo,
    pelo: cor(c.p),
    roupa: cor(c.r),
    cabeca,
    cabecaCor: cabeca ? cor(c.hc) : null,
    pescoco,
    pescocoCor: pescoco ? cor(c.nc) : null,
  };
}

/** Duas receitas são o mesmo coelho? */
export function mesmaReceita(a: Receita, b: Receita): boolean {
  return codigo(a) === codigo(b);
}

/**
 * OS 16 COELHOS PRONTOS COMO SUGESTÕES (decisão dele, 10/11/2026: "usar os 16 avatares como sugestões; futuramente criar os
 * assets no PixelLab e gerar maior variação"). Cada um é a receita MAIS PERTO dele com as peças que existem hoje: o corpo
 * (orelha caída no 02, 03 e 14), a cor do pelo e a da roupa (as de web/src/corrida/coresDosAvatares.ts, medidas no desenho)
 * e o boné ou a bandana de quem usa algo parecido. Fones, óculos, gorros, o VR, o cachecol e as roupas que não são o
 * moletom ainda não existem como camada: quando existirem, entram aqui.
 */
export const PRESETS: Record<number, Receita> = {
  1: { ...RECEITA_DO_MASCOTE, pelo: '#f9eac6', roupa: '#deb27e' },
  2: { ...RECEITA_DO_MASCOTE, corpo: 'orelha-caida', pelo: '#faf1d4', roupa: '#842c33', cabeca: 'bone', cabecaCor: '#9b2d36' },
  3: { ...RECEITA_DO_MASCOTE, corpo: 'orelha-caida', pelo: '#fbecc8', roupa: '#395f6a' },
  4: { ...RECEITA_DO_MASCOTE, pelo: '#f9e4c7', roupa: '#35445b' },
  5: { ...RECEITA_DO_MASCOTE, pelo: '#fcedc8', roupa: '#d9ba9a' },
  6: { ...RECEITA_DO_MASCOTE, pelo: '#faebc7', roupa: '#85453b' },
  7: { ...RECEITA_DO_MASCOTE, pelo: '#faf1d4', roupa: '#3d5d6e' },
  8: { ...RECEITA_DO_MASCOTE, pelo: '#f8e9c4', roupa: '#92e6ae' },
  9: { ...RECEITA_DO_MASCOTE, pelo: '#fbebc6', roupa: '#771d1d' },
  10: { ...RECEITA_DO_MASCOTE, pelo: '#faf1d4', roupa: '#2f557d' },
  11: { ...RECEITA_DO_MASCOTE, pelo: '#faf1d4', roupa: '#2d2731', cabeca: 'bone', cabecaCor: '#3f6e80' },
  12: { ...RECEITA_DO_MASCOTE, pelo: '#faf1d4', roupa: '#384962', pescoco: 'bandana', pescocoCor: '#d0a060' },
  13: { ...RECEITA_DO_MASCOTE, pelo: '#fbebc5', roupa: '#2e638b' },
  14: { ...RECEITA_DO_MASCOTE, corpo: 'orelha-caida', pelo: '#faf1d4', roupa: '#2d2839' },
  15: { ...RECEITA_DO_MASCOTE, pelo: '#faf1d4', roupa: '#969181', cabeca: 'bone', cabecaCor: '#8e8b8f' },
  16: { ...RECEITA_DO_MASCOTE, pelo: '#faf1d4', roupa: '#fe6413', pescoco: 'bandana', pescocoCor: '#c9472b' },
};

/** O coelho de uma pessoa na cena: a receita dela; sem receita, a do coelho pronto que ela usa; sem nada, o mascote. */
export function receitaDe(pessoa: { coelho?: string | null; avatarPronto?: number | null }): Receita {
  return lerCodigo(pessoa.coelho) ?? (pessoa.avatarPronto ? PRESETS[pessoa.avatarPronto] : undefined) ?? RECEITA_DO_MASCOTE;
}
