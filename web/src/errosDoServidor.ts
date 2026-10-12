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
  chave('Espere a sua vez.'),
  chave('Essa casa já está ocupada.'),
  chave('Escolha uma casa do seu lado.'),
  chave('Essa casa está vazia.'),
  chave('Agora não é hora de votar.'),
  chave('Escolha um dos dois.'),
  chave('Sala de voz não encontrada.'),
  chave('Jogo desconhecido.'),
  chave('Entre na sala de voz para jogar com a turma.'),
  chave('Já tem uma partida acontecendo nesta sala.'),
  chave('Só quem começou a partida pode encerrá-la antes do fim.'),
  chave('Os problemas de xadrez não estão no servidor.'),
  chave('Este problema já acabou.'),
  chave('Lance inválido.'),
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
