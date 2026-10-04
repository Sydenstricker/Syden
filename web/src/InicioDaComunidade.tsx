import { Check, Hash, Link2, Mic, Sparkles, Store, Users, X } from 'lucide-react';
import { useState } from 'react';
import { api } from './api';
import { acharArte } from './boasVindas';
import { useCoelho } from './coelho';
import { nomeDeCanal } from './bidi';
import { CommunityIcon } from './CommunityIcon';
import { efeitoDaComunidade, pilhaDaFonte } from './fontesDaComunidade';
import { useT } from './i18n';
import { SeloDaComunidade } from './SeloDaComunidade';
import type { Channel, Community } from './types';
import { CoelhoArte } from './Vila';

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

/**
 * O RECADO DO DONO, LIDO PELO COELHO DE QUEM CHEGA.
 *
 * Antes, o "Início" de uma comunidade mostrava a vila do Syden, com a estátua do coelho no meio — a
 * mesma em toda comunidade, por cima da capa e da letra que o dono escolheu. Destoava, e não dizia
 * nada sobre o lugar. Aqui o coelho é o DE QUEM LÊ (o que a pessoa escolheu em Coelhos), e o que ele
 * diz é o que quem administra escreveu: o mesmo bicho em todas as comunidades, contando as regras de
 * cada uma. É isso que dispensa os canais de "regras" e "faq" que enchem a lista no Discord.
 *
 * Cada linha do recado vira um item. Uma linha só fica como frase; o balão não inventa lista.
 * SEM RECADO, O COELHO SÓ DÁ AS BOAS-VINDAS: ele não tem regra nenhuma para contar, e inventar uma
 * seria a tela afirmando o que não é.
 */
export function CoelhoGuia({ titulo, texto }: { titulo: string; texto: string }) {
  const gordo = useCoelho() === 'big';
  const linhas = texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);
  return (
    <div className="bv-guia">
      <svg className="bv-guia-coelho" viewBox="-19 -43 38 49" aria-hidden="true">
        <CoelhoArte id={0} gordo={gordo} />
      </svg>
      <div className="bv-balao" role="note">
        <strong className="bv-balao-titulo">{titulo}</strong>
        {linhas.length > 1 ? (
          <ol>
            {linhas.map((linha, i) => (
              <li key={i}>{linha}</li>
            ))}
          </ol>
        ) : (
          linhas[0] && <p>{linhas[0]}</p>
        )}
      </div>
    </div>
  );
}

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
  aoAbrirGuardaRoupa,
  aoEditar,
  aoFechar,
}: {
  community: Community;
  dados: DadosDeBoasVindas;
  canais: Channel[];
  quantosMembros: number;
  quantosNaVoz: number;
  aoAbrirCanal: (canal: Channel) => void;
  aoAbrirGuardaRoupa: () => void;
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
          <CommunityIcon community={community} size={56} standalone />
          {/* A letra e o efeito que o dono escolheu, os mesmos da barra lateral: aqui é onde mais aparecem. */}
          <h1
            className="bv-nome"
            style={{ fontFamily: pilhaDaFonte(community.fonte) || undefined }}
            data-efeito={efeitoDaComunidade(community.efeito)}
          >
            {community.name}
            {community.seloTexto && community.seloIcone && community.seloCor && (
              <SeloDaComunidade selo={{ texto: community.seloTexto, icone: community.seloIcone, cor: community.seloCor }} />
            )}
          </h1>
        </div>

        <CoelhoGuia titulo={dados.boasVindas?.titulo || t('Bem-vindo!')} texto={dados.boasVindas?.texto ?? ''} />
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
        {/* DESDE 03/10/2026 TODO MEMBRO RECEBE O CÓDIGO e pode chamar gente (ver
            db.listCommunitiesForUser); trocar o código continua com quem administra. A condição fica
            porque, sem código, o bloco copiaria um link que não leva a lugar nenhum e não dá erro. */}
        {community.inviteCode && (
        <button className="bv-bloco" onClick={copiarConvite}>
          {copiado ? <Check size={26} /> : <Link2 size={26} />}
          <strong>{copiado ? t('Link copiado!') : t('Chamar alguém')}</strong>
          <small>{t('Copia o convite desta comunidade')}</small>
        </button>
        )}

        <button className="bv-bloco" onClick={aoAbrirGuardaRoupa}>
          <Store size={26} />
          <strong>{t('Guarda-roupa')}</strong>
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
