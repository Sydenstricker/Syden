import { chave } from './i18n';

// ===================================================================================================
// AS MENSAGENS DE ERRO DO SERVIDOR QUE JÁ ESTÃO TRADUZIDAS.
//
// O servidor tem ~197 mensagens de erro, e TODAS chegam à tela pelo mesmo caminho: `api.ts` as passa
// por `t()` ao construir o ApiError. Quem ainda não estiver nos dicionários sai em português, que é a
// reserva de sempre — então traduzir o resto é trabalho que pode ser feito aos poucos.
//
// ESTE ARQUIVO NÃO É USADO POR NENHUMA TELA, e isso é de propósito. Ele existe por duas razões:
//
//   1. A VARREDURA SÓ OLHA `web/src`. As frases moram em `server/src`, então, sem esta lista, as
//      traduções delas apareceriam como ÓRFÃS nos 25 dicionários — e o teste que protege contra
//      tradução de texto que não existe mais acusaria as 20 de uma vez. O `chave()` as declara.
//   2. É A LISTA DO QUE FOI FEITO. Sem ela, descobrir quais das 197 já têm tradução exigiria abrir
//      25 dicionários e comparar.
//
// O teste em web/test/errosDoServidor.test.ts confere que cada uma destas frases AINDA EXISTE,
// palavra por palavra, em server/src. Reescrever uma mensagem no servidor sem mexer aqui deixaria a
// tradução pendurada e a tela voltaria ao português — calada, e só para quem não fala português.
// ===================================================================================================

export const ERROS_TRADUZIDOS = [
  // o futebol dos coelhos (server/src/minijogo-futebol.ts, 05/11/2026; o segundo também é da Briga)
  chave('Partida inválida.'),
  chave('Ninguém para jogar.'),
  // Tocas e Torres (server/src/minijogo-tocas.ts, 05/11/2026)
  chave('Este jogo não se joga na sala.'),
  // a montagem da frota na Batalha naval (server/src/minijogo-naval.ts, 05/11/2026)
  chave('Sua frota já está pronta.'),
  chave('Ponha todos os navios antes.'),
  chave('Escolha um navio.'),
  chave('O navio não cabe aí.'),
  chave('Os navios não podem encostar um no outro.'),
  // os clássicos de mesa (server/src/minijogo-damas.ts, -naval, -domino, -truco; 04/11/2026)
  chave('Escolha uma casa do mar.'),
  chave('Você já atirou nessa casa.'),
  chave('Já atiraram no seu mar: a frota não muda mais.'),
  chave('Esse lance não vale.'),
  chave('Esse lance não vale mais.'),
  chave('O truco é jogado em 2 ou em 4.'),
  chave('Não há mão de onze agora.'),
  chave('Quem decide a mão de onze é quem tem 11.'),
  chave('Não há pedido de truco agora.'),
  chave('Quem responde é o outro lado.'),
  chave('Não dá para aumentar mais.'),
  chave('Espere a resposta do truco.'),
  chave('Agora não dá para pedir truco.'),
  chave('Essa carta não está na sua mão.'),
  chave('A carta coberta só vale da segunda rodada em diante.'),
  chave('Espere a próxima mão.'),
  chave('Você tem uma pedra que serve.'),
  chave('Não há pedras para comprar.'),
  chave('Compre uma pedra antes de passar.'),
  chave('Essa pedra não está na sua mão.'),
  chave('A primeira pedra é outra.'),
  chave('Essa pedra não encaixa na mesa.'),
  chave('Escolha a ponta.'),
  chave('Essa pedra não encaixa nessa ponta.'),
  // a Caça às pragas da horta (server/src/minijogo-caca.ts, 04/11/2026)
  chave('Tiro inválido.'),
  chave('Acabou a munição desta onda.'),
  // o avatar por link (server/src/buscarImagem.ts, 04/11/2026)
  chave('Essa página não tem uma imagem para usar. Copie o link da imagem.'),
  chave('Muitos links seguidos. Tente de novo daqui a pouco.'),
  // as figurinhas (server/src/figurinhas-routes.ts, 04/11/2026)
  chave('Figurinha não encontrada.'),
  chave('A sua coleção de figurinhas está cheia. Tire alguma para pôr outra.'),
  // Cidades à venda (server/src/minijogo-cidades.ts, 04/11/2026)
  chave('Dinheiro insuficiente.'),
  chave('A troca está vazia.'),
  chave('Essa cidade não é de quem a troca diz.'),
  chave('Venda os prédios do grupo antes de trocar.'),
  chave('Essa cidade não é sua.'),
  chave('Só se constrói em cidade.'),
  chave('Para construir, é preciso ter todas as cidades do grupo.'),
  chave('Resgate as cidades hipotecadas do grupo antes de construir.'),
  chave('Essa cidade já tem o máximo de prédios.'),
  chave('Essa cidade não tem prédio.'),
  chave('Essa cidade já está hipotecada.'),
  chave('Venda os prédios do grupo antes de hipotecar.'),
  chave('Essa cidade não está hipotecada.'),
  chave('Não há leilão agora.'),
  chave('O lance precisa ser maior que o atual.'),
  chave('Não há troca agora.'),
  chave('Essa troca não é com você.'),
  chave('Chega de trocas nesta vez.'),
  // a corrida dos coelhos, a estante de troféus e quem visita o quarto (auditoria de 03/11/2026)
  chave('Corrida inválida.'),
  chave('Muitas corridas seguidas. Tente de novo daqui a pouco.'),
  chave('A corrida não está andando.'),
  chave('A corrida está andando.'),
  chave('Você não está nesta corrida.'),
  chave('Pista desconhecida.'),
  chave('Fantasma não encontrado.'),
  chave('Esse troféu não é seu.'),
  chave('Convide alguém da sua lista de amigos.'),
  chave('Antes dos 18, o quarto abre só para amigos e convidados.'),
  chave('Escolha até 6 para o destaque.'),
  chave('Cabem até 100 convidados.'),
  chave('Este quarto não está aberto para visita.'),
  chave('A senha está incorreta.'),
  chave('A senha atual está incorreta.'),
  chave('A senha precisa ter pelo menos 6 caracteres.'),
  chave('A nova senha precisa ter pelo menos 6 caracteres.'),
  chave('Esse nome de usuário já está em uso.'),
  chave('Escreva um e-mail válido: é por ele que você confirma a conta.'),
  chave('Falta confirmar o seu e-mail. Abra o link que enviamos para entrar.'),
  chave('Código de convite inválido.'),
  chave('Pessoa não encontrada.'),
  chave('Canal não encontrado.'),
  chave('Conversa não encontrada.'),
  chave('Não foi possível entrar nesta chamada.'),
  chave('Comunidade não encontrada.'),
  chave('Mensagem vazia.'),
  chave('Mensagem longa demais.'),
  chave('Sessão inválida. Entre novamente.'),
  chave('Você não participa desta comunidade.'),
  chave('Arquivo não encontrado.'),
  chave('Esta comunidade já está cheia.'),
  chave('Não achei o áudio dessa página. No MyInstants, copie o link do botão de baixar e cole aqui.'),
  chave('Esse endereço não é de um arquivo de áudio.'),
  // Os mini-games da sala de voz (12/10/2026).
  chave('Faltam letras para sortear.'),
  chave('A rodada já parou.'),
  chave('Respostas inválidas.'),
  chave('Agora não é hora de conferir.'),
  chave('Resposta não encontrada.'),
  chave('Não dá para contestar a própria resposta.'),
  chave('Ação desconhecida.'),
  chave('A partida acabou.'),
  chave('Essa casa não está livre.'),
  chave('Escolha um número de 1 a 9.'),
  chave('A mesa já está cheia.'),
  chave('Você já está na mesa.'),
  chave('Você não está jogando.'),
  chave('A partida não está em andamento.'),
  chave('Você está assistindo esta partida.'),
  chave('A partida ainda não começou.'),
  chave('A partida já começou.'),
  chave('Só quem começou dá a largada.'),
  chave('Ainda falta gente para começar.'),
  chave('Espere a sua vez.'),
  chave('Essa casa já está ocupada.'),
  chave('Escolha uma casa do seu lado.'),
  chave('Essa casa está vazia.'),
  chave('Agora não é hora de votar.'),
  chave('Sala de voz não encontrada.'),
  chave('Jogo desconhecido.'),
  chave('Entre na sala de voz para jogar com a turma.'),
  chave('Já tem uma partida acontecendo nesta sala.'),
  chave('Só quem começou a partida pode encerrá-la antes do fim.'),
  chave('Os problemas de xadrez não estão no servidor.'),
  chave('Este problema já acabou.'),
  chave('Lance inválido.'),
  chave('Escreva uma palavra de 5 letras.'),
  chave('Essa palavra não está na lista.'),
  chave('Esta rodada já acabou.'),
  chave('Este prato não é o pedido.'),
  chave('O Lobisomem precisa de pelo menos 4 pessoas na sala.'),
  chave('Esta partida começou sem você. Espere a próxima.'),
  chave('Quem saiu do jogo só assiste.'),
  chave('Agora não é noite.'),
  chave('Escolha alguém que ainda está no jogo.'),
  chave('Escolha alguém que não é lobisomem.'),
  chave('Escolha outra pessoa.'),
  chave('Quem é da vila dorme à noite.'),
  chave('A votação é de dia.'),
  chave('O desenho precisa de pelo menos 2 pessoas na sala.'),
  chave('Agora não é hora de escolher.'),
  chave('Quem escolhe a palavra é quem vai desenhar.'),
  chave('Escolha uma das três palavras.'),
  chave('Agora não é hora de chutar.'),
  chave('Quem desenha não chuta.'),
  chave('Só quem desenha mexe no desenho.'),
  // Tickets e cargos automáticos (pacote MEE6, 12/10/2026).
  chave('Só quem administra a comunidade liga os tickets.'),
  chave('Esta comunidade não usa tickets.'),
  chave('Diga em poucas palavras qual é o assunto.'),
  chave('Ainda não há quem atenda os tickets nesta comunidade.'),
  chave('Ticket não encontrado.'),
  chave('Só quem abriu o ticket ou quem administra pode encerrá-lo.'),
  chave('Só quem administra a comunidade mexe nos cargos automáticos.'),
  chave('Escolha um canal de texto da comunidade.'),
  chave('Um dos emojis não vale.'),
  chave('Um dos cargos não existe.'),
  chave('Cada emoji só pode dar um cargo.'),
  chave('Painel não encontrado.'),
  // A proteção de crianças e adolescentes (17/10/2026): são lidas justamente por adolescentes e pelos responsáveis.
  chave('O Syden é para quem tem 13 anos ou mais.'),
  chave('Escreva a sua data de nascimento.'),
  chave('A sua data de nascimento já foi informada. Para corrigir, escreva para contato@syden.chat.'),
  chave('Por segurança, menores de idade conversam no particular só com amigos.'),
  chave('Por segurança, a prévia das transmissões fica fechada para menores de idade.'),
  chave('Conte em poucas palavras por que a decisão deve mudar (de 10 a 2000 caracteres).'),
  chave('Só contas de menores de idade se ligam a um responsável.'),
  chave('A sua conta já está ligada a um responsável.'),
  chave('Limite inválido: de 15 minutos a 24 horas.'),
  chave('Só um adulto pode ser o responsável por outra conta.'),
  chave('Confirme que você é o pai, a mãe ou o responsável legal.'),
  chave('Código não encontrado ou vencido. Peça um novo.'),
  chave('Você não pode ser o seu próprio responsável.'),
  chave('Esta conta já está ligada a um responsável.'),
  chave('Sua conta tem uma pendência. Abra o Syden de novo para ver o que fazer.'),
  chave('Transmissão não encontrada.'),
] as const;

/**
 * E ESTAS DUAS NÃO SÃO DO SERVIDOR — são do próprio site, lançadas em `api.ts` quando a rede falha
 * ou estoura o prazo. Ficam numa lista à parte porque o guarda de web/test/errosDoServidor.test.ts
 * procura cada frase dentro de `server/src`, e procurá-las lá daria falha para sempre.
 *
 * A separação não é burocracia: foi o próprio guarda que a encontrou, quando acusou as duas como
 * "traduzidas mas não existem mais no servidor". Elas nunca estiveram lá.
 */
export const ERROS_DO_SITE = [
  chave('Não foi possível falar com o servidor.'),
  chave('O servidor demorou demais para responder. Tente de novo.'),
] as const;
