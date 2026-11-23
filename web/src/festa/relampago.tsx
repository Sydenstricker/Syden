import { useEffect, useRef, useState } from 'react';
import { chave, useT } from '../i18n';
import { tocar } from '../somDosJogos';
import { microjogoDaTela, Moldura, useRelogio, useTeclas, type PropsDoMicro } from './comum';

/**
 * QUIZ RELÂMPAGO (05/11/2026, server/src/festa/relampago.ts): cinco perguntas sobre o Syden e a horta, três respostas cada.
 * Responde-se uma vez por pergunta (clique, toque ou as teclas 1, 2 e 3); a certa aparece quando o tempo dela acaba.
 *
 * AS PERGUNTAS SÃO NOSSAS, e a ORDEM DESTA LISTA É A DO SERVIDOR (CERTAS, lá, diz qual das três é a certa; o teste confere que
 * as duas listas têm o mesmo tamanho). Pergunta nova: no fim desta lista e da de lá, nunca no meio. Curtas, sem pegadinha, e
 * nada que só uma cultura saiba.
 */
export const PERGUNTAS: { p: string; o: [string, string, string] }[] = [
  { p: chave('Qual destes cresce debaixo da terra?'), o: [chave('Maçã'), chave('Cenoura'), chave('Cereja')] },
  { p: chave('Quantas orelhas tem um coelho?'), o: [chave('Duas'), chave('Três'), chave('Quatro')] },
  { p: chave('O que o mascote do Syden veste?'), o: [chave('Armadura'), chave('Terno'), chave('Moletom')] },
  { p: chave('Qual destes é uma ferramenta da horta?'), o: [chave('Travesseiro'), chave('Regador'), chave('Guarda-chuva')] },
  { p: chave('Do que uma planta precisa para crescer?'), o: [chave('Água e sol'), chave('Sal e areia'), chave('Leite e mel')] },
  { p: chave('De que cor é a folha da cenoura?'), o: [chave('Azul'), chave('Preta'), chave('Verde')] },
  { p: chave('No quarto, onde o coelho dorme quando a pessoa está ausente?'), o: [chave('Na banheira'), chave('Na cama'), chave('No telhado')] },
  { p: chave('No quarto, o que leva às salas de voz?'), o: [chave('O fone'), chave('O abajur'), chave('O vaso')] },
  { p: chave('No quarto, o que abre os Mini-games?'), o: [chave('A cama'), chave('A janela'), chave('A mesa')] },
  { p: chave('No salão da comunidade, o que abre os Mini-games?'), o: [chave('O fliperama'), chave('A estante'), chave('O balcão')] },
  { p: chave('No salão, a TV leva aonde?'), o: [chave('Ao guarda-roupa'), chave('À sala de voz'), chave('Ao calendário')] },
  { p: chave('Qual destes bichos é uma praga da horta?'), o: [chave('Abelha'), chave('Joaninha'), chave('Lagarta')] },
  { p: chave('Quem ajuda as flores a virar frutos?'), o: [chave('Abelha'), chave('Lagarta'), chave('Lesma')] },
  { p: chave('Quantas patas tem um coelho?'), o: [chave('Duas'), chave('Quatro'), chave('Seis')] },
  { p: chave('O que nasce de uma semente?'), o: [chave('Uma pedra'), chave('Uma nuvem'), chave('Uma planta')] },
  { p: chave('Quantas rodadas tem uma partida da Festa dos coelhos?'), o: [chave('Cinco'), chave('Duas'), chave('Dez')] },
  { p: chave('Em que dia é o aniversário do Syden?'), o: [chave('1º de janeiro'), chave('19 de setembro'), chave('25 de dezembro')] },
  { p: chave('Na Corrida dos coelhos, o kart do mascote parece o quê?'), o: [chave('Um sapato'), chave('Uma banana'), chave('Uma cenoura')] },
  { p: chave('Qual destes é uma fruta vermelha?'), o: [chave('Morango'), chave('Batata'), chave('Cenoura')] },
  { p: chave('Que bicho é o mascote do Syden?'), o: [chave('Gato'), chave('Coelho'), chave('Sapo')] },
  { p: chave('O que a minhoca faz pela horta?'), o: [chave('Come as folhas'), chave('Espanta a chuva'), chave('Afofa a terra')] },
  { p: chave('Qual destes é o mais pesado?'), o: [chave('Uma abóbora'), chave('Uma ervilha'), chave('Um morango')] },
  { p: chave('Quem fica atrás do balcão do salão?'), o: [chave('Um gato'), chave('O coelho do recado'), chave('Ninguém')] },
  { p: chave('O que a estante de troféus do quarto mostra?'), o: [chave('Os livros'), chave('As fotos'), chave('Os pódios dos jogos')] },
  { p: chave('O que um espantalho espanta?'), o: [chave('Os pássaros'), chave('A chuva'), chave('As minhocas')] },
  { p: chave('Quantas patas tem uma aranha?'), o: [chave('Seis'), chave('Oito'), chave('Quatro')] },
  { p: chave('Quantas patas tem um inseto?'), o: [chave('Oito'), chave('Quatro'), chave('Seis')] },
  { p: chave('Na Caça às pragas, o que serve de munição?'), o: [chave('Cenouras'), chave('Pedras'), chave('Bolinhas')] },
  { p: chave('No quarto, o que troca o dia pela noite?'), o: [chave('O tapete'), chave('O abajur'), chave('A planta')] },
  { p: chave('O que dá para fazer com os móveis do seu quarto?'), o: [chave('Vender'), chave('Plantar'), chave('Arrumar como quiser')] },
  // as 120 de conhecimento geral (21/11/2026, o lote D): nossas, sem franquia, nada que só uma cultura saiba
  { p: chave('Qual é o maior planeta do Sistema Solar?'), o: [chave('Marte'), chave('Júpiter'), chave('Vênus')] },
  { p: chave('Qual planeta é conhecido como o planeta vermelho?'), o: [chave('Saturno'), chave('Netuno'), chave('Marte')] },
  { p: chave('Quantos dias tem uma semana?'), o: [chave('Sete'), chave('Cinco'), chave('Dez')] },
  { p: chave('Quantos meses tem um ano?'), o: [chave('Dez'), chave('Doze'), chave('Quatorze')] },
  { p: chave('Qual é o oceano mais extenso do planeta?'), o: [chave('Atlântico'), chave('Índico'), chave('Pacífico')] },
  { p: chave('Qual é o maior animal do mundo?'), o: [chave('Baleia-azul'), chave('Elefante'), chave('Girafa')] },
  { p: chave('Qual destes animais é um mamífero?'), o: [chave('Tubarão'), chave('Golfinho'), chave('Polvo')] },
  { p: chave('Qual destes animais põe ovos?'), o: [chave('Vaca'), chave('Cavalo'), chave('Galinha')] },
  { p: chave('Quantas cores tem o arco-íris, na conta mais comum?'), o: [chave('Sete'), chave('Três'), chave('Doze')] },
  { p: chave('Misturando azul e amarelo, que cor sai?'), o: [chave('Laranja'), chave('Verde'), chave('Roxo')] },
  { p: chave('Misturando vermelho e amarelo, que cor sai?'), o: [chave('Verde'), chave('Azul'), chave('Laranja')] },
  { p: chave('Misturando vermelho e azul, que cor sai?'), o: [chave('Roxo'), chave('Amarelo'), chave('Verde')] },
  { p: chave('Qual destes é um instrumento de corda?'), o: [chave('Tambor'), chave('Violão'), chave('Flauta')] },
  { p: chave('Qual destes é um instrumento de sopro?'), o: [chave('Piano'), chave('Violino'), chave('Flauta')] },
  { p: chave('Que instrumento tem teclas brancas e pretas?'), o: [chave('Piano'), chave('Violão'), chave('Bateria')] },
  { p: chave('Quantos lados tem um triângulo?'), o: [chave('Quatro'), chave('Três'), chave('Cinco')] },
  { p: chave('Quantos lados tem um quadrado?'), o: [chave('Três'), chave('Seis'), chave('Quatro')] },
  { p: chave('Quantos lados tem um hexágono?'), o: [chave('Seis'), chave('Cinco'), chave('Oito')] },
  { p: chave('Qual sólido tem seis faces quadradas?'), o: [chave('Cone'), chave('Cubo'), chave('Cilindro')] },
  { p: chave('Qual é a forma de uma bola?'), o: [chave('Cubo'), chave('Pirâmide'), chave('Esfera')] },
  { p: chave('Qual é o maior deserto quente do mundo?'), o: [chave('Saara'), chave('Atacama'), chave('Gobi')] },
  { p: chave('Em que continente fica o Egito?'), o: [chave('Ásia'), chave('África'), chave('Europa')] },
  { p: chave('Em que continente fica o Japão?'), o: [chave('Europa'), chave('Oceania'), chave('Ásia')] },
  { p: chave('Em que continente fica a Austrália?'), o: [chave('Oceania'), chave('América'), chave('África')] },
  { p: chave('Qual é o continente mais gelado?'), o: [chave('Europa'), chave('Antártida'), chave('África')] },
  { p: chave('Qual é o maior país do mundo em área?'), o: [chave('Brasil'), chave('Japão'), chave('Rússia')] },
  { p: chave('Qual é a montanha mais alta do mundo?'), o: [chave('Everest'), chave('Aconcágua'), chave('Kilimanjaro')] },
  { p: chave('Qual é o rio com mais água do mundo?'), o: [chave('Nilo'), chave('Amazonas'), chave('Danúbio')] },
  { p: chave('Qual é a estrela mais próxima da Terra?'), o: [chave('A Lua'), chave('Marte'), chave('O Sol')] },
  { p: chave('Qual destes é o satélite natural da Terra?'), o: [chave('A Lua'), chave('O Sol'), chave('Vênus')] },
  { p: chave('Quanto tempo a Terra leva para dar uma volta em torno do Sol?'), o: [chave('Um dia'), chave('Um ano'), chave('Um mês')] },
  { p: chave('Quanto tempo a Terra leva para girar em torno de si mesma?'), o: [chave('Um ano'), chave('Uma hora'), chave('Um dia')] },
  { p: chave('Qual planeta fica mais perto do Sol?'), o: [chave('Mercúrio'), chave('Terra'), chave('Júpiter')] },
  { p: chave('Que planeta tem anéis bem visíveis?'), o: [chave('Marte'), chave('Saturno'), chave('Mercúrio')] },
  { p: chave('Que gás as plantas soltam no ar?'), o: [chave('Fumaça'), chave('Hélio'), chave('Oxigênio')] },
  { p: chave('Que gás nós soltamos ao respirar?'), o: [chave('Gás carbônico'), chave('Oxigênio'), chave('Hélio')] },
  { p: chave('O que dá a cor verde às folhas?'), o: [chave('Sal'), chave('Clorofila'), chave('Ferrugem')] },
  { p: chave('Qual órgão bombeia o sangue pelo corpo?'), o: [chave('Pulmão'), chave('Estômago'), chave('Coração')] },
  { p: chave('Com que órgão respiramos?'), o: [chave('Pulmões'), chave('Rins'), chave('Fígado')] },
  { p: chave('Quantos ossos tem o corpo de um adulto?'), o: [chave('106'), chave('206'), chave('306')] },
  { p: chave('Quantos dentes tem um adulto, normalmente?'), o: [chave('20'), chave('44'), chave('32')] },
  { p: chave('Com que parte do corpo sentimos o cheiro?'), o: [chave('Nariz'), chave('Orelha'), chave('Mão')] },
  { p: chave('Qual destes é um sentido do corpo?'), o: [chave('Sono'), chave('Olfato'), chave('Fome')] },
  { p: chave('Que bicho faz teia?'), o: [chave('Formiga'), chave('Borboleta'), chave('Aranha')] },
  { p: chave('Que bicho produz mel?'), o: [chave('Abelha'), chave('Mosca'), chave('Mosquito')] },
  { p: chave('A lagarta vira o quê?'), o: [chave('Besouro'), chave('Borboleta'), chave('Aranha')] },
  { p: chave('O girino vira o quê?'), o: [chave('Peixe'), chave('Lagarto'), chave('Sapo')] },
  { p: chave('Qual destes animais vive no polo sul?'), o: [chave('Pinguim'), chave('Camelo'), chave('Leão')] },
  { p: chave('Qual destes animais tem tromba?'), o: [chave('Rinoceronte'), chave('Elefante'), chave('Hipopótamo')] },
  { p: chave('Qual é o animal terrestre mais rápido?'), o: [chave('Leão'), chave('Cavalo'), chave('Guepardo')] },
  { p: chave('Qual destes animais tem o pescoço mais comprido?'), o: [chave('Girafa'), chave('Zebra'), chave('Camelo')] },
  { p: chave('Qual destes animais é um réptil?'), o: [chave('Sapo'), chave('Tartaruga'), chave('Golfinho')] },
  { p: chave('Qual destes animais é um peixe?'), o: [chave('Baleia'), chave('Golfinho'), chave('Tubarão')] },
  { p: chave('Qual destes animais não voa?'), o: [chave('Pinguim'), chave('Pardal'), chave('Morcego')] },
  { p: chave('Qual destes é um mamífero que voa?'), o: [chave('Pardal'), chave('Morcego'), chave('Abelha')] },
  { p: chave('Que animal tem listras pretas e brancas?'), o: [chave('Tigre'), chave('Panda'), chave('Zebra')] },
  { p: chave('Quantos braços tem um polvo?'), o: [chave('Oito'), chave('Seis'), chave('Dez')] },
  { p: chave('O que as vacas comem?'), o: [chave('Carne'), chave('Capim'), chave('Peixe')] },
  { p: chave('Qual destes animais dá lã?'), o: [chave('Porco'), chave('Galinha'), chave('Ovelha')] },
  { p: chave('Qual é o filhote do cavalo?'), o: [chave('Potro'), chave('Bezerro'), chave('Cordeiro')] },
  { p: chave('Qual é o filhote da vaca?'), o: [chave('Potro'), chave('Bezerro'), chave('Leitão')] },
  { p: chave('Qual é o filhote da ovelha?'), o: [chave('Cabrito'), chave('Potro'), chave('Cordeiro')] },
  { p: chave('Que animal carrega a casa nas costas?'), o: [chave('Caracol'), chave('Coelho'), chave('Sapo')] },
  { p: chave('Qual destes animais hiberna no inverno?'), o: [chave('Cavalo'), chave('Urso'), chave('Galinha')] },
  { p: chave('Qual destes animais é noturno?'), o: [chave('Galinha'), chave('Borboleta'), chave('Coruja')] },
  { p: chave('Qual destes é um inseto?'), o: [chave('Formiga'), chave('Aranha'), chave('Minhoca')] },
  { p: chave('Quantas asas tem uma borboleta?'), o: [chave('Duas'), chave('Quatro'), chave('Seis')] },
  { p: chave('Onde vivem as abelhas?'), o: [chave('No formigueiro'), chave('Na toca'), chave('Na colmeia')] },
  { p: chave('Onde vivem as formigas?'), o: [chave('No formigueiro'), chave('Na colmeia'), chave('No aquário')] },
  { p: chave('Qual destes animais tem casco duro?'), o: [chave('Coelho'), chave('Tartaruga'), chave('Cobra')] },
  { p: chave('A cobra é um animal de que grupo?'), o: [chave('Mamífero'), chave('Inseto'), chave('Réptil')] },
  { p: chave('Qual destes animais vive em água doce?'), o: [chave('Carpa'), chave('Tubarão'), chave('Baleia')] },
  { p: chave('De que planta vem o chocolate?'), o: [chave('Café'), chave('Cacau'), chave('Cana')] },
  { p: chave('Qual é o ingrediente principal do pão?'), o: [chave('Arroz'), chave('Feijão'), chave('Farinha')] },
  { p: chave('Qual destes animais dá leite?'), o: [chave('Vaca'), chave('Galinha'), chave('Peixe')] },
  { p: chave('Que fruta é amarela e comprida?'), o: [chave('Uva'), chave('Banana'), chave('Kiwi')] },
  { p: chave('Qual destas frutas tem um caroço grande?'), o: [chave('Uva'), chave('Morango'), chave('Manga')] },
  { p: chave('Qual destas é uma fruta cítrica?'), o: [chave('Laranja'), chave('Banana'), chave('Maçã')] },
  { p: chave('Que fruta é a base do guacamole?'), o: [chave('Manga'), chave('Abacate'), chave('Mamão')] },
  { p: chave('Qual destes legumes é verde?'), o: [chave('Cenoura'), chave('Beterraba'), chave('Brócolis')] },
  { p: chave('De que cor fica a banana madura?'), o: [chave('Amarela'), chave('Azul'), chave('Roxa')] },
  { p: chave('Onde se guarda o sorvete para não derreter?'), o: [chave('No forno'), chave('No congelador'), chave('Na janela')] },
  { p: chave('Qual destes é um esporte com bola?'), o: [chave('Natação'), chave('Corrida'), chave('Basquete')] },
  { p: chave('Quantos jogadores um time de futebol tem em campo?'), o: [chave('Onze'), chave('Sete'), chave('Cinco')] },
  { p: chave('Em que esporte se usa uma raquete?'), o: [chave('Futebol'), chave('Partida de tênis'), chave('Natação')] }, // a palavra tênis sozinha é o calçado (o objeto do Tamanho)
  { p: chave('Em que esporte a bola passa por cima de uma rede alta, com as mãos?'), o: [chave('Golfe'), chave('Hóquei'), chave('Vôlei')] },
  { p: chave('Quantos minutos tem uma hora?'), o: [chave('Sessenta'), chave('Cem'), chave('Trinta')] },
  { p: chave('Quantos segundos tem um minuto?'), o: [chave('Cem'), chave('Sessenta'), chave('Dez')] },
  { p: chave('Quantas horas tem um dia?'), o: [chave('Doze'), chave('Trinta'), chave('Vinte e quatro')] },
  { p: chave('Quantos anos tem um século?'), o: [chave('Cem'), chave('Mil'), chave('Dez')] },
  { p: chave('Quantos anos tem uma década?'), o: [chave('Cem'), chave('Dez'), chave('Cinco')] },
  { p: chave('Qual é o mês mais curto do ano?'), o: [chave('Abril'), chave('Dezembro'), chave('Fevereiro')] },
  { p: chave('Quantos dias tem um ano que não é bissexto?'), o: [chave('365'), chave('300'), chave('400')] },
  { p: chave('Quanto é metade de dez?'), o: [chave('Dois'), chave('Cinco'), chave('Vinte')] },
  { p: chave('Quanto é o dobro de seis?'), o: [chave('Oito'), chave('Dezesseis'), chave('Doze')] },
  { p: chave('Quanto é sete vezes oito?'), o: [chave('56'), chave('54'), chave('64')] },
  { p: chave('Quanto é três mais quatro?'), o: [chave('Seis'), chave('Sete'), chave('Oito')] },
  { p: chave('Quanto é dez menos três?'), o: [chave('Seis'), chave('Treze'), chave('Sete')] },
  { p: chave('Qual destes números é par?'), o: [chave('Oito'), chave('Sete'), chave('Três')] },
  { p: chave('Qual destes números é ímpar?'), o: [chave('Quatro'), chave('Nove'), chave('Dez')] },
  { p: chave('Quantos centímetros tem um metro?'), o: [chave('Dez'), chave('Mil'), chave('Cem')] },
  { p: chave('Quantos gramas tem um quilo?'), o: [chave('Mil'), chave('Cem'), chave('Dez')] },
  { p: chave('Qual destes é um meio de transporte que anda na água?'), o: [chave('Trem'), chave('Barco'), chave('Avião')] },
  { p: chave('O que um termômetro mede?'), o: [chave('Peso'), chave('Distância'), chave('Temperatura')] },
  { p: chave('O que uma balança mede?'), o: [chave('Peso'), chave('Tempo'), chave('Calor')] },
  { p: chave('Para onde aponta a agulha da bússola?'), o: [chave('Para o chão'), chave('Para o norte'), chave('Para o Sol')] },
  { p: chave('De que lado o Sol nasce?'), o: [chave('Oeste'), chave('Sul'), chave('Leste')] },
  { p: chave('Qual é a estação mais fria do ano?'), o: [chave('Inverno'), chave('Verão'), chave('Primavera')] },
  { p: chave('Em que estação as flores costumam se abrir?'), o: [chave('Inverno'), chave('Primavera'), chave('Outono')] },
  { p: chave('Em que estação as folhas de muitas árvores caem?'), o: [chave('Primavera'), chave('Verão'), chave('Outono')] },
  { p: chave('De que é feito o gelo?'), o: [chave('Água'), chave('Sal'), chave('Vidro')] },
  { p: chave('O que acontece com o gelo no sol?'), o: [chave('Cresce'), chave('Derrete'), chave('Endurece')] },
  { p: chave('Qual destes é atraído por um ímã?'), o: [chave('Madeira'), chave('Plástico'), chave('Ferro')] },
  { p: chave('Qual destes é um metal?'), o: [chave('Cobre'), chave('Algodão'), chave('Borracha')] },
  { p: chave('O que sai de um vulcão?'), o: [chave('Neve'), chave('Lava'), chave('Areia')] },
  { p: chave('De que são feitas as nuvens?'), o: [chave('Fumaça'), chave('Algodão'), chave('Gotinhas de água')] },
  { p: chave('O que se vê antes de ouvir o trovão?'), o: [chave('O relâmpago'), chave('O arco-íris'), chave('A neve')] },
  { p: chave('O que se usa para ver as estrelas de perto?'), o: [chave('Microscópio'), chave('Telescópio'), chave('Termômetro')] },
  { p: chave('O que se usa para ver coisas muito pequenas?'), o: [chave('Telescópio'), chave('Binóculo'), chave('Microscópio')] },
  { p: chave('Qual destes é o mais leve?'), o: [chave('Uma pena'), chave('Uma pedra'), chave('Um tijolo')] },
];

// Os mesmos números do servidor.
const PERGUNTA_MS = 4000;
const ESPERA_MS = 900;
const MOSTRA_MS = 1000;
const PASSO_MS = PERGUNTA_MS + ESPERA_MS + MOSTRA_MS;

interface Dados {
  perguntas?: { q: number; ordem: number[] }[];
  certas?: (number | null)[];
}

const CORES = ['#e07a2e', '#6fa356', '#5b8fc9'];

function Relampago({ dados, inicio, ativo, lance }: PropsDoMicro<Dados>) {
  const t = useT();
  const perguntas = dados.perguntas ?? [];
  const certas = dados.certas ?? [];
  const [minhas, setMinhas] = useState<Map<number, number>>(new Map());
  const agora = useRelogio(ativo);
  const e = agora - inicio;
  const k = Math.max(0, Math.min(perguntas.length - 1, Math.floor(e / PASSO_MS)));
  const dentro = e - k * PASSO_MS;
  const aberta = e >= 0 && dentro < PERGUNTA_MS;
  const pergunta = perguntas[k];
  const texto = pergunta ? PERGUNTAS[pergunta.q] : undefined;
  const certa = certas[k] ?? null;
  const minha = minhas.get(k);
  const acertos = [...minhas].filter(([i, o]) => certas[i] !== null && certas[i] !== undefined && certas[i] === o).length;

  // o som da certa, quando ela chega
  const ouvida = useRef(-1);
  useEffect(() => {
    if (certa === null || ouvida.current === k || minha === undefined) return;
    ouvida.current = k;
    tocar(minha === certa ? 'acerto' : 'erro');
  }, [certa, k, minha]);

  const responder = (opcao: number) => {
    if (!ativo || !aberta || minhas.has(k)) return;
    setMinhas((m) => new Map(m).set(k, opcao));
    tocar('clique');
    lance({ k, opcao, ms: Math.round(dentro) });
  };
  useTeclas(ativo, (ev) => {
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1 || n > 3) return false;
    responder(n - 1);
    return true;
  });

  return (
    <Moldura placar={`✔ × ${acertos}`} fracao={aberta ? dentro / PERGUNTA_MS : 1}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px', width: 'min(92vw, 420px)' }}>
        {/* as bolinhas: uma por pergunta, verde ou vermelha depois que a certa saiu */}
        <div aria-hidden="true" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {perguntas.map((_, i) => {
            const c = certas[i];
            const m = minhas.get(i);
            const cor = c === null || c === undefined ? (i === k ? '#f2c46a' : '#8a7a6a55') : m === c ? '#6fa356' : '#d9534f';
            return <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: cor, display: 'inline-block' }} />;
          })}
        </div>
        {texto && (
          <>
            <p style={{ fontSize: '1.15em', fontWeight: 700, textAlign: 'center', margin: '6px 4px', minHeight: '2.6em' }}>{t(texto.p)}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {pergunta!.ordem.map((o, pos) => {
                const escolhida = minha === pos;
                const ehCerta = certa === pos;
                const fundo = certa !== null ? (ehCerta ? '#6fa356' : escolhida ? '#d9534f' : '#8a7a6a33') : escolhida ? '#f2c46a' : 'transparent';
                return (
                  <button
                    key={pos}
                    type="button"
                    disabled={!ativo || !aberta || minha !== undefined}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      responder(pos);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `3px solid ${CORES[pos]}`,
                      background: fundo,
                      color: fundo === 'transparent' || fundo === '#8a7a6a33' ? 'inherit' : '#2a2320',
                      font: 'inherit',
                      fontSize: '1.05em',
                      textAlign: 'start',
                      opacity: certa !== null && !ehCerta && !escolhida ? 0.55 : 1,
                      cursor: ativo && aberta && minha === undefined ? 'pointer' : 'default',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{ background: CORES[pos], color: '#fff', borderRadius: 6, minWidth: 26, textAlign: 'center', fontWeight: 700 }}
                    >
                      {pos + 1}
                    </span>
                    <span>{t(texto.o[o])}</span>
                    {certa !== null && ehCerta && <span aria-hidden="true" style={{ marginInlineStart: 'auto' }}>✔</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {/* fechada e esperando a certa: a ampulheta */}
        <div aria-hidden="true" style={{ textAlign: 'center', minHeight: '1.4em', fontSize: '1.2em' }}>
          {!aberta && certa === null && e >= 0 ? '⏳' : ''}
        </div>
      </div>
    </Moldura>
  );
}

export default microjogoDaTela({
  id: 'relampago',
  nome: chave('Quiz relâmpago'),
  dica: chave('Escolha a resposta certa antes que o tempo acabe.'),
  Tela: Relampago,
  valor: (v) => `✔ × ${v}`,
  errouComValor: true,
});
