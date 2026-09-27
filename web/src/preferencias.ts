import { api } from './api';

/**
 * As preferências que seguem a pessoa, e as que ficam no aparelho.
 *
 * Antes disto, tudo vivia só no `localStorage`: trocar de navegador, formatar a máquina ou sair do
 * site para o aplicativo zerava tema, idioma, volumes e anotações. E não havia aviso nenhum — a
 * pessoa só chegava do outro lado e encontrava um Syden que não a conhecia.
 *
 * ---------------------------------------------------------------------------------------------------
 * A REGRA DA DIVISÃO: o que identifica a PESSOA sobe; o que identifica um APARELHO fica.
 *
 * Os ids de microfone, alto-falante e câmera são o caso claro do segundo grupo. O id do microfone
 * desta máquina não existe na outra, e subi-lo faria o Syden tentar usar um dispositivo ausente —
 * trocando um incômodo pequeno (reconfigurar uma vez) por um grande (entrar mudo na chamada sem
 * entender por quê). O mesmo vale para o que é estado da sessão, como a última comunidade aberta.
 *
 * AS ANOTAÇÕES SOBEM, e isso foi decidido com os olhos abertos. Elas se perdiam na troca de navegador
 * e servem para apurar uma denúncia. Mas uma anotação é sobre OUTRA PESSOA, que não sabe que ela
 * existe: deixa de morar no computador de quem escreveu e passa a ficar guardada no servidor. A
 * política de privacidade foi corrigida junto, e ela continuar verdadeira é a condição para isto
 * existir. Se um dia a decisão mudar, tira-se daqui e de lá, no mesmo dia.
 */
export const CHAVES_QUE_SOBEM = [
  /** Tema, sons, efeitos, qualidade da transmissão — o grosso das configurações. */
  'janja.settings',
  'syden.coelho',
  'syden.idioma',
  'syden.status',
  /** Volume que você ajustou de cada pessoa, e quem você silenciou só para você. */
  'syden.volumes',
  'syden.localMutes',
  'syden.screenVolumes',
  /** As anotações sobre outras pessoas. Ver o aviso acima. */
  'syden.notas',
] as const;

/**
 * O que NÃO sobe, escrito para poder ser conferido — e para que acrescentar uma chave nova ao
 * armazenamento obrigue a decidir de que lado ela fica, em vez de virar omissão por esquecimento.
 */
export const CHAVES_QUE_FICAM = [
  /** Ids de dispositivo moram dentro de janja.settings e são retirados na hora de subir. */
  'audioInput',
  'audioOutput',
  'videoInput',
  /** Estado de navegação: onde eu estava. Não é preferência, é onde parei nesta máquina. */
  'syden.community',
  'syden.view',
  'syden.lidas',
  'syden.mencoes',
  'syden.novidades',
  'syden.recentEmojis',
  'syden.entrada-social',
  /** As cenouras da vila são uma brincadeira desta máquina. */
  'syden.cenouras',
] as const;

/** Campos de dentro de janja.settings que são do aparelho e não viajam. */
const DO_APARELHO = ['audioInput', 'audioOutput', 'videoInput'] as const;

type Pacote = Record<string, unknown>;

function lerLocal(chave: string): unknown {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto === null ? undefined : JSON.parse(bruto);
  } catch {
    // Chave que não é JSON (ou armazenamento bloqueado): não sobe, e não atrapalha o resto.
    return undefined;
  }
}

function escreverLocal(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento, vale só até fechar — como já era antes.
  }
}

/** Monta o pacote a subir, tirando o que é do aparelho. */
export function montar(ler: (chave: string) => unknown = lerLocal): Pacote {
  const pacote: Pacote = {};
  for (const chave of CHAVES_QUE_SOBEM) {
    const valor = ler(chave);
    if (valor === undefined) continue;
    if (chave === 'janja.settings' && valor && typeof valor === 'object') {
      const copia = { ...(valor as Record<string, unknown>) };
      for (const campo of DO_APARELHO) delete copia[campo];
      pacote[chave] = copia;
      continue;
    }
    pacote[chave] = valor;
  }
  return pacote;
}

/**
 * Aplica o que veio do servidor por cima do que está aqui.
 *
 * Os campos do aparelho são PRESERVADOS: o tema vem do servidor, mas o microfone continua sendo o
 * desta máquina. Sem isso, entrar no Syden num computador novo apagaria a escolha de microfone que a
 * pessoa acabou de fazer nele.
 */
export function aplicar(
  pacote: Pacote,
  ler: (chave: string) => unknown = lerLocal,
  escrever: (chave: string, valor: unknown) => void = escreverLocal,
) {
  for (const chave of CHAVES_QUE_SOBEM) {
    const vindo = pacote[chave];
    if (vindo === undefined) continue;
    if (chave === 'janja.settings' && vindo && typeof vindo === 'object') {
      const aqui = (ler(chave) ?? {}) as Record<string, unknown>;
      const junto = { ...(vindo as Record<string, unknown>) };
      for (const campo of DO_APARELHO) if (aqui[campo] !== undefined) junto[campo] = aqui[campo];
      escrever(chave, junto);
      continue;
    }
    escrever(chave, vindo);
  }
}

/**
 * Ao entrar: o servidor manda, se tiver algo guardado.
 *
 * A regra é simples de propósito, porque a alternativa não é. Juntar dois lados pela data de
 * alteração exigiria registrar quando cada preferência mudou, e erraria de qualquer jeito quando
 * alguém mexesse nas duas máquinas. Assim: quem tem conta e já guardou, recebe o que guardou — que é
 * exatamente o que faz a troca de navegador funcionar. Quem nunca guardou manda o que tem aqui para
 * cima, e a partir daí passa a ter.
 *
 * Devolve `true` quando algo foi aplicado, para a tela poder se redesenhar.
 */
export async function sincronizarAoEntrar(): Promise<boolean> {
  try {
    const { preferencias, em } = await api<{ preferencias: Pacote; em: string | null }>('/api/me/preferencias');
    if (em && Object.keys(preferencias).length > 0) {
      aplicar(preferencias);
      return true;
    }
    await api('/api/me/preferencias', { method: 'PUT', body: montar() });
    return false;
  } catch {
    // Servidor fora do ar não pode impedir ninguém de usar o Syden: vale o que está nesta máquina.
    return false;
  }
}

/**
 * Guarda no servidor, esperando as mudanças pararem.
 *
 * Sem a espera, arrastar o controle de volume mandaria um pedido por pixel. O atraso é generoso de
 * propósito: preferência não tem pressa, e perder os últimos dois segundos por um fechar de janela
 * custa muito menos do que um pedido a cada gesto.
 */
const ESPERA_MS = 2000;
let relogio: ReturnType<typeof setTimeout> | null = null;

export function guardarEmBreve() {
  if (relogio) clearTimeout(relogio);
  relogio = setTimeout(() => {
    relogio = null;
    api('/api/me/preferencias', { method: 'PUT', body: montar() }).catch(() => {
      // Falhou agora, vai na próxima mudança. Não vale incomodar ninguém com isso.
    });
  }, ESPERA_MS);
}
