import { Gamepad2, Hash, Link2, Mic, Sparkles, Store, X } from 'lucide-react';
import { useState } from 'react';
import { api } from './api';
import balcaoUrl from './assets/salao/balcao.png';
import { acharArte } from './boasVindas';
import { nomeDeCanal } from './bidi';
import { CommunityIcon } from './CommunityIcon';
import { efeitoDaComunidade, pilhaDaFonte } from './fontesDaComunidade';
import { useT } from './i18n';
import { pedirParaAbrirAoEntrar } from './minijogos';
import { Salao, type AcoesDoSalao } from './Salao';
import { SeloDaComunidade } from './SeloDaComunidade';
import type { Channel, Community, VoiceMember } from './types';

// A PRIMEIRA COISA QUE ALGUÉM VÊ AO ENTRAR NUMA COMUNIDADE.
//
// Antes, entrar era cair numa lista de canais — correto e frio, como chegar numa casa e ver só o
// corredor. Depois virou uma vitrine em vetor com blocos grandes. DESDE 12/10/2026 É O SALÃO (pedido do
// Sydenstricker: o início da comunidade ainda era vetor, e o quarto já era pixel art): o quarto é de cada
// um, o salão é da turma. Os blocos viraram objetos do salão (ver Salao.tsx), e o salão enche com quem
// está na call agora.

/**
 * O RECADO DO DONO, LIDO PELO COELHO DO BALCÃO.
 *
 * Quem administra escreve; o coelho que recebe no salão conta. É isso que dispensa os canais de "regras" e
 * "faq" que enchem a lista no Discord. Cada linha do recado vira um item; uma linha só fica como frase.
 * SEM RECADO, O COELHO SÓ DÁ AS BOAS-VINDAS: inventar uma regra seria a tela afirmando o que não é.
 */
export function RecadoDoBalcao({ titulo, texto }: { titulo: string; texto: string }) {
  const linhas = texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);
  return (
    <div className="bv-guia">
      <span className="bv-guia-balconista" style={{ backgroundImage: `url(${balcaoUrl})` }} aria-hidden="true" />
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
  naVoz,
  aoAbrirCanal,
  aoAbrirGuardaRoupa,
  aoEditar,
  aoFechar,
}: {
  community: Community;
  dados: DadosDeBoasVindas;
  canais: Channel[];
  quantosMembros: number;
  /** Quem está nas salas de voz desta comunidade agora: é quem enche o salão. */
  naVoz: VoiceMember[];
  aoAbrirCanal: (canal: Channel) => void;
  aoAbrirGuardaRoupa: () => void;
  aoEditar: () => void;
  aoFechar: () => void;
}) {
  const t = useT();
  const [copiado, setCopiado] = useState(false);
  const arte = acharArte(dados.boasVindas?.arte);

  const primeiroTexto = canais.find((c) => c.type === 'text');
  // A sala de voz para onde a TV e o fliperama levam: a que tem gente, se houver; senão, a primeira.
  const comGente = canais.find((c) => c.type === 'voice' && naVoz.some((m) => m.channelId === c.id));
  const salaDeVoz = comGente ?? canais.find((c) => c.type === 'voice');

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

  /**
   * Fechar marca como visto no servidor. O pedido não é esperado e a falha é ignorada de propósito: se a
   * marcação não chegar, o pior que acontece é a tela abrir de novo da próxima vez.
   */
  function fechar() {
    void api(`/api/communities/${community.id}/boas-vindas/visto`, { method: 'POST' }).catch(() => {});
    aoFechar();
  }

  const naChamada =
    naVoz.length > 0 ? t('{n} na chamada agora', { n: naVoz.length }) : t('Ninguém na chamada — seja o primeiro');

  // Cada objeto com função. O mesmo conjunto vira, embaixo do salão, uma fileira de atalhos em texto: no
  // celular não há "passar o mouse", e quem não reconhece a TV como sala de voz também chega.
  const acoes: AcoesDoSalao = {
    ...(salaDeVoz && {
      tv: { rotulo: t('Entrar na voz'), sub: naChamada, onClick: () => aoAbrirCanal(salaDeVoz) },
      fliperama: {
        rotulo: t('Mini-games'),
        sub: t('Na sala de voz, com a turma'),
        onClick: () => {
          pedirParaAbrirAoEntrar(salaDeVoz.id);
          aoAbrirCanal(salaDeVoz);
        },
      },
    }),
    ...(primeiroTexto && {
      estante: { rotulo: t('Entrar na conversa'), sub: nomeDeCanal(primeiroTexto.name, true), onClick: () => aoAbrirCanal(primeiroTexto) },
    }),
    // DESDE 03/10/2026 TODO MEMBRO RECEBE O CÓDIGO e pode chamar gente; sem código, a janela copiaria um link
    // que não leva a lugar nenhum e não dá erro.
    ...(community.inviteCode && {
      janela: {
        rotulo: copiado ? t('Link copiado!') : t('Chamar alguém'),
        sub: t('Copia o convite desta comunidade'),
        onClick: () => void copiarConvite(),
      },
    }),
    balcao: { rotulo: t('Guarda-roupa'), sub: t('Tudo de graça, sempre'), onClick: aoAbrirGuardaRoupa },
    ...(dados.podeEditar && {
      quadro: {
        rotulo: dados.boasVindas ? t('Mudar esta tela') : t('Montar esta tela'),
        sub: t('Só quem administra vê este bloco'),
        onClick: aoEditar,
      },
    }),
  };

  const atalhos: { id: keyof AcoesDoSalao; icone: React.ReactNode }[] = [
    { id: 'tv', icone: <Mic size={16} /> },
    { id: 'fliperama', icone: <Gamepad2 size={16} /> },
    { id: 'estante', icone: <Hash size={16} /> },
    { id: 'janela', icone: <Link2 size={16} /> },
    { id: 'balcao', icone: <Store size={16} /> },
    { id: 'quadro', icone: <Sparkles size={16} /> },
  ];

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
        <p className="bv-moradores">
          {t('{n} pessoas nesta comunidade', { n: quantosMembros })} · {naChamada}
        </p>

        <Salao acoes={acoes} naCall={naVoz.map((m) => m.username)} quadro={<CommunityIcon community={community} size={40} standalone />} />

        <RecadoDoBalcao titulo={dados.boasVindas?.titulo || t('Bem-vindo!')} texto={dados.boasVindas?.texto ?? ''} />
      </div>

      <div className="bv-atalhos">
        {atalhos.map(({ id, icone }) => {
          const acao = acoes[id];
          if (!acao) return null;
          return (
            <button key={id} className={`bv-atalho${id === 'quadro' ? ' bv-bloco-dono' : ''}`} onClick={acao.onClick}>
              {copiado && id === 'janela' ? <Link2 size={16} /> : icone}
              <span>{acao.rotulo}</span>
            </button>
          );
        })}
      </div>

      <button className="bv-pular" onClick={fechar}>
        {t('Ir para os canais')}
      </button>
    </div>
  );
}
