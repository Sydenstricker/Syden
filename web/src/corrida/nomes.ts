import { chave } from '../i18n';
import { COPA } from './pista';

/** Os nomes das pistas e da copa, marcados para traduzir (o id é o do servidor: server/src/corrida.ts). */
export const NOMES_DAS_PISTAS: Record<string, string> = {
  'horta-1': chave('Horta'),
  'pomar-1': chave('Pomar'),
  'praia-1': chave('Praia'),
  'bosque-1': chave('Bosque'),
  'neve-1': chave('Neve'),
  'canion-1': chave('Cânion'),
  [COPA]: chave('Copa da Cenoura'),
  'copa-do-repolho': chave('Copa do Repolho'),
  // o pódio da Festa dos coelhos mora na mesma estante (server/src/minijogo-festa.ts)
  festa: chave('Festa dos coelhos'),
  // e o do modo Relâmpago dela (server/src/minijogo-festa-relampago.ts, 19/11/2026): os pontos são os acertos
  'festa-relampago': chave('Festa relâmpago'),
  // o pódio da Briga na horta, com a fase vencida (server/src/minijogo-briga.ts)
  briga: chave('Briga na horta'),
  // e o da Masmorra da Toca (server/src/minijogo-masmorra.ts): os pontos, e MAIS é melhor
  masmorra: chave('Masmorra da Toca'),
  // e as outras fases da Briga e a campanha (06/11/2026): o troféu diz "Briga na horta · Floresta" (Trofeus.tsx, jogoDoTrofeu)
  'briga-floresta': chave('Floresta'),
  'briga-deserto': chave('Deserto'),
  'briga-neve': chave('Neve'),
  'briga-castelo': chave('Castelo'),
  'briga-campanha': chave('Campanha'),
  // e o da Horta em cascata (server/src/minijogo-blocos.ts)
  blocos: chave('Horta em cascata'),
  // as fases e a copa do Pulo do coelho (server/src/plataforma.ts), que também dão troféu na sala
  'prado-1': chave('Prado'),
  'toca-1': chave('Toca'),
  'copas-1': chave('Galhos'),
  'copa-do-pulo': chave('Copa do Pulo'),
  // as fases com bichos e a copa delas (19/11/2026)
  'corrego-1': chave('Córrego'),
  'mina-1': chave('Mina'),
  'ninho-1': chave('Ninho'),
  'copa-dos-bichos': chave('Copa dos Bichos'),
  // e o do Minigolfe da toca (server/src/minijogo-golfe.ts): os pontos são o total de tacadas, e MENOS é melhor
  golfe: chave('Minigolfe da toca'),
  // e o da Caça às pragas da horta (server/src/minijogo-caca.ts): os pontos, e MAIS é melhor
  caca: chave('Caça às pragas da horta'),
  // e o da Rota Estelar (server/src/minijogo-estelar.ts): os pontos, e MAIS é melhor
  estelar: chave('Rota Estelar'),
  // e o do Trânsito da toca (server/src/minijogo-transito.ts): os pontos, e MAIS é melhor
  transito: chave('Trânsito da toca'),
  // e o do Tabuleiro da turma (server/src/minijogo-tabuleiro-da-turma.ts)
  tabuleiro: chave('Tabuleiro da turma'),
  // e o de Capitais, o antigo Cidades à venda (server/src/minijogo-cidades.ts): os pontos são o patrimônio
  cidades: chave('Capitais'),
  // e o do Estoura-balão (server/src/minijogo-balao.ts): os pontos são os balões que sobraram
  balao: chave('Estoura-balão'),
  // e o dos Coelhos a jato (server/src/minijogo-jato.ts)
  jato: chave('Coelhos a jato'),
  // e o da Regata da toca (server/src/minijogo-barco.ts)
  barco: chave('Regata da toca'),
  // e o dos Carrinhos da toca (server/src/minijogo-carrinhos.ts)
  carrinhos: chave('Carrinhos da toca'),
  // e o da Gincana da toca (server/src/minijogo-gincana.ts)
  gincana: chave('Gincana da toca'),
  // e o do Ringue da Toca (server/src/minijogo-ringue.ts): os pontos são as lutas vencidas, e o tempo só de quem venceu as três
  ringue: chave('Ringue da Toca'),
  // e o do Planador da toca (server/src/minijogo-planador.ts): os pontos do voo, e MAIS é melhor
  planador: chave('Planador da toca'),
  // e o do Pinball da Horta (server/src/minijogo-pinball.ts): os pontos, e MAIS é melhor
  pinball: chave('Pinball da Horta'),
  // e o da Ponte da toca (server/src/minijogo-ponte.ts): os pontos são o custo da ponte, e MENOS é melhor
  ponte: chave('Ponte da toca'),
  // e o do Chefe da turma (server/src/minijogo-chefe.ts): os pontos são o dano dado
  chefe: chave('O chefe da turma'),
  // e o do Comando Cenoura (server/src/comando/motor.ts): com a fase vencida
  comando: chave('Comando Cenoura'),
  // e o das Lendas da Toca (server/src/lendas-regras.ts): os pontos são o dano dado mais a cura
  lendas: chave('Lendas da Toca'),
  // e o dos Bichos da Toca (server/src/minijogo-bichos.ts): só quem venceu a luta da sala; os pontos são os bichos que ficaram acordados
  bichos: chave('Bichos da Toca'),
  // e o da Arena dos coelhos (server/src/arena/motor.ts): quem venceu (cada um por si, até o 3º); os pontos são o dano causado
  'bichos-arena': chave('Arena'),
  // e o do Duelo de aviõezinhos (server/src/minijogo-duelo.ts): os pontos são as vidas que sobraram
  duelo: chave('Duelo de aviõezinhos'),
  // e o da Torre do celeiro (server/src/minijogo-torre.ts)
  torre: chave('A torre do celeiro'),
  // e a Copa do Celeiro, as cinco torres seguidas na sala (20/11/2026): o tempo é a soma
  'copa-do-celeiro': chave('Copa do Celeiro'),
};

export const nomeDaPista = (id: string) => NOMES_DAS_PISTAS[id] ?? id;

/**
 * O nome da pista JÁ TRADUZIDO. "Praia" e "Neve" são também palavras do Desenha e adivinha, e lá a tradução guarda as
 * alternativas aceitas separadas por "|" ("ビーチ|浜辺|砂浜"): o nome da pista é a primeira.
 */
export const nomeDaPistaEm = (t: (texto: string) => string, id: string) => t(nomeDaPista(id)).split('|')[0];
