/**
 * Freio de tentativas: segura quem bate muitas vezes na mesma porta em pouco tempo.
 *
 * Existe por dois motivos, e o segundo é o mais grave. O primeiro é o óbvio: sem freio, dá para tentar
 * senha atrás de senha até acertar. O segundo é que conferir uma senha custa caro de propósito (o scrypt
 * leva ~0,1 s para que adivinhar seja lento), então uma enxurrada de tentativas ocupa o servidor inteiro
 * e a voz de quem está em chamada começa a engasgar. O freio corta isso antes de a conta cara acontecer.
 *
 * É uma janela fixa por chave, guardada na memória deste processo: some se o servidor reinicia e não é
 * compartilhada entre máquinas. Para um servidor só, que é o caso, isso basta e não precisa de Redis.
 */

type Registro = { tentativas: number; expiraEm: number };

/** Acima disto, vale o custo de varrer o mapa procurando registros vencidos. */
const FAXINA_ACIMA_DE = 5_000;

export class Freio {
  private readonly registros = new Map<string, Registro>();

  constructor(
    private readonly limite: number,
    private readonly janelaMs: number,
  ) {}

  /**
   * Conta mais uma tentativa para esta chave.
   * Devolve 0 se pode seguir, ou quantos segundos faltam até liberar.
   */
  tentar(chave: string, agora = Date.now()): number {
    if (this.registros.size > FAXINA_ACIMA_DE) this.faxina(agora);

    const registro = this.registros.get(chave);
    if (!registro || registro.expiraEm <= agora) {
      this.registros.set(chave, { tentativas: 1, expiraEm: agora + this.janelaMs });
      return 0;
    }

    registro.tentativas += 1;
    if (registro.tentativas <= this.limite) return 0;
    return Math.max(1, Math.ceil((registro.expiraEm - agora) / 1000));
  }

  /**
   * Só olha, sem contar: quantos segundos faltam para esta chave poder tentar de novo (0 = pode).
   * Serve para o freio de conta, que conta apenas os erros de senha — quem acerta de primeira não gasta
   * tentativa nenhuma, e ninguém fica trancado do lado de fora por ter entrado direito muitas vezes.
   */
  bloqueado(chave: string, agora = Date.now()): number {
    const registro = this.registros.get(chave);
    // Aqui é ">= limite", não "> limite": quem já gastou as tentativas permitidas está bloqueado AGORA,
    // e não depois de gastar mais uma. Quem chama `bloqueado` pergunta antes de deixar tentar.
    if (!registro || registro.expiraEm <= agora || registro.tentativas < this.limite) return 0;
    return Math.max(1, Math.ceil((registro.expiraEm - agora) / 1000));
  }

  /** Esquece as tentativas desta chave. Chamado quando a pessoa acerta: quem sabe a senha não é atacante. */
  liberar(chave: string) {
    this.registros.delete(chave);
  }

  /** Quantas tentativas esta chave já gastou na janela atual (usado nos testes e no diagnóstico). */
  gastas(chave: string, agora = Date.now()): number {
    const registro = this.registros.get(chave);
    return !registro || registro.expiraEm <= agora ? 0 : registro.tentativas;
  }

  private faxina(agora: number) {
    for (const [chave, registro] of this.registros) if (registro.expiraEm <= agora) this.registros.delete(chave);
  }
}
