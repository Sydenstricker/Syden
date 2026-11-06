/**
 * AS TELAS DOS MICROJOGOS DA FESTA (05/11/2026). Cada uma mora em ./<id>.tsx (o contrato `MicrojogoDaTela`, em ./comum.tsx);
 * este registro só as junta, e a rodada que as mostra é `RodadaDaFesta`, em ../JogoFesta.tsx.
 *
 * O GUIA de como fazer um microjogo novo está no topo de server/src/festa/registro.ts. Microjogo novo: o arquivo dele aqui e
 * UMA linha abaixo, com o mesmo id do servidor (server/test/festa-registro.test.ts confere que os dois registros batem).
 */
export { default as saque } from './saque';
export { default as forca } from './forca';
export { default as relogio } from './relogio';
export { default as copos } from './copos';
export { default as siga } from './siga';
export { default as alvo } from './alvo';
export { default as praga } from './praga';
export { default as ponteiro } from './ponteiro';
export { default as despensa } from './despensa';
export { default as flor } from './flor';
export * from './lote1';
export * from './lote2';
export * from './lote3';
export * from './lote4';
export * from './lote5';
export * from './lote6';
