/**
 * Pequenas contas da janela dos dados (DadosDialog.tsx): montar a expressão pelos botões e ler as listas digitadas.
 * Puras, para testar sem tela. Quem entende a notação de verdade é o servidor (server/src/dados.ts); aqui só se escreve texto.
 */

/** Soma um dado de `faces` faces à expressão: aumenta a quantidade se já há um igual, senão acrescenta `+1dN`. */
export function somarDado(expressao: string, faces: number | '%'): string {
  const texto = expressao.trim();
  const sufixo = faces === '%' ? '%' : String(faces);
  if (!texto) return `1d${sufixo}`;
  const igual = new RegExp(`(^|[+-])(\\d*)d${faces === '%' ? '%' : faces}(?![\\d%])`, 'i');
  const achou = igual.exec(texto);
  if (achou) {
    const quantos = achou[2] === '' ? 1 : Number(achou[2]);
    if (quantos >= 100) return texto;
    const inicio = achou.index + achou[1].length;
    return texto.slice(0, inicio) + `${quantos + 1}d${sufixo}` + texto.slice(inicio + achou[2].length + 1 + sufixo.length);
  }
  return `${texto}+1d${sufixo}`;
}

/** Soma `delta` ao modificador do fim da expressão (`+3`, `-1`); zero tira o modificador. */
export function ajustarModificador(expressao: string, delta: number): string {
  const texto = expressao.trim();
  if (!texto) return texto;
  const fim = /([+-])(\d+)$/.exec(texto);
  const apos = fim && !/d$/i.test(texto.slice(0, fim.index)) ? fim : null;
  const atual = apos ? (apos[1] === '-' ? -1 : 1) * Number(apos[2]) : 0;
  const base = apos ? texto.slice(0, apos.index) : texto;
  const novo = atual + delta;
  if (Math.abs(novo) > 999) return texto;
  return novo === 0 ? base : `${base}${novo > 0 ? '+' : '-'}${Math.abs(novo)}`;
}

/** Uma linha por item: sem vazios. */
export function linhasParaLista(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Uma linha por pessoa, com o modificador no fim se quiser: "Ana +3", "Bia", "Cris -1". */
export function linhasParaIniciativa(texto: string): { nome: string; mod: number }[] {
  return linhasParaLista(texto).map((linha) => {
    const m = /^(.*?)\s*([+-]\s*\d+)?$/.exec(linha)!;
    const nome = (m[1] || linha).trim();
    return { nome, mod: m[2] ? Number(m[2].replace(/\s+/g, '')) : 0 };
  });
}

/** Reconhece o comando `/r 2d6+3` (também /roll e /rolar) digitado na caixa de escrever. */
export function comandoDeRolar(texto: string): string | null {
  const m = /^\/(?:r|roll|rolar)(?:\s+(.*))?$/is.exec(texto.trim());
  return m ? (m[1] ?? '').trim() : null;
}
