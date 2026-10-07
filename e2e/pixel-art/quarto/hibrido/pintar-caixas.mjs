// As caixas foram marcadas olhando ver-unzoom.png (900 px de largura, 10 px de margem): esta função as
// converte para os pixels do quarto convertido (313 px).
export const nativo = ([x0, y0, x1, y1]) => [x0, y0, x1, y1].map((v) => Math.round(((v - 10) * 313) / 900));
