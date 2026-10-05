import { Component, type ReactNode } from 'react';
import { esconderAbertura } from './abertura';
import { useT } from './i18n';
import { Mascote } from './Mascote';

/**
 * A tela de quando o próprio Syden quebra ao desenhar alguma coisa.
 *
 * Antes não existia: um erro no meio do React deixava a tela INTEIRA em branco, sem dizer nada — o pior
 * tipo de falha, a que não conta que falhou. Agora aparece o mascote do erro 500, o do servidor em cima
 * da cabeça, que diz o que importa a quem está do outro lado: o problema é nosso, não seu.
 *
 * O formato é o das telas de erro (ver CLAUDE.md): o código e a descrição, no idioma da pessoa, e um
 * caminho de volta — aqui, recarregar, que é o que resolve quase sempre.
 *
 * A captura do erro precisa ser um componente de CLASSE (é o único jeito que o React oferece), mas o
 * que aparece na tela é um componente de função, com o useT(). Isso importa: o dicionário do idioma
 * chega DEPOIS de o app começar, e uma quebra logo na abertura acontecia antes dele. Com o t() solto,
 * a tela ficava em português para sempre; com o useT(), ela se redesenha quando o idioma chega.
 */
export class ErroGeral extends Component<{ children: ReactNode }, { quebrou: boolean }> {
  state = { quebrou: false };

  static getDerivedStateFromError() {
    return { quebrou: true };
  }

  componentDidCatch(erro: unknown) {
    console.error('O Syden quebrou ao desenhar:', erro);
    // Se a quebra veio antes de o app ter o que mostrar, a abertura continuaria por cima de tudo
    // (ela fica acima até das janelas) e esconderia esta tela.
    esconderAbertura();
  }

  render() {
    if (!this.state.quebrou) return this.props.children;
    return <TelaDoErro />;
  }
}

function TelaDoErro() {
  const t = useT();
  return (
    <div className="erro-geral" role="alert">
      <Mascote nome="erro-500" tamanho={220} />
      <p className="erro-geral-codigo">{t('ERRO — Algo deu errado do nosso lado')}</p>
      <h1>{t('O Syden travou')}</h1>
      <p>{t('Não foi nada que você fez. Recarregar costuma resolver.')}</p>
      <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
        {t('Recarregar')}
      </button>
    </div>
  );
}
