// GERADO por web/scripts/cores-dos-avatares.py (não editar à mão): de cada avatar pronto, a cor do pelo e a da roupa,
// para a troca de paleta do coelho no kart (render.ts, coelhoDoAvatar).
export const CORES_DOS_AVATARES: Record<number, { pelo: [number, number, number]; roupa: [number, number, number] }> = {
  1: { pelo: [249, 234, 198], roupa: [222, 178, 126] },
  2: { pelo: [250, 241, 212], roupa: [132, 44, 51] },
  3: { pelo: [251, 236, 200], roupa: [57, 95, 106] },
  4: { pelo: [249, 228, 199], roupa: [53, 68, 91] },
  5: { pelo: [252, 237, 200], roupa: [217, 186, 154] },
  6: { pelo: [250, 235, 199], roupa: [133, 69, 59] },
  7: { pelo: [250, 241, 212], roupa: [61, 93, 110] },
  8: { pelo: [248, 233, 196], roupa: [146, 230, 174] },
  9: { pelo: [251, 235, 198], roupa: [119, 29, 29] },
  10: { pelo: [250, 241, 212], roupa: [47, 85, 125] },
  11: { pelo: [250, 241, 212], roupa: [45, 39, 49] },
  12: { pelo: [250, 241, 212], roupa: [56, 73, 98] },
  13: { pelo: [251, 235, 197], roupa: [46, 99, 139] },
  14: { pelo: [250, 241, 212], roupa: [45, 40, 57] },
  15: { pelo: [250, 241, 212], roupa: [150, 145, 129] },
  16: { pelo: [250, 241, 212], roupa: [254, 100, 19] },
};

/** As cores do kart que mudam (o pelo e o moletom do mascote). As outras ficam como estão. */
export const PELO_DO_MASCOTE: [number, number, number][] = [[224, 210, 237], [227, 205, 227], [210, 192, 220], [182, 162, 188], [175, 153, 182], [179, 157, 184], [161, 135, 154], [197, 164, 179], [122, 103, 123], [96, 79, 111]];
export const MOLETOM_DO_MASCOTE: [number, number, number][] = [[61, 43, 54], [50, 33, 45], [46, 29, 41]];
