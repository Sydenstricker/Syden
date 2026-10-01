import { Check, Hash, Link2, Mic, Sparkles, Store, Users, X } from 'lucide-react';
import { useState } from 'react';
import { api } from './api';
import { acharArte } from './boasVindas';
import { nomeDeCanal } from './bidi';
import { CommunityIcon } from './CommunityIcon';
import { useT } from './i18n';
import { SeloDaComunidade } from './SeloDaComunidade';
import type { Channel, Community } from './types';

// A PRIMEIRA COISA QUE ALGUÉM VÊ AO ENTRAR NUMA COMUNIDADE.
//
// Antes, entrar era cair numa lista de canais — correto e frio, como chegar numa casa e ver só o
// corredor. Aqui a comunidade tem cara: uma arte grande, o que o dono quis dizer, e blocos que apontam
// o que fazer primeiro.
//
// O DESENHO É DE PAINÉIS GRANDES, e não de lista, de propósito. A referência que ele deu foi a loja do
// Warzone, e o que faz aquilo funcionar não é o brilho: é que cada coisa é um alvo grande, com uma
// palavra curta e uma imagem que diz o que é. Lista de texto obriga a LER para escolher; painel grande
// deixa ESCOLHER e só depois ler. Para quem acabou de entrar e não conhece nada, a diferença é enorme.

export interface DadosDeBoasVindas {
  boasVindas: { titulo: string; texto: string; arte: string } | null;
  podeEditar: boolean;
  jaViu: boolean;
}

export function InicioDaComunidade({
  community,
  dados,
  canais,
  quantosMembros,
  quantosNaVoz,
  aoAbrirCanal,
  aoAbrirLoja,
  aoEditar,
  aoFechar,
}: {
  community: Community;
  dados: DadosDeBoasVindas;
  canais: Channel[];
  quantosMembros: number;
  quantosNaVoz: number;
  aoAbrirCanal: (canal: Channel) => void;
  aoAbrirLoja: () => void;
  aoEditar: () => void;
  aoFechar: () => void;
}) {
  const t = useT();
  const [copiado, setCopiado] = useState(false);
  const arte = acharArte(dados.boasVindas?.arte);

  const primeiroTexto = canais.find((c) => c.type === 'text');
  const primeiraVoz = canais.find((c) => c.type === 'voice');

  /**
   * Fechar marca como visto no servidor.
   *
   * O pedido não é esperado (sem await) e a falha dele é ignorada de propósito: se a marcação não
   * chegar, o pior que acontece é a tela abrir de novo da próxima vez. Travar a saída de uma tela de
   * boas-vindas por causa de internet ruim seria trocar um incômodo pequeno por um grande.
   */
  /** Copia o link de convite. O aviso de "copiado" some sozinho: confirmação que fica vira enfeite. */
  async function copiarConvite() {
    const endereco = `${window.location.origin}/app/?convite=${community.inviteCode}`;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Navegador sem permissão de área de transferência: não há o que fazer, e travar a tela por
      // causa disso seria pior do que o botão não responder.
    }
  }

  function fechar() {
    void api(`/api/communities/${community.id}/boas-vindas/visto`, { method: 'POST' }).catch(() => {});
    aoFechar();
  }

  return (
    <div className="bv" data-tom={arte.tom} style={{ '--bv-destaque': arte.destaque } as React.CSSProperties}>
      <div className="bv-arte" style={{ background: arte.fundo }}>
        {/* As faixas diagonais são o que dá o ar de vitrine sem custar imagem nenhuma. */}
        <div className="bv-faixas" aria-hidden="true" />

        <button className="bv-fechar" onClick={fechar} aria-label={t('Fechar')} title={t('Fechar')}>
          <X size={20} />
        </button>

        <div className="bv-cabeca">
          <CommunityIcon community={community} size={72} />
          <div>
            <h1>{dados.boasVindas?.titulo || t('Bem-vindo!')}</h1>
            <p className="bv-nome">
              {community.name}
              {community.seloTexto && community.seloIcone && community.seloCor && (
                <SeloDaComunidade selo={{ texto: community.seloTexto, icone: community.seloIcone, cor: community.seloCor }} />
              )}
            </p>
          </div>
        </div>

        {dados.boasVindas?.texto && <p className="bv-recado">{dados.boasVindas.texto}</p>}
      </div>

      <div className="bv-blocos">
        {primeiroTexto && (
          <button className="bv-bloco" onClick={() => aoAbrirCanal(primeiroTexto)}>
            <Hash size={26} />
            <strong>{t('Entrar na conversa')}</strong>
            <small>{nomeDeCanal(primeiroTexto.name, true)}</small>
          </button>
        )}

        {primeiraVoz && (
          <button className="bv-bloco" onClick={() => aoAbrirCanal(primeiraVoz)}>
            <Mic size={26} />
            <strong>{t('Entrar na voz')}</strong>
            <small>
              {quantosNaVoz > 0
                ? t('{n} na chamada agora', { n: quantosNaVoz })
                : t('Ninguém na chamada — seja o primeiro')}
            </small>
          </button>
        )}

        <div className="bv-bloco bv-bloco-parado">
          <Users size={26} />
          <strong>{t('Quem mora aqui')}</strong>
          <small>{t('{n} pessoas nesta comunidade', { n: quantosMembros })}</small>
        </div>

        {/* CONVIDAR, e não karaokê como eu tinha posto primeiro: o karaokê só existe dentro de uma
            chamada, e um bloco que não leva a lugar nenhum é pior do que bloco nenhum. Convidar é a
            ação que mais faz sentido numa tela de boas-vindas — quem acabou de entrar costuma querer
            trazer alguém junto. */}
        {/* O CÓDIGO DE CONVITE SÓ CHEGA A QUEM ADMINISTRA (ver db.listCommunitiesForUser), e é a regra
            certa — está nos termos: "só quem administra pode convidar gente nova". Sem esta condição o
            bloco apareceria para todo mundo e copiaria um link sem código, que não leva a lugar nenhum
            e não dá erro. */}
        {community.inviteCode && (
        <button className="bv-bloco" onClick={copiarConvite}>
          {copiado ? <Check size={26} /> : <Link2 size={26} />}
          <strong>{copiado ? t('Link copiado!') : t('Chamar alguém')}</strong>
          <small>{t('Copia o convite desta comunidade')}</small>
        </button>
        )}

        <button className="bv-bloco" onClick={aoAbrirLoja}>
          <Store size={26} />
          <strong>{t('Loja')}</strong>
          <small>{t('Tudo de graça, sempre')}</small>
        </button>

        {dados.podeEditar && (
          <button className="bv-bloco bv-bloco-dono" onClick={aoEditar}>
            <Sparkles size={26} />
            <strong>{dados.boasVindas ? t('Mudar esta tela') : t('Montar esta tela')}</strong>
            <small>{t('Só quem administra vê este bloco')}</small>
          </button>
        )}
      </div>

      <button className="bv-pular" onClick={fechar}>
        {t('Ir para os canais')}
      </button>
    </div>
  );
}
