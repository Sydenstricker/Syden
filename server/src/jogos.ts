/**
 * O menu de servidores de jogos de uma comunidade: Minecraft, Palworld, Valheim, ARK, o que for.
 *
 * O problema que isto resolve é bobo e real: o endereço do servidor de Minecraft vive perdido numa
 * mensagem de três semanas atrás, e toda vez que alguém entra no grupo a mesma pergunta volta. Aqui ele
 * fica num lugar fixo, com o jogo, a senha (quando tem) e o que precisa saber para entrar.
 *
 * **O Syden NÃO hospeda nem conversa com esses servidores.** Ele guarda e mostra o endereço, como uma
 * agenda. Isso é decisão, não preguiça: falar com servidor de jogo significaria abrir conexão de saída
 * para endereço que qualquer membro digitou, e é assim que se constrói, sem querer, uma máquina de
 * bater em endereço dos outros a partir do nosso IP.
 */

export interface ServidorDeJogo {
  id: number;
  communityId: number;
  /** Como a turma chama ("O survival do Léo"). */
  nome: string;
  /** O jogo, em texto livre: são muitos, e uma lista fechada envelheceria em um mês. */
  jogo: string;
  /** Endereço de entrada, do jeito que se cola no jogo. */
  endereco: string;
  /** Senha de entrada, quando tem. Vê quem é da comunidade — como veria na mensagem fixada. */
  senha: string | null;
  /** Versão, modpack, regras da casa, o que for. */
  observacao: string | null;
  createdBy: number;
  createdAt: string;
}

export type NovoServidor = Pick<ServidorDeJogo, 'nome' | 'jogo' | 'endereco' | 'senha' | 'observacao'>;

const LIMITES = { nome: 60, jogo: 40, endereco: 120, senha: 60, observacao: 300 };

/**
 * Lê o que veio da tela. Devolve o servidor pronto ou a queixa, em português, para mostrar no formulário.
 *
 * O endereço é guardado como TEXTO e nada mais: não se resolve DNS, não se testa conexão, não se abre
 * nada. Ver o comentário no alto do arquivo.
 */
export function lerServidor(corpo: unknown): { servidor: NovoServidor } | { erro: string } {
  const c = corpo as Partial<Record<string, unknown>> | null;

  const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');
  const nome = texto(c?.nome);
  const jogo = texto(c?.jogo);
  const endereco = texto(c?.endereco);
  const senha = texto(c?.senha);
  const observacao = texto(c?.observacao);

  if (nome.length < 2) return { erro: 'Dê um nome ao servidor.' };
  if (nome.length > LIMITES.nome) return { erro: `O nome precisa caber em ${LIMITES.nome} letras.` };
  if (jogo.length < 2) return { erro: 'Diga que jogo é.' };
  if (jogo.length > LIMITES.jogo) return { erro: `O nome do jogo precisa caber em ${LIMITES.jogo} letras.` };
  if (endereco.length < 3) return { erro: 'Escreva o endereço de entrada.' };
  if (endereco.length > LIMITES.endereco) return { erro: `O endereço precisa caber em ${LIMITES.endereco} letras.` };
  if (senha.length > LIMITES.senha) return { erro: `A senha precisa caber em ${LIMITES.senha} letras.` };
  if (observacao.length > LIMITES.observacao) return { erro: `A observação precisa caber em ${LIMITES.observacao} letras.` };

  // O endereço vai aparecer numa tela e é copiável com um clique. Uma quebra de linha ou um caractere
  // de controle no meio dele não serve para nada e é o começo de todo truque de colar coisa escondida.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(endereco)) return { erro: 'O endereço tem caracteres que não dá para usar.' };

  return { servidor: { nome, jogo, endereco, senha: senha || null, observacao: observacao || null } };
}

/**
 * Quantos servidores uma comunidade pode cadastrar.
 *
 * Existe porque a lista é escrita por gente e lida por todo mundo: sem teto, uma comunidade com
 * quinhentos servidores viraria uma tela que ninguém consegue usar e uma resposta grande à toa em
 * toda abertura. Vinte é bem mais do que qualquer turma de amigos vai ter.
 */
export const TETO_POR_COMUNIDADE = 20;
