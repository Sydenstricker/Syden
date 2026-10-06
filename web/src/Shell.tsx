import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import { UserX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Socket, io } from 'socket.io-client';
import { API_URL, ApiError, api, loadToken } from './api';
import { carregarBloqueios, guardarBloqueados } from './bloqueios';
import { Avatar } from './Avatar';
import { Comemoracao } from './Comemoracao';
import { CommunityDialog, CommunityRail } from './CommunityRail';
import { isolar, nomeDeCanal } from './bidi';
import { desktopBridge } from './desktop';
import { aplicarComunidade, buscarComunidade, clearDirectory, loadDirectory, syncDirectory, useDirectory } from './directory';
import { ligarDigitacao } from './digitando';
import { EmptyCommunities } from './EmptyCommunities';
import { Home } from './Home';
import { lugarDaBarra } from './lugarDaBarra';
import { InicioDaComunidade, type DadosDeBoasVindas } from './InicioDaComunidade';
import { ServidoresDeJogo } from './ServidoresDeJogo';
import { Ranking } from './Ranking';
import { TelaDeAmigos } from './TelaDeAmigos';
import { temNovidade } from './changelog';
import { assinar, definirDiretasNaoLidas, limparMencoes, marcarMencao, mencionaVoce } from './aviso-no-icone';
import { countUnread, forgetMissing, markRead, subscribeUnread } from './unread';
import { contaExcluida, DirectList, DirectRailButton, directName } from './DirectList';
import { MemberList } from './MemberList';
import { NewGroupDialog } from './NewGroupDialog';
import { loadMyStatus, saveMyStatus } from './presenceStatus';
import { Revelacao } from './Revelacao';
import { getSettings, updateSettings, useSettings } from './settings';
import { Sidebar } from './Sidebar';
import { TextChannel } from './TextChannel';
import { type SettingsSection, SettingsModal } from './SettingsModal';
import type { Channel, Community, DirectChannel, Message, PresenceEntry, PresenceStatus, User, VoiceMember } from './types';
import { UsageDashboard } from './UsageDashboard';
import { useVoice } from './useVoice';
import { VoiceStage } from './VoiceStage';
import { type AulaEmCurso, guardarAulaEmCurso, lerAulaEmCurso } from './aula';
import { Mascote } from './Mascote';
import { useT, idiomaAtual } from './i18n';

/** Última comunidade aberta, para o app voltar onde a pessoa estava. */
const LAST_COMMUNITY_KEY = 'syden.community';
/** Última tela aberta (início, comunidade ou conversas), pelo mesmo motivo. */
const LAST_VIEW_KEY = 'syden.view';

type View = 'home' | 'community' | 'direct' | 'amigos';

function rememberView(view: View) {
  try {
    localStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    // sem armazenamento: abre na tela inicial da próxima vez, e tudo bem
  }
}

/**
 * Onde o Syden abre: onde a pessoa parou. Só cai na tela inicial quem nunca entrou, quem estava lá, ou
 * quem tem novidade para ver — assim quem só quer conversar não ganha um clique a mais todo dia.
 */
function firstView(): View {
  try {
    const saved = localStorage.getItem(LAST_VIEW_KEY);
    if (temNovidade()) return 'home';
    if (saved === 'community' || saved === 'direct' || saved === 'home') return saved;
  } catch {
    // sem armazenamento
  }
  return 'home';
}

function rememberCommunity(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(LAST_COMMUNITY_KEY);
    else localStorage.setItem(LAST_COMMUNITY_KEY, String(id));
  } catch {
    // navegador sem armazenamento (janela anônima): só não lembra
  }
}

function rememberedCommunity(): number | null {
  try {
    const saved = Number(localStorage.getItem(LAST_COMMUNITY_KEY));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

export function Shell({
  token,
  user: loggedUser,
  pendingInviteCode,
  pendingInviteChannel,
  linkDaAula,
  aoUsarLinkDaAula,
  onLogout,
}: {
  token: string;
  user: User;
  /** Veio de um link de convite (?convite=xxxx): entra nessa comunidade assim que a sessão abre. */
  pendingInviteCode?: string | null;
  /** O link era de uma sala (&canal=ID): depois de entrar na comunidade, abre esse canal. */
  pendingInviteChannel?: number | null;
  /** Veio de um link de aula (?aula=…) já com conta: entra na turma e cai na sala (ver aula.ts). */
  linkDaAula?: string | null;
  aoUsarLinkDaAula?: () => void;
  onLogout: () => void;
}) {
  const t = useT();
  // Os cargos podem mudar com o app aberto (o dono deu ou tirou o de administrador, ou excluiu a conta e outro assumiu).
  const { members } = useDirectory();
  const me = members.get(loggedUser.id);
  const user: User = {
    ...loggedUser,
    isAdmin: me?.isAdmin ?? loggedUser.isAdmin,
    isOwner: me?.isOwner ?? loggedUser.isOwner ?? false,
  };
  const [socket, setSocket] = useState<Socket | null>(null);
  const [online, setOnline] = useState(true);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState<number | null>(rememberedCommunity());
  // A comunidade que está DESENHADA na tela. Só vira a nova quando tudo dela chegou.
  const [visivelId, setVisivelId] = useState<number | null>(communityId);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  // Quem está em chamada, por comunidade: a barra lateral só mostra a da comunidade aberta.
  const [voiceByCommunity, setVoiceByCommunity] = useState<Record<number, VoiceMember[]>>({});
  // As configurações abrem numa aba escolhida: a vila manda direto para os pacotes de sons.
  const [settingsOpen, setSettingsOpen] = useState<SettingsSection | null>(null);
  // "Explorar", na vila, abre a mesma janela de adicionar comunidade da barra lateral.
  const [explorarAberto, setExplorarAberto] = useState(false);
  // Troca de comunidade em andamento: a tela de agora continua no lugar até a nova estar inteira.
  const [trocando, setTrocando] = useState(false);
  // As mensagens do primeiro canal, buscadas junto com o resto para a conversa não chegar atrasada.
  const [preCarregado, setPreCarregado] = useState<{ channelId: number; mensagens: Message[] } | null>(null);
  const preferences = useSettings();
  const [showUsage, setShowUsage] = useState(false);
  // A agenda de servidores de jogo toma o lugar do canal aberto, igual ao painel de uso. Os dois nunca
  // ficam abertos ao mesmo tempo: abrir um fecha o outro.
  // O painel aberto no lugar da conversa: a agenda de servidores de jogo ou o ranking dos níveis.
  const [painel, setPainel] = useState<'jogos' | 'ranking' | null>(null);
  // Ideias suas que o dono acolheu e você ainda não viu comemorar. Cai confete uma de cada vez.
  const [comemorar, setComemorar] = useState<{ id: number; content: string }[]>([]);
  // Itens que você ganhou e ainda não abriu. A tela de destaque mostra um de cada vez, em fila.
  const [porRevelar, setPorRevelar] = useState<string[]>([]);
  // A fila de itens só pode começar depois que se sabe se há festa de ideia acolhida esperando. Sem isso,
  // o presente aparecia e sumia meio segundo depois, quando a resposta da festa chegava.
  const [festasConferidas, setFestasConferidas] = useState(false);
  // Em tela estreita só cabe uma coluna por vez: esta decide se é a lista de canais ou a conversa/chamada
  // que aparece. Em tela larga (a maioria) isto não muda nada — as duas colunas aparecem sempre.
  const [mobileChannels, setMobileChannels] = useState(true);
  // Conversas privadas: a barra lateral troca a lista de canais pela lista de conversas.
  const [view, setView] = useState<View>(firstView);
  const [directs, setDirects] = useState<DirectChannel[]>([]);
  const [directId, setDirectId] = useState<number | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  // Qual conversa está aberta agora, para o aviso de mensagem nova não marcar a bolinha nela.
  const openRef = useRef<number | null>(null);
  const voice = useVoice(socket);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => rememberView(view), [view]);

  // As mensagens pré-carregadas servem uma vez só: depois que a conversa nasceu com elas, apaga a cópia
  // para quem voltar a este canal mais tarde buscar o que chegou nesse meio-tempo.
  useEffect(() => {
    if (preCarregado) setPreCarregado(null);
  }, [preCarregado]);

  // Mensagens não lidas das conversas privadas: a bolinha do ícone de conversas.
  const [unreadTick, setUnreadTick] = useState(0);
  useEffect(() => subscribeUnread(() => setUnreadTick((n) => n + 1)), []);
  // Só depois que a lista chega: com ela vazia (logo ao abrir), a limpeza apagaria tudo o que já foi lido.
  useEffect(() => {
    if (directs.length > 0) forgetMissing(directs.map((c) => c.id));
  }, [directs]);
  const unreadDirects = countUnread(directs);
  void unreadTick; // só para a tela redesenhar quando algo é marcado como lido

  // O número vermelho no ícone do Syden soma o que é dirigido a você: conversas diretas por ler e
  // menções ao seu nome. Aqui entra a parte das diretas; as menções se contam sozinhas ao chegarem.
  useEffect(() => definirDiretasNaoLidas(unreadDirects), [unreadDirects]);
  const [avisosTick, setAvisosTick] = useState(0);
  useEffect(() => assinar(() => setAvisosTick((n) => n + 1)), []);
  void avisosTick;

  /**
   * As menções de um canal somem quando a pessoa está de fato olhando para ele: canal aberto E janela
   * na frente. Não basta o canal estar selecionado — com o Syden minimizado ou em outra aba, a menção
   * tem que continuar acesa, que é justamente quando ela serve para alguma coisa.
   */
  useEffect(() => {
    if (selectedId === null) return;
    const limparSeOlhando = () => {
      if (document.hasFocus() && !document.hidden) limparMencoes(selectedId);
    };
    limparSeOlhando();
    window.addEventListener('focus', limparSeOlhando);
    document.addEventListener('visibilitychange', limparSeOlhando);
    return () => {
      window.removeEventListener('focus', limparSeOlhando);
      document.removeEventListener('visibilitychange', limparSeOlhando);
    };
  }, [selectedId]);
  /**
   * A lista de bloqueados chega ao entrar e se atualiza sozinha.
   *
   * Precisa vir CEDO: se a tela desenhar a conversa antes da lista chegar, a mensagem de quem foi
   * bloqueado pisca na frente da pessoa antes de sumir — que é exatamente o que ela bloqueou para
   * não ver. Por isso o pedido sai no primeiro desenho, sem esperar nada.
   */
  useEffect(() => {
    void carregarBloqueios();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const aoMudar = (lista: { userId: number }[]) => guardarBloqueados(lista.map((b) => b.userId));
    socket.on('bloqueios:mudou', aoMudar);
    return () => {
      socket.off('bloqueios:mudou', aoMudar);
    };
  }, [socket]);

  // A bolinha do logo some assim que a tela inicial é aberta.
  const [novidade, setNovidade] = useState(temNovidade);
  useEffect(() => {
    if (view === 'home') setNovidade(false);
  }, [view]);

  const community = communities.find((c) => c.id === visivelId);

  /**
   * O que vai no lugar da barra lateral agora. A regra mora fora daqui, com a tabela de casos e o
   * histórico dos dois jeitos pelos quais ela já errou: ver web/src/lugarDaBarra.ts.
   */
  const naBarra = lugarDaBarra({
    comunidadeNaTela: Boolean(community),
    listaChegou: !loadingCommunities,
    quantas: communities.length,
  });

  /**
   * O espaço de boas-vindas da comunidade aberta.
   *
   * ELE ABRE SOZINHO UMA VEZ SÓ, e quem decide é o servidor: `jaViu` vem de lá porque a mesma pessoa
   * entrando pelo computador do trabalho não pode receber as boas-vindas de novo. Guardar isso no
   * navegador daria certo até o dia em que alguém trocasse de máquina.
   *
   * Depois disso, a tela continua alcançável pelo botão de início da comunidade — quem quiser rever o
   * recado não precisa apagar nada.
   */
  const [boasVindas, setBoasVindas] = useState<DadosDeBoasVindas | null>(null);
  const [mostrandoBoasVindas, setMostrandoBoasVindas] = useState(false);

  useEffect(() => {
    if (visivelId === null) {
      setBoasVindas(null);
      return;
    }
    let valeu = true;
    void api<DadosDeBoasVindas>(`/api/communities/${visivelId}/boas-vindas`)
      .then((dados) => {
        if (!valeu) return;
        setBoasVindas(dados);
        // Só abre sozinho quando há o que mostrar E a pessoa nunca viu. Comunidade que não montou o
        // espaço continua abrindo direto nos canais, como sempre foi.
        if (dados.boasVindas && !dados.jaViu) setMostrandoBoasVindas(true);
      })
      // Falhar aqui não pode atrapalhar: quem entrou quer conversar, não ver uma tela de aviso.
      .catch(() => {});
    return () => {
      valeu = false;
    };
  }, [visivelId]);
  const openDirect = directs.find((c) => c.id === directId);
  // A conversa privada aberta vira um "canal" para a tela de conversa poder ser a mesma dos canais de texto.
  const directAsChannel: Channel | undefined = openDirect && {
    id: openDirect.id,
    communityId: null,
    name: directName(openDirect, user.id, t),
    type: 'dm',
    position: 0,
    createdBy: openDirect.createdBy,
  };
  openRef.current = view === 'direct' ? directId : null;
  const voiceMembers = visivelId === null ? [] : (voiceByCommunity[visivelId] ?? []);
  const onlineHere = presence.filter((p) => members.has(p.id));
  const myStatus = presence.find((p) => p.id === user.id)?.status ?? loadMyStatus();

  function setMyStatus(status: PresenceStatus) {
    saveMyStatus(status);
    socket?.emit('presence:set', status);
  }

  const reloadCommunities = useCallback(async () => {
    const list = await api<Community[]>('/api/communities');
    setCommunities(list);
    setCommunityId((current) => (list.some((c) => c.id === current) ? current : (list[0]?.id ?? null)));
    setLoadingCommunities(false);
    return list;
  }, []);

  useEffect(() => {
    reloadCommunities().catch(console.error);
  }, [reloadCommunities]);

  useEffect(() => {
    api<DirectChannel[]>('/api/direct').then(setDirects, console.error);
  }, []);

  /** Abre uma conversa privada (vindo da lista ou do menu de alguém) e troca a barra lateral para ela. */
  function openConversation(conversa: DirectChannel) {
    markRead(conversa.id, conversa.lastMessageId);
    setDirects((list) => (list.some((c) => c.id === conversa.id) ? list : [conversa, ...list]));
    setView('direct');
    setDirectId(conversa.id);
    setShowUsage(false);
    setPainel(null);
    setMobileChannels(false);
  }

  /** "Enviar mensagem" no menu de alguém: abre a conversa que já existe, ou começa uma. */
  async function startConversation(userId: number) {
    try {
      openConversation(await api<DirectChannel>('/api/direct', { method: 'POST', body: { userIds: [userId] } }));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  // Chegou por um link de convite (?convite=xxxx): entra nessa comunidade assim que a sessão abre. Quem já
  // participa (ex.: o próprio link de quem convidou) simplesmente não vê nada de diferente.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingInviteCode) return;
    api<Community>('/api/communities/join', { method: 'POST', body: { code: pendingInviteCode } }).then(
      (community) => {
        setNotice(`Você entrou em ${community.name}.`);
        void afterCommunityChange(community).then(() => {
          if (pendingInviteChannel) setIrParaCanal({ communityId: community.id, channelId: pendingInviteChannel });
        });
      },
      async (error) => {
        if (error instanceof ApiError && error.status === 409) {
          // Já participava: nada a avisar. Se o link era de uma sala, vai até ela — a comunidade é a
          // que tem esse código de convite.
          if (!pendingInviteChannel) return;
          const lista = await reloadCommunities().catch(() => null);
          const dela = lista?.find((c) => c.inviteCode === pendingInviteCode);
          if (dela) setIrParaCanal({ communityId: dela.id, channelId: pendingInviteChannel });
          return;
        }
        setNotice((error as Error).message);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviteCode]);

  useEffect(() => {
    // O token é lido a cada tentativa de conexão, e não uma vez só: trocar a senha ou sair dos outros
    // aparelhos emite um token novo, e a reconexão precisa usar o novo, não o que estava aqui guardado.
    const s = io(API_URL, { auth: (pronto) => pronto({ token: loadToken() ?? token }) });
    s.on('connect', () => {
      setOnline(true);
      // O servidor sempre começa te vendo como "online"; se você tinha escolhido outro status, reafirma.
      const saved = loadMyStatus();
      if (saved !== 'online') s.emit('presence:set', saved);
    });
    s.on('disconnect', (reason) => {
      setOnline(false);
      // O servidor só derruba a conexão de propósito quando a conta foi excluída; nos outros casos, reconecta.
      if (reason === 'io server disconnect') {
        api('/api/me').then(
          () => s.connect(),
          (error) => (error instanceof ApiError && error.status === 401 ? onLogoutRef.current() : s.connect()),
        );
      }
    });
    s.on('connect_error', (error) => {
      setOnline(false);
      if (error.message === 'unauthorized') onLogoutRef.current();
    });
    s.on('presence', setPresence);
    // Conversas privadas: entram, mudam de nome/gente ou somem da lista na hora.
    const upsertDirect = (conversa: DirectChannel) =>
      setDirects((list) => [conversa, ...list.filter((c) => c.id !== conversa.id)]);
    s.on('direct:created', upsertDirect);
    s.on('direct:updated', (conversa: DirectChannel) => {
      if (conversa.members) upsertDirect(conversa);
      else void api<DirectChannel[]>('/api/direct').then(setDirects, console.error);
    });
    s.on('direct:removed', ({ id }: { id: number }) => {
      setDirects((list) => list.filter((c) => c.id !== id));
      setDirectId((current) => (current === id ? null : current));
    });
    // Mensagem nova numa conversa privada: atualiza a prévia e sobe ela para o topo da lista.
    s.on('message:new', (message: Message & { communityId: number | null }) => {
      if (message.communityId !== null) return;
      setDirects((list) => {
        const conversa = list.find((c) => c.id === message.channelId);
        if (!conversa) return list;
        const atualizada = {
          ...conversa,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          lastMessageId: message.id,
        };
        if (openRef.current === message.channelId) markRead(message.channelId, message.id);
        return [atualizada, ...list.filter((c) => c.id !== message.channelId)];
      });
    });
    s.on('voice:state', ({ communityId: id, members: list }: { communityId: number; members: VoiceMember[] }) =>
      setVoiceByCommunity((current) => ({ ...current, [id]: list })),
    );
    s.on('channel:created', ({ depoisDe, ...channel }: Channel & { depoisDe?: number }) =>
      setChannels((list) => {
        // Conversa privada não entra na lista de canais da comunidade (ela tem lista própria).
        if (list.some((c) => c.id === channel.id) || channel.communityId === null || !isOpenCommunity(channel.communityId)) return list;
        // A sala temporária entra logo abaixo da sala que a criou (ver server/src/salas-temporarias.ts).
        const origem = depoisDe === undefined ? -1 : list.findIndex((c) => c.id === depoisDe);
        return origem < 0 ? [...list, channel] : [...list.slice(0, origem + 1), channel, ...list.slice(origem + 1)];
      }),
    );
    s.on('channel:updated', (channel: Channel) =>
      setChannels((list) => list.map((c) => (c.id === channel.id ? channel : c))),
    );
    s.on('channel:deleted', ({ id }: { id: number }) => {
      setChannels((list) => list.filter((c) => c.id !== id));
      if (voiceRef.current.channelId === id) voiceRef.current.leave();
    });
    // Nome ou imagem da comunidade mudou (por você ou por outro administrador).
    s.on('community:updated', (updated: Pick<Community, 'id' | 'name' | 'iconVersion' | 'niveisLigados' | 'contadores'>) =>
      setCommunities((list) =>
        list.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                name: updated.name,
                iconVersion: updated.iconVersion,
                // Ligar os níveis faz a entrada do Ranking aparecer para todo mundo, sem recarregar.
                ...(updated.niveisLigados !== undefined ? { niveisLigados: updated.niveisLigados } : {}),
                // E escolher os contadores muda a faixa do alto da lista de todo mundo (ver Contadores.tsx).
                ...(updated.contadores !== undefined ? { contadores: updated.contadores } : {}),
              }
            : c,
        ),
      ),
    );
    // Advertência e silêncio aplicados a você por quem administra: o aviso é só seu (ver ModeracaoDaPessoa.tsx).
    s.on('advertencia', ({ comunidade, motivo }: { communityId: number; comunidade: string; motivo: string }) =>
      setNotice(t('Você recebeu uma advertência em {comunidade}: {motivo}', { comunidade, motivo })),
    );
    s.on('silencio', ({ comunidade, ate }: { communityId: number; comunidade: string; ate: string | null }) =>
      setNotice(
        ate
          ? t('Você está em silêncio em {comunidade} até {hora}.', {
              comunidade,
              hora: new Date(ate).toLocaleString(idiomaAtual(), { dateStyle: 'short', timeStyle: 'short' }),
            })
          : t('Seu silêncio em {comunidade} acabou.', { comunidade }),
      ),
    );
    // O lembrete que você pediu numa mensagem (ver Lembrete.tsx): aviso na faixa e, se o Syden não estiver
    // na frente e as notificações estiverem ligadas, também do sistema — é para isso que se pede lembrete.
    s.on('lembrete', ({ autor, trecho, channelId, communityId }: { autor: string; trecho: string; channelId: number; communityId: number | null }) => {
      const texto = t('Lembrete — {autor}: {trecho}', { autor, trecho });
      setNotice(texto);
      if (document.hasFocus() || !getSettings().notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
      const aviso = new Notification(t('Lembrete'), { body: `${autor}: ${trecho}`, tag: `lembrete-${channelId}` });
      aviso.onclick = () => {
        desktopBridge?.focus();
        window.focus();
        if (communityId !== null) {
          setView('community');
          setCommunityId(communityId);
        }
        setSelectedId(channelId);
        aviso.close();
      };
    });
    // Subiu de nível: o aviso é só seu, na faixa de avisos, e não na conversa dos outros (ver niveis.ts).
    s.on('nivel:subiu', ({ nivel }: { communityId: number; nivel: number }) =>
      setNotice(t('Você chegou ao nível {nivel}!', { nivel })),
    );
    // Quem administra trocou o código: o link de convite de todo mundo passa a ser o novo.
    s.on('community:invite', ({ id, inviteCode }: { id: number; inviteCode: string }) =>
      setCommunities((list) => list.map((c) => (c.id === id ? { ...c, inviteCode } : c))),
    );
    s.on('community:deleted', ({ id }: { id: number }) => setCommunities((list) => list.filter((c) => c.id !== id)));
    // Um administrador te puxou para outra sala de voz: o app entra nela sozinho, como no Discord.
    s.on('voice:move', ({ channelId: to }: { channelId: number }) => {
      setSelectedId(to);
      setShowUsage(false);
      setPainel(null);
      setMobileChannels(false);
      void voiceRef.current.join(to);
    });
    // Removido (ou saiu por outra aba) de uma comunidade: ela some da coluna.
    s.on('member:removed', ({ communityId: id, userId }: { communityId: number; userId: number }) => {
      if (userId === loggedUser.id) setCommunities((list) => list.filter((c) => c.id !== id));
    });
    const unsync = syncDirectory(s);
    const desligarDigitacao = ligarDigitacao(s, loggedUser.id);
    setSocket(s);
    return () => {
      unsync();
      desligarDigitacao();
      s.disconnect();
    };
  }, [token, loggedUser.id]);

  // A comunidade aberta muda: recarrega membros, emojis, sons e canais dela.
  const openCommunityRef = useRef<number | null>(communityId);
  openCommunityRef.current = communityId;
  const isOpenCommunity = (id: number) => openCommunityRef.current === id;

  useEffect(() => {
    rememberCommunity(communityId);
    if (communityId === null) {
      clearDirectory();
      setChannels([]);
      setSelectedId(null);
      setVisivelId(null);
      return;
    }
    setShowUsage(false);
    setPainel(null);
    setMobileChannels(true); // troca de comunidade: mostra a lista de canais dela, não a conversa da anterior

    // Trocar de comunidade é uma troca só: em vez de cada pedaço entrar na tela quando fica pronto
    // (membros, depois canais, depois as mensagens), a tela anterior fica de pé até TUDO chegar, e aí
    // troca de uma vez. São duas idas ao servidor porque as mensagens dependem de saber o canal.
    let cancelado = false;
    setTrocando(true);
    void (async () => {
      try {
        const [dados, lista] = await Promise.all([
          buscarComunidade(communityId),
          api<Channel[]>(`/api/communities/${communityId}/channels`),
        ]);
        const primeiro = lista.find((c) => c.type === 'text');
        const mensagens = primeiro ? await api<Message[]>(`/api/channels/${primeiro.id}/messages`).catch(() => null) : null;
        if (cancelado || openCommunityRef.current !== communityId) return;
        aplicarComunidade(dados);
        setVisivelId(communityId);
        setChannels(lista);
        setSelectedId(primeiro?.id ?? null);
        setPreCarregado(primeiro && mensagens ? { channelId: primeiro.id, mensagens } : null);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelado) setTrocando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [communityId]);

  // Notificação do Windows para mensagens novas de outras pessoas, quando o Syden não está à vista
  // ou a mensagem é de outro canal. Clicar leva direto ao canal.
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: Message & { communityId: number }) => {
      if (message.author.id === loggedUser.id) return;

      // Menção ao seu nome (ou @todos) num canal que você não está olhando: acende o número no ícone.
      // Se você está com o canal aberto e na frente da tela, não há o que avisar — você já está vendo.
      const olhando = document.hasFocus() && !document.hidden && selectedIdRef.current === message.channelId;
      // Só em canal de comunidade: conversa direta já conta como não lida, e contaria duas vezes.
      const emComunidade = message.communityId !== null;
      if (emComunidade && !olhando && mencionaVoce(message.content, loggedUser.username)) marcarMencao(message.channelId);

      notifyMessage(message);
    };
    const notifyMessage = (message: Message & { communityId: number }) => {
      if (!getSettings().notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const here = isOpenCommunity(message.communityId);
      const lookingAtIt = here && document.hasFocus() && !document.hidden && selectedIdRef.current === message.channelId;
      if (lookingAtIt) return;
      const channel = here ? channelsRef.current.find((c) => c.id === message.channelId) : undefined;
      // Mensagem sem texto (só arquivo ou enquete) precisa de uma descrição na notificação.
      const text =
        message.content ||
        (message.poll
          ? t('Enquete: {pergunta}', { pergunta: message.poll.question })
          : message.attachments.length > 0
            ? t('Mandou um arquivo')
            : '');
      // O NOME DO CANAL PASSA POR nomeDeCanal(), e isso vale até aqui. A notificação do Windows é
      // desenhada pelo sistema, com o idioma do Syden dentro dela: em árabe, `#` solto antes de um
      // nome latino ia para o outro lado e o título dizia `combinados#`. Ver web/src/bidi.ts.
      const titulo = t('{quem} em {canal}', {
        quem: isolar(message.author.username),
        canal: channel ? nomeDeCanal(channel.name, channel.type === 'text') : t('um canal'),
      });
      const notification = new Notification(titulo, {
        body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
        tag: `channel-${message.channelId}`, // várias mensagens seguidas do mesmo canal viram uma notificação só
      });
      notification.onclick = () => {
        desktopBridge?.focus();
        window.focus();
        setShowUsage(false);
        setPainel(null);
        setMobileChannels(false);
        setCommunityId(message.communityId);
        setSelectedId(message.channelId);
        notification.close();
      };
    };
    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [socket, loggedUser.id]);

  /**
   * A festa de quando uma ideia sua é acolhida. Ela chega por dois caminhos: pelo aviso ao vivo, se
   * você estiver com o Syden aberto na hora do joinha, e pela lista de pendentes ao entrar — assim
   * quem estava offline também vê o confete, uma vez só.
   */
  useEffect(() => {
    if (!socket) return;
    const aoAcolher = (ideia: { id: number; content: string }) =>
      setComemorar((fila) => (fila.some((i) => i.id === ideia.id) ? fila : [...fila, ideia]));
    socket.on('suggestion:accepted', aoAcolher);
    void api<{ id: number; content: string }[]>('/api/suggestions/celebrations')
      .then((lista) => lista.length > 0 && setComemorar((fila) => [...fila, ...lista.filter((i) => !fila.some((f) => f.id === i.id))]))
      .catch(() => {})
      .finally(() => setFestasConferidas(true));
    return () => {
      socket.off('suggestion:accepted', aoAcolher);
    };
  }, [socket]);

  /**
   * A fila da tela de destaque. É buscada ao abrir o Syden porque é aí que o servidor confere se a pessoa
   * passou a ter direito a alguma insígnia — inclusive uma que ela ganhou enquanto estava com o app fechado.
   */
  useEffect(() => {
    void api<{ code: string }[]>('/api/me/itens/novidades')
      .then((itens) => setPorRevelar(itens.map((item) => item.code)))
      .catch(() => {});
  }, []);

  /**
   * Resgatar tira o item da fila e avisa o servidor, que marca como visto e põe a insígnia na vitrine.
   * Depois relê a comunidade aberta, como a comemoração faz, para a insígnia aparecer no perfil na hora.
   */
  function resgatar(code: string) {
    setPorRevelar((fila) => fila.filter((c) => c !== code));
    void api(`/api/me/itens/${encodeURIComponent(code)}/resgatar`, { method: 'POST' })
      .then(() => {
        if (communityId !== null) void loadDirectory(communityId);
      })
      .catch(() => {});
  }

  /** Fecha o cartão da festa e avisa o servidor, para o confete não cair de novo amanhã. */
  function fecharComemoracao(id: number) {
    setComemorar((fila) => fila.filter((i) => i.id !== id));
    void api(`/api/suggestions/${id}/celebrated`, { method: 'POST' }).catch(() => {});
    // A medalha é contada no perfil de quem teve a ideia: relê a comunidade aberta para ela aparecer
    // na hora, sem precisar recarregar o Syden.
    if (communityId !== null) void loadDirectory(communityId).catch(() => {});
  }

  // Teclas de atalho globais do app de desktop (mudo e ensurdecer), só durante uma chamada.
  useEffect(
    () =>
      desktopBridge?.onShortcut((action) => {
        const current = voiceRef.current;
        if (current.channelId === null) return;
        if (action === 'mute') void current.toggleMute();
        else void current.toggleDeafen();
      }),
    [],
  );

  // O canal aberto foi excluído (por você ou por outra pessoa): volta para o primeiro canal de texto.
  useEffect(() => {
    if (channels.length > 0 && !channels.some((c) => c.id === selectedId)) {
      setSelectedId(channels.find((c) => c.type === 'text')?.id ?? null);
    }
  }, [channels, selectedId]);

  // Painel de consumo é só para administradores; se alguém perder o cargo com ele aberto, a tela volta ao normal.
  /**
   * Modo sessão: assistir junto.
   *
   * Mora no Shell, e não dentro do palco, porque ele muda o LAYOUT DA PÁGINA — o vídeo cresce e a
   * conversa aparece ao lado. Dentro do palco só daria para mexer no que está dentro do palco.
   */
  const [sessao, setSessao] = useState(false);

  /** Onde a sessão conversa: o primeiro canal de texto da comunidade, que é o geral em quase todas. */
  const canalDaSessao = channels.find((c) => c.type === 'text');

  /**
   * A AULA EM ANDAMENTO, e com ela o MODO SALA: só a chamada, a conversa ao lado e a faixa da aula no
   * alto — sem a coluna de comunidades, a lista de canais e a de membros. É o que o aluno que não é de
   * tecnologia precisa ver (pedido do professor de idiomas, 05/10/2026). Quem entrou só para a aula
   * (conta temporária) fica sempre nele; quem tem conta pode sair dele para o Syden inteiro.
   */
  const [aulaEmCurso, setAulaEmCurso] = useState<AulaEmCurso | null>(lerAulaEmCurso);
  const temporario = !!loggedUser.temporarioAte;
  const modoSala = aulaEmCurso !== null || temporario;

  // Com conta, pelo link: vira membro da turma (se ainda não era) e marca a aula para onde ir.
  useEffect(() => {
    if (!linkDaAula) return;
    api<AulaEmCurso>(`/api/aula/${encodeURIComponent(linkDaAula)}/entrar-com-conta`, { method: 'POST' }).then(
      async (destino) => {
        aoUsarLinkDaAula?.();
        guardarAulaEmCurso(destino);
        await reloadCommunities().catch(() => null);
        setAulaEmCurso(destino);
      },
      (error) => {
        aoUsarLinkDaAula?.();
        setNotice((error as Error).message);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkDaAula]);

  // A aula marcada: abre a comunidade, depois a sala, e entra na chamada — uma vez por aula.
  const aulaAplicada = useRef<string | null>(null);
  useEffect(() => {
    if (!aulaEmCurso) return;
    const chave = `${aulaEmCurso.communityId}:${aulaEmCurso.channelId}`;
    if (aulaAplicada.current === chave) return;
    if (communityId !== aulaEmCurso.communityId) {
      setView('community');
      setCommunityId(aulaEmCurso.communityId);
      return;
    }
    if (visivelId !== aulaEmCurso.communityId || !channels.some((c) => c.id === aulaEmCurso.channelId)) return;
    aulaAplicada.current = chave;
    setView('community');
    setSelectedId(aulaEmCurso.channelId);
    setSessao(true);
    if (voice.channelId !== aulaEmCurso.channelId) void voiceRef.current.join(aulaEmCurso.channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulaEmCurso, communityId, visivelId, channels]);

  /**
   * O LINK DE UMA SALA: abre a comunidade, espera os canais dela chegarem e seleciona o canal. Numa sala
   * de voz, ABRE a sala e NÃO entra na chamada: entrar ligaria o microfone de quem só clicou num link,
   * e quem decide falar é a pessoa, no botão de entrar.
   */
  const [irParaCanal, setIrParaCanal] = useState<{ communityId: number; channelId: number } | null>(null);
  useEffect(() => {
    if (!irParaCanal) return;
    if (communityId !== irParaCanal.communityId || view !== 'community') {
      setView('community');
      setCommunityId(irParaCanal.communityId);
      return;
    }
    if (visivelId !== irParaCanal.communityId) return;
    if (!channels.some((c) => c.id === irParaCanal.channelId)) {
      // A LISTA PODE NÃO TER CHEGADO AINDA: numa aba nova, a comunidade lembrada já conta como visível
      // antes de os canais dela virem. Só depois de carregada a ausência quer dizer canal apagado (ou
      // de outra comunidade) — e aí fica na comunidade, sem inventar outro destino.
      if (trocando || channels.length === 0) return;
      setIrParaCanal(null);
      return;
    }
    setSelectedId(irParaCanal.channelId);
    setMobileChannels(false);
    setIrParaCanal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irParaCanal, communityId, visivelId, channels, view, trocando]);

  // A conta temporária sem aula marcada nesta aba (abriu outra aba, por exemplo): a sala dela é a
  // primeira sala de voz da única comunidade que ela tem.
  useEffect(() => {
    if (!temporario || aulaEmCurso || visivelId === null) return;
    const sala = channels.find((c) => c.type === 'voice');
    if (sala) setAulaEmCurso({ communityId: visivelId, channelId: sala.id });
  }, [temporario, aulaEmCurso, visivelId, channels]);


  function sairDaAula() {
    guardarAulaEmCurso(null);
    if (temporario) {
      // A conta temporária não tem o que fazer fora da aula: sai da chamada e da sessão. Ela some
      // sozinha quando o link vencer (ver server/src/aula-routes.ts).
      logout();
      return;
    }
    setAulaEmCurso(null);
    setSessao(false);
  }

  const usageOpen = showUsage && user.isAdmin && view === 'community';
  const jogosOpen = painel === 'jogos' && !usageOpen && view === 'community';
  const rankingOpen = painel === 'ranking' && !usageOpen && view === 'community';
  const selected = usageOpen || jogosOpen || rankingOpen || view !== 'community' ? undefined : channels.find((c) => c.id === selectedId);

  function selectChannel(channel: Channel) {
    setView('community'); // vindo da tela inicial ou de uma conversa privada, volta para a comunidade
    setShowUsage(false);
    setPainel(null);
    // ESCOLHER UM CANAL FECHA A TELA DE BOAS-VINDAS. Quem clica numa sala pediu a sala; deixar o
    // painel de boas-vindas por cima transforma o clique em nada, e o único jeito de sair passa a
    // ser achar o X. Foi assim que ele descobriu: clicou na sala, não saiu.
    setMostrandoBoasVindas(false);
    setSelectedId(channel.id);
    setMobileChannels(false);
    // A sala que cria salas leva para a sala temporária da pessoa: a tela vai junto.
    if (channel.type === 'voice') void voice.join(channel.id).then((sala) => sala !== null && sala !== channel.id && setSelectedId(sala));
  }

  /**
   * "Assistir transmissão" no menu de alguém: abre a sala dela na tela e já abre a transmissão. Quem clicou
   * aqui pediu para ver — seria bobo mostrar o convite "Assistir" de novo do outro lado.
   */
  function watchStream(channelId: number, userId?: number) {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;
    // Sem userId (entrar na sala pela vila, por exemplo) é só entrar; com userId, já abre a transmissão dela.
    if (userId !== undefined) voice.assistir(String(userId), true);
    selectChannel(channel);
  }

  function logout() {
    voice.leave();
    rememberCommunity(null);
    onLogout();
  }

  async function afterCommunityChange(changed: Community | null) {
    const list = await reloadCommunities().catch(() => null);
    if (changed && list?.some((c) => c.id === changed.id)) {
      // Leva PARA a comunidade, e não só a marca: criada pela vila, a barra lateral mostrava a comunidade
      // nova com o #geral marcado enquanto o meio da tela seguia na vila — duas partes da tela afirmando
      // lugares diferentes.
      setView('community');
      setCommunityId(changed.id);
    }
  }

  return (
    <RoomContext.Provider value={voice.room}>
      <div className={`app ${mobileChannels ? 'mobile-channels' : 'mobile-main'}${trocando ? ' trocando' : ''}${modoSala ? ' modo-sala' : ''}`}>
        {/* Enquanto a comunidade nova não chega inteira, uma barrinha avisa que algo está a caminho.
            Ela só aparece depois de um tempinho: numa troca rápida ninguém chega a ver. */}
        {trocando && <span className="troca-barra" aria-hidden="true" />}
        <CommunityRail
          communities={communities}
          currentId={view === 'community' ? communityId : null}
          onSelect={(id) => {
            setView('community');
            setCommunityId(id);
          }}
          onChanged={(created) => void afterCommunityChange(created)}
          onHome={() => {
            setView('home');
            setShowUsage(false);
            setPainel(null);
            setMobileChannels(false);
          }}
          homeActive={view === 'home'}
          homeBadge={view !== 'home' && novidade}
          top={
            communities.length > 0 && (
              <DirectRailButton
                active={view === 'direct'}
                unread={unreadDirects}
                onClick={() => {
                  setView('direct');
                  setShowUsage(false);
                  setPainel(null);
                  setMobileChannels(true);
                }}
              />
            )
          }
        />
        {naBarra === 'barra' && community ? (
          <Sidebar
            user={user}
            online={onlineHere}
            community={community}
            channels={channels}
            selectedId={usageOpen || jogosOpen || rankingOpen ? null : selectedId}
            usageActive={usageOpen}
            jogosActive={jogosOpen}
            rankingActive={rankingOpen}
            arteDaComunidade={boasVindas?.boasVindas?.arte}
            inicioActive={mostrandoBoasVindas}
            // O "Início" da comunidade leva para ELA, venha de onde vier. Antes ele só ligava uma marca:
            // na vila do Syden não mudava nada na tela, e o botão parecia quebrado.
            onOpenInicio={() => {
              setView('community');
              setShowUsage(false);
              setPainel(null);
              setMostrandoBoasVindas(true);
            }}
            onOpenJogos={() => {
              setPainel('jogos');
              setShowUsage(false);
              setMobileChannels(false);
            }}
            onOpenRanking={() => {
              setPainel('ranking');
              setShowUsage(false);
              setMobileChannels(false);
            }}
            voiceMembers={voiceMembers}
            voice={voice}
            myStatus={myStatus}
            onSetStatus={setMyStatus}
            onWatchStream={watchStream}
            onSendMessage={(id) => void startConversation(id)}
            onSelect={selectChannel}
            onOpenUsage={() => {
              setView('community');
              setShowUsage(true);
              setPainel(null);
              setMobileChannels(false);
            }}
            onOpenSettings={() => setSettingsOpen('account')}
            directMode={view === 'direct'}
            directList={
              <DirectList
                conversas={directs}
                selectedId={directId}
                selfId={user.id}
                onSelect={openConversation}
                onNewGroup={() => setNewGroupOpen(true)}
              />
            }
          />
        ) : naBarra === 'esperando' ? (
          /* O espaço guardado, da mesma largura, enquanto a barra não chega — senão a vila salta
             para o lado quando ela entra, e o salto parece travamento. Ver lugarDaBarra.ts. */
          <div className="sidebar sidebar-esperando" aria-hidden="true">
            <span className="esqueleto esqueleto-titulo" />
            <span className="esqueleto" />
            <span className="esqueleto esqueleto-curto" />
            <span className="esqueleto" />
          </div>
        ) : (
          /* Só se chega aqui com a lista na mão e vazia: a frase é sempre verdadeira. */
          (
            <EmptyCommunities
              onDone={(created) => void afterCommunityChange(created)}
              aoAbrirConfiguracoes={() => setSettingsOpen('account')}
              aoSair={onLogout}
            />
          )
        )}
        <main className="main">
          {modoSala && (
            <div className="faixa-aula">
              <Mascote nome="ocioso" tamanho={56} className="faixa-aula-mascote" />
              <span className="faixa-aula-nome">
                <strong>{channels.find((c) => c.id === aulaEmCurso?.channelId)?.name ?? ''}</strong>
                <span>{community?.name ?? ''}</span>
              </span>
              <button type="button" className="btn-secondary" onClick={sairDaAula}>
                {temporario ? t('Sair da aula') : t('Sair do modo sala')}
              </button>
            </div>
          )}
          {!online && <div className="banner">{t('Reconectando ao servidor…')}</div>}
          {notice && (
            <div className="banner" onClick={() => setNotice(null)}>
              {notice} <span className="banner-close">✕</span>
            </div>
          )}
          {voice.error && (
            <div className="banner banner-error" onClick={voice.clearError} role="alert">
              {voice.error} <span className="banner-close">✕</span>
            </div>
          )}
          {view === 'home' && (
            <Home
              comunidade={community?.name}
              salas={channels.filter((c) => c.type === 'voice')}
              naVoz={voiceMembers}
              aoEntrar={watchStream}
              // A LOJA VIROU UMA ABA DAS CONFIGURAÇÕES. Ela era uma tela de topo alcançada pela
              // vila e pela tela de boas-vindas DA COMUNIDADE — e por isso parecia ser da
              // comunidade, embora nunca tenha sido. Agora ela está onde mora o resto do que é seu.
              aoAbrirGuardaRoupa={() => setSettingsOpen('aparencia')}
              aoAbrirAmigos={() => setView('amigos')}
              aoExplorar={() => setExplorarAberto(true)}
              souODono={user.isOwner}
              comunidades={communities}
              vozDeTodas={voiceByCommunity}
              eu={user.id}
              aoIrParaComunidade={(id) => {
                setView('community');
                setCommunityId(id);
              }}
            />
          )}
          {view === 'amigos' && (
            <div className="tela-com-volta">
              <button className="btn-sutil" onClick={() => setView('home')}>
                ← Voltar
              </button>
              {/* Conversar com um amigo abre a conversa privada que já existe: a amizade não inventa
                  um canal novo, só torna a pessoa fácil de achar de novo depois. */}
              <TelaDeAmigos aoConversar={(userId) => void startConversation(userId)} />
            </div>
          )}

          {/* Conversa privada: mesma tela dos canais de texto, só que sem comunidade por trás. */}
          {view === 'direct' && directAsChannel && socket && (
            <>
              {/* QUEM ESTAVA DO OUTRO LADO APAGOU A CONTA, e sem esta linha a conversa fica idêntica
                  a uma em que a pessoa só não respondeu ainda. Quem mandou mensagem ficaria esperando
                  resposta de alguém que não existe mais — foi exatamente o que aconteceu. */}
              {openDirect && contaExcluida(openDirect, user.id) && (
                <p className="conta-excluida" role="status">
                  <UserX size={15} /> {t('Esta pessoa excluiu a conta. As mensagens daqui não chegam a ninguém.')}
                </p>
              )}
              <TextChannel
                key={`dm-${directAsChannel.id}`}
                channel={directAsChannel}
                socket={socket}
                user={user}
                role="member"
                onMobileBack={() => setMobileChannels(true)}
              />
            </>
          )}
          {view === 'direct' && !directAsChannel && (
            <div className="empty">{t('Escolha uma conversa à esquerda, ou comece uma nova.')}</div>
          )}
          {/* O espaço de boas-vindas cobre o conteúdo da comunidade enquanto está aberto. Fica ANTES
              dos canais na ordem do código porque é o que a pessoa deve ver primeiro — e porque assim
              nenhuma das condições abaixo precisa saber que ele existe. */}
          {view === 'community' && mostrandoBoasVindas && community && boasVindas && (
            <InicioDaComunidade
              community={community}
              dados={boasVindas}
              canais={channels}
              quantosMembros={onlineHere.length || members.size}
              quantosNaVoz={voiceMembers.length}
              aoAbrirCanal={(canal) => {
                setMostrandoBoasVindas(false);
                setSelectedId(canal.id);
              }}
              aoAbrirGuardaRoupa={() => {
                setMostrandoBoasVindas(false);
                setSettingsOpen('aparencia');
              }}
              aoEditar={() => {
                setMostrandoBoasVindas(false);
                setSettingsOpen('community');
              }}
              aoFechar={() => setMostrandoBoasVindas(false)}
            />
          )}
          {view === 'community' && !mostrandoBoasVindas && selected?.type === 'text' && socket && (
            <TextChannel
              key={selected.id}
              channel={selected}
              socket={socket}
              user={user}
              role={community?.role ?? 'member'}
              mensagensIniciais={preCarregado?.channelId === selected.id ? preCarregado.mensagens : undefined}
              onMobileBack={() => setMobileChannels(true)}
            />
          )}
          {/* O `!mostrandoBoasVindas` é o que falta na frase do comentário lá em cima: o canal de
              TEXTO já sabia se esconder, o palco da voz não. Os dois ficavam na mesma coluna, um
              embaixo do outro, e a sala aparecia espremida numa faixa no pé da tela. A chamada não
              cai — ela continua rodando; o que some é o palco, e ele volta inteiro ao fechar. */}
          {view === 'community' && !mostrandoBoasVindas && selected?.type === 'voice' && (
            <div className={`palco-e-conversa${sessao ? ' sessao' : ''}`}>
              <VoiceStage
                channel={selected}
                voice={voice}
                members={voiceMembers.filter((m) => m.channelId === selected.id)}
                canaisDeTexto={channels.filter((c) => c.type === 'text')}
                onMobileBack={() => setMobileChannels(true)}
                membersOpen={preferences.showMembers}
                onToggleMembers={() => updateSettings({ showMembers: !preferences.showMembers })}
                sessao={sessao}
                aoAlternarSessao={() => setSessao((ligada) => !ligada)}
                simples={modoSala}
                socket={socket}
                aoAbrirVozEVideo={() => setSettingsOpen('voice')}
              />
              {/* A conversa ao lado é o que separa "assistir junto" de "assistir ao mesmo tempo" —
                  sem ela, cada um comenta no vazio. Reaproveita o canal de texto que já existe: a
                  sessão não inventa um lugar novo, e o que for dito continua lá quando ela acabar. */}
              {sessao && canalDaSessao && socket && (
                <aside className="sessao-conversa">
                  <TextChannel
                    key={`sessao-${canalDaSessao.id}`}
                    channel={canalDaSessao}
                    socket={socket}
                    user={user}
                    role={community?.role ?? 'member'}
                    onMobileBack={() => setSessao(false)}
                  />
                </aside>
              )}
            </div>
          )}
          {view === 'community' && usageOpen && (
            <UsageDashboard voiceMembers={voiceMembers} onMobileBack={() => setMobileChannels(true)} />
          )}
          {view === 'community' && jogosOpen && community && (
            <ServidoresDeJogo community={community} onMobileBack={() => setMobileChannels(true)} />
          )}
          {view === 'community' && rankingOpen && community && (
            <Ranking community={community} onMobileBack={() => setMobileChannels(true)} />
          )}
          {view === 'community' && community && !selected && !usageOpen && !jogosOpen && !rankingOpen && (
            <div className="empty">{t('Escolha um canal à esquerda.')}</div>
          )}
        </main>
        {/* A lista de pessoas acompanha tanto o canal de texto quanto a sala de voz (aí, se a pessoa quiser). */}
        {view === 'community' && (selected?.type === 'text' || (selected?.type === 'voice' && preferences.showMembers)) && (
          <MemberList
            online={onlineHere}
            voiceMembers={voiceMembers}
            channels={channels}
            voice={voice}
            role={community?.role ?? 'member'}
            communityId={visivelId ?? 0}
            selfId={user.id}
            onWatchStream={watchStream}
            onSendMessage={(id) => void startConversation(id)}
          />
        )}
      </div>
      {explorarAberto && (
        <CommunityDialog
          mode="choose"
          onClose={() => setExplorarAberto(false)}
          onDone={(criada) => {
            setExplorarAberto(false);
            void afterCommunityChange(criada);
          }}
        />
      )}
      {newGroupOpen && (
        <NewGroupDialog
          selfId={user.id}
          onClose={() => setNewGroupOpen(false)}
          onCreated={(conversa) => {
            setNewGroupOpen(false);
            openConversation(conversa);
          }}
        />
      )}
      {/* Ideia acolhida: confete na tela, uma festa de cada vez. */}
      {comemorar[0] && <Comemoracao ideia={comemorar[0].content} aoFechar={() => fecharComemoracao(comemorar[0].id)} />}
      {/*
        Um anúncio de cada vez, e nesta ordem: primeiro a festa da ideia acolhida (a notícia), depois a
        insígnia que veio com ela (o prêmio). Os dois juntos na tela se atropelavam — literalmente: um
        ficava por cima do botão do outro. Os itens da fila também esperam a vez, um por um.
      */}
      {festasConferidas && !comemorar[0] && porRevelar[0] && <Revelacao codigo={porRevelar[0]} aoResgatar={() => resgatar(porRevelar[0])} />}

      {settingsOpen !== null && (
        <SettingsModal
          secaoInicial={settingsOpen}
          user={user}
          community={community}
          voice={voice}
          onClose={() => setSettingsOpen(null)}
          onLogout={logout}
          onCommunityChanged={() => void afterCommunityChange(null)}
        />
      )}
      <RoomAudioRenderer muted={voice.deafened} />
    </RoomContext.Provider>
  );
}
