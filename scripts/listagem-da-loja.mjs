// Monta a pasta que se importa no Partner Center (Listagens da Store → Importar listagens → Importar pasta):
// e2e/fotos/syden-loja/, com UM CSV, as fotos de cada idioma e os logos.
//
// OS TEXTOS moram em store/listagem/<idioma>.json (o pt-br.json é a fonte; os outros 63 são a tradução dele, feita
// em 09/10/2026 com as regras de tom e gênero de cada língua do CLAUDE.md). Mudou o texto? Edite o pt-br.json, refaça
// a tradução dos campos mudados nos outros, e rode isto de novo.
// AS FOTOS saem de `node e2e/capturas-da-loja.mjs` (e2e/fotos/loja/<idioma>/).
// O CSV de base é o que o Partner Center EXPORTA (Exportar listagens): ele traz os campos, os IDs e as URLs do que já
// está lá. Os 8 idiomas do app que a Store não tem (cnr dv dz ht mg my om so) ficam de fora.
//
//   node scripts/listagem-da-loja.mjs caminho/do/exportado.csv
//   DESTAQUE=store/logos/super-hero-conversa.png node scripts/listagem-da-loja.mjs ...   (outra arte de destaque)

import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const RAIZ = 'syden-loja';
const DESTINO = `${REPO}/e2e/fotos/${RAIZ}`;
const TRAD = `${REPO}/store/listagem`;
const ORIGINAL = process.argv[2];
if (!ORIGINAL) { console.error('Passe o CSV exportado do Partner Center: node scripts/listagem-da-loja.mjs exportado.csv'); process.exit(1); }

// Código do app → código da listagem na Store (os genéricos cobrem todas as variantes regionais).
const CODIGOS = {
  'pt-BR': 'pt-br', en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', nl: 'nl', ca: 'ca', ro: 'ro', pl: 'pl', cs: 'cs', sk: 'sk',
  sv: 'sv', da: 'da', no: 'nb', fi: 'fi', is: 'is', et: 'et', lv: 'lv', lt: 'lt', hu: 'hu', sl: 'sl', hr: 'hr',
  ru: 'ru', uk: 'uk', bg: 'bg', mk: 'mk', sr: 'sr-cyrl', kk: 'kk', mn: 'mn-cyrl', tg: 'tg-cyrl', el: 'el', sq: 'sq', az: 'az-latn',
  ar: 'ar', fa: 'fa', ur: 'ur', he: 'he', tr: 'tr', tk: 'tk-latn', uz: 'uz-latn', hi: 'hi', bn: 'bn', ne: 'ne',
  ta: 'ta', te: 'te', si: 'si', th: 'th', lo: 'lo', km: 'km', ja: 'ja', ko: 'ko', 'zh-CN': 'zh-hans', vi: 'vi', id: 'id', ms: 'ms',
  sw: 'sw', am: 'am', ha: 'ha-latn', yo: 'yo-latn', zu: 'zu', af: 'af', hy: 'hy', ka: 'ka',
};
const FOTOS = ['1-inicio.png', '2-conversa.png', '3-guarda-roupa.png', '4-chamada.png'];
const LOGOS = {
  StoreLogo300x300: ['store/logos/icone-300.png', 'logos/icone-300.png'],
  StoreLogo1080x1080: ['store/logos/caixa-1080.png', 'logos/caixa-1080.png'],
  StoreLogo720x1080: ['store/logos/poster-720x1080.png', 'logos/poster-720x1080.png'],
  PromoImage1920x1080: [process.env.DESTAQUE ?? 'store/logos/super-hero-quarto.png', 'logos/destaque-1920.png'],
};

// ---- Traduções: confere antes de montar qualquer coisa ----
const problemas = [];
const textos = {};
const pt = JSON.parse(fs.readFileSync(`${TRAD}/pt-br.json`, 'utf8'));
for (const app of Object.keys(CODIGOS)) {
  const arq = `${TRAD}/${app === 'pt-BR' ? 'pt-br' : app}.json`;
  if (!fs.existsSync(arq)) { problemas.push(`${app}: falta ${arq}`); continue; }
  let j; try { j = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { problemas.push(`${app}: JSON inválido (${e.message})`); continue; }
  for (const k of Object.keys(pt)) if (!(k in j)) problemas.push(`${app}: sem ${k}`);
  if (j.Features?.length !== pt.Features.length) problemas.push(`${app}: ${j.Features?.length} recursos, esperava ${pt.Features.length}`);
  if (j.SearchTerms?.length !== pt.SearchTerms.length) problemas.push(`${app}: ${j.SearchTerms?.length} termos, esperava ${pt.SearchTerms.length}`);
  for (const f of j.Features ?? []) if (f.length > 200) problemas.push(`${app}: recurso com ${f.length} caracteres`);
  for (const s of j.SearchTerms ?? []) if (s.length > 30) problemas.push(`${app}: termo "${s}" com ${s.length} caracteres`);
  if ((j.Description ?? '').length > 10000) problemas.push(`${app}: descrição longa demais`);
  if (/discord|zoom|whatsapp|kakao|telegram/i.test(JSON.stringify(j))) problemas.push(`${app}: cita marca de terceiro`);
  for (const f of FOTOS) if (!fs.existsSync(`${REPO}/e2e/fotos/loja/${app}/${f}`)) problemas.push(`${app}: falta a foto ${f}`);
  textos[app] = j;
}
if (problemas.length) { console.error(problemas.join('\n')); process.exit(1); }

// ---- A pasta: fotos e logos copiados, um CSV só ----
fs.rmSync(DESTINO, { recursive: true, force: true });
fs.mkdirSync(`${DESTINO}/logos`, { recursive: true });
for (const app of Object.keys(CODIGOS)) {
  fs.mkdirSync(`${DESTINO}/${app}`, { recursive: true });
  for (const f of FOTOS) fs.copyFileSync(`${REPO}/e2e/fotos/loja/${app}/${f}`, `${DESTINO}/${app}/${f}`);
}
for (const [de, para] of Object.values(LOGOS)) fs.copyFileSync(path.resolve(REPO, de), `${DESTINO}/${para}`);

// ---- O CSV: as linhas do exportado, com uma coluna por idioma ----
const L = lerCsv(fs.readFileSync(ORIGINAL, "utf8").replace(/^\uFEFF/, '')).filter((l) => l.length > 1);
const cab = L[0];
const colDefault = cab.indexOf('default');
for (const loja of Object.values(CODIGOS)) if (!cab.includes(loja)) cab.push(loja);
const valor = (app, campo) => {
  const j = textos[app];
  if (['Description', 'ShortDescription', 'ReleaseNotes', 'CopyrightTrademarkInformation', 'AdditionalLicenseTerms'].includes(campo)) return j[campo];
  if (campo === 'Title' || campo === 'ShortTitle') return 'Syden';
  if (campo === 'DevStudio') return 'Sydenstricker Labs';
  let m = /^Feature(\d+)$/.exec(campo); if (m) return j.Features[m[1] - 1] ?? '';
  m = /^SearchTerm(\d+)$/.exec(campo); if (m) return j.SearchTerms[m[1] - 1] ?? '';
  m = /^DesktopScreenshot(\d+)$/.exec(campo); if (m) return FOTOS[m[1] - 1] ? `${RAIZ}/${app}/${FOTOS[m[1] - 1]}` : null;
  if (LOGOS[campo]) return `${RAIZ}/${LOGOS[campo][1]}`;
  if (campo === 'OverrideLogosForWin10') return 'True';
  return null; // null = deixa como está
};
for (const linha of L.slice(1)) {
  while (linha.length < cab.length) linha.push('');
  const campo = linha[0];
  if (LOGOS[campo]) linha[colDefault] = `${RAIZ}/${LOGOS[campo][1]}`;
  for (const [app, loja] of Object.entries(CODIGOS)) {
    const v = valor(app, campo);
    if (v !== null) linha[cab.indexOf(loja)] = v;
  }
}
const aspas = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
fs.writeFileSync(`${DESTINO}/listagem.csv`, '\uFEFF' + L.map((l) => l.map(aspas).join(',')).join('\r\n') + '\r\n');
console.log(`Pronto: ${DESTINO} — ${Object.keys(CODIGOS).length} idiomas, ${cab.length - 4} colunas de idioma.`);

/** CSV com campos entre aspas que podem ter vírgula, aspas dobradas e quebra de linha (o exportado tem todos). */
function lerCsv(texto) {
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

// ---- Em lotes (LOTES=4): a importação da pasta inteira (256 fotos) foi barrada no meio pelo Akamai do Partner
// Center em 09/10/2026, com "Access Denied". Cada lote é uma pasta com o CSV só dos seus idiomas; o português e os
// logos vão no primeiro, e os seguintes NÃO levam a coluna pt-br — senão a importação deles devolveria o texto antigo
// que veio no exportado. Importe na ordem: syden-loja-1, depois -2...
if (process.env.LOTES) {
  const apps = Object.keys(CODIGOS);
  const tam = Math.ceil(apps.length / Number(process.env.LOTES));
  for (let k = 0; k * tam < apps.length; k++) {
    const grupo = apps.slice(k * tam, (k + 1) * tam);
    const raiz = `${RAIZ}-${k + 1}`;
    const dir = `${REPO}/e2e/fotos/${raiz}`;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const app of grupo) fs.cpSync(`${DESTINO}/${app}`, `${dir}/${app}`, { recursive: true });
    if (k === 0) fs.cpSync(`${DESTINO}/logos`, `${dir}/logos`, { recursive: true });
    const colunas = [0, 1, 2, colDefault, ...grupo.map((app) => cab.indexOf(CODIGOS[app]))];
    // A coluna default fica, mas vazia depois do primeiro: os logos já foram, e imagem vazia não apaga nada.
    // Os logos também: só o primeiro lote leva a pasta deles, e os idiomas novos herdam pela coluna default.
    const vazio = (l, i, c) => k > 0 && i > 0 && c > 2 && (c === colDefault || LOGOS[l[0]]);
    const linhas = L.map((l, i) => colunas.map((c) => (vazio(l, i, c) ? '' : l[c].replaceAll(`${RAIZ}/`, `${raiz}/`))));
    fs.writeFileSync(`${dir}/listagem.csv`, '﻿' + linhas.map((l) => l.map(aspas).join(',')).join('\r\n') + '\r\n');
    console.log(`  ${raiz}: ${grupo.join(' ')}`);
  }
}
