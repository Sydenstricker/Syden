/**
 * AS DATAS COMEMORATIVAS DO SALÃO (06/11/2026, pedido dele: "testar o cenário de datas comemorativas, começando pelo Natal, no
 * salão em 3D"). Um conjunto de época aparece SOZINHO pela data do aparelho, para toda a turma igual (é a data, não uma escolha
 * de ninguém), e some sozinho depois. Sem servidor, sem contagem regressiva e sem "pegue antes que acabe": é a regra da caixa de
 * correio das novidades (sem FOMO), aplicada ao enfeite do salão.
 *
 * Época nova é uma linha em `EPOCAS` (o mês e o dia de começo e de fim, inclusive os dois) e a montagem dela em salao3d/cena.ts.
 * Quando duas épocas se cruzam, vale a primeira da lista.
 */
export type Epoca = 'natal';

interface DaEpoca {
  id: Epoca;
  /** [mês, dia] do primeiro dia. */
  de: [number, number];
  /** [mês, dia] do último dia (pode ser do ano seguinte: o Natal vai de dezembro a janeiro). */
  ate: [number, number];
}

/**
 * O NATAL vai de 1º de dezembro ao Dia de Reis (6 de janeiro): o mês inteiro de preparação, como as lojas e as casas montam a
 * árvore, e até o dia em que, pela tradição, ela se desmonta.
 */
export const EPOCAS: DaEpoca[] = [{ id: 'natal', de: [12, 1], ate: [1, 6] }];

/** A época de um dia (pelo relógio LOCAL do aparelho: é o dia de quem olha), ou null. */
export function epocaDoDia(data: Date = new Date()): Epoca | null {
  const hoje = (data.getMonth() + 1) * 100 + data.getDate();
  for (const e of EPOCAS) {
    const de = e.de[0] * 100 + e.de[1];
    const ate = e.ate[0] * 100 + e.ate[1];
    const dentro = de <= ate ? hoje >= de && hoje <= ate : hoje >= de || hoje <= ate;
    if (dentro) return e.id;
  }
  return null;
}
