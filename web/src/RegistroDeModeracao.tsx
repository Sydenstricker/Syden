import {
  ArchiveRestore,
  Ban,
  Bot,
  Hash,
  Link,
  type LucideIcon,
  Mic,
  MicOff,
  MonitorOff,
  Pencil,
  Pin,
  PinOff,
  Plus,
  ShieldMinus,
  ShieldPlus,
  Tag,
  Timer,
  Trash2,
  TriangleAlert,
  UserCheck,
  UserMinus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api } from './api';
import { chave, idiomaAtual, useT } from './i18n';

interface Pessoa {
  id: number;
  nome: string;
}

interface Entrada {
  id: number;
  at: string;
  acao: string;
  /** Null: a conta foi excluída (ou peloSyden). */
  quem: Pessoa | null;
  peloSyden: boolean;
  alvo: Pessoa | null;
  canal: string | null;
  detalhe: string | null;
}

/** O ícone de cada ação, e a frase dela (com {quem}, {alvo}, {canal}, {cargo}, {nome} e {tempo}). */
const ACOES: Record<string, { icone: LucideIcon; frase: string }> = {
  'membro.removido': { icone: UserMinus, frase: chave('{quem} removeu {alvo} da comunidade') },
  'membro.banido': { icone: Ban, frase: chave('{quem} baniu {alvo}') },
  'membro.desbanido': { icone: UserCheck, frase: chave('{quem} desbaniu {alvo}') },
  'membro.advertido': { icone: TriangleAlert, frase: chave('{quem} advertiu {alvo}') },
  'membro.silenciado': { icone: VolumeX, frase: chave('{quem} silenciou {alvo} por {tempo}') },
  'membro.silencio-tirado': { icone: Volume2, frase: chave('{quem} tirou o silêncio de {alvo}') },
  'membro.admin-dado': { icone: ShieldPlus, frase: chave('{quem} deu o cargo de administrador a {alvo}') },
  'membro.admin-tirado': { icone: ShieldMinus, frase: chave('{quem} tirou o cargo de administrador de {alvo}') },
  'cargo.dado': { icone: Tag, frase: chave('{quem} deu o cargo {cargo} a {alvo}') },
  'cargo.tirado': { icone: Tag, frase: chave('{quem} tirou o cargo {cargo} de {alvo}') },
  'microfone.travado': { icone: MicOff, frase: chave('{quem} travou o microfone de {alvo}') },
  'microfone.liberado': { icone: Mic, frase: chave('{quem} liberou o microfone de {alvo}') },
  'transmissao.cortada': { icone: MonitorOff, frase: chave('{quem} cortou a transmissão de {alvo}') },
  'mensagem.apagada': { icone: Trash2, frase: chave('{quem} apagou uma mensagem de {alvo} em {canal}') },
  'moderacao.mensagem': { icone: Trash2, frase: chave('Quem cuida do Syden apagou uma mensagem de {alvo}') },
  'mensagem.fixada': { icone: Pin, frase: chave('{quem} fixou uma mensagem de {alvo} em {canal}') },
  'mensagem.desafixada': { icone: PinOff, frase: chave('{quem} desafixou uma mensagem de {alvo} em {canal}') },
  'canal.criado': { icone: Plus, frase: chave('{quem} criou o canal {canal}') },
  'canal.renomeado': { icone: Pencil, frase: chave('{quem} renomeou o canal {canal} para {nome}') },
  'canal.apagado': { icone: Hash, frase: chave('{quem} apagou o canal {canal}') },
  'canal.restaurado': { icone: ArchiveRestore, frase: chave('{quem} restaurou o canal {canal}') },
  'canal.modo-lento': { icone: Timer, frase: chave('{quem} pôs o modo lento de {canal} em {tempo}') },
  'automod.regras': { icone: Bot, frase: chave('{quem} mudou as regras da moderação automática') },
  'convite.trocado': { icone: Link, frase: chave('{quem} trocou o código do convite') },
};
const DESLIGOU_O_MODO_LENTO = chave('{quem} desligou o modo lento de {canal}');

/** "60 minutos" vira "1 hora", "1440" vira "1 dia": a unidade escrita pelo próprio navegador, no idioma de quem lê. */
function duracao(segundos: number, idioma: string): string {
  const [valor, unidade] =
    segundos % 86400 === 0 ? [segundos / 86400, 'day'] : segundos % 3600 === 0 ? [segundos / 3600, 'hour'] : segundos % 60 === 0 ? [segundos / 60, 'minute'] : [segundos, 'second'];
  return new Intl.NumberFormat(idioma, { style: 'unit', unit: unidade, unitDisplay: 'long' }).format(valor);
}

/** "há 5 minutos", "ontem": pelo Intl, sem frase nova a traduzir. */
function quando(at: string, idioma: string): string {
  const segundos = Math.round((new Date(at).getTime() - Date.now()) / 1000);
  const formato = new Intl.RelativeTimeFormat(idioma, { numeric: 'auto' });
  const passos: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 30]];
  let valor = segundos;
  for (const [unidade, limite] of passos) {
    if (Math.abs(valor) < limite) return formato.format(Math.round(valor), unidade);
    valor /= limite;
  }
  return new Date(at).toLocaleDateString(idioma);
}

/**
 * O REGISTRO DE MODERAÇÃO DA COMUNIDADE (23/11/2026, pelo mapa das permissões do Discord; ver server/src/registro-routes.ts),
 * em Configurações → Ferramentas, só para quem administra: quem removeu, baniu, advertiu, silenciou, deu cargo, apagou a
 * mensagem de outra pessoa, fixou, mexeu nos canais, nas regras ou no convite. Os nomes são os de agora (quem excluiu a
 * conta aparece como "Conta excluída"), e da mensagem apagada só se diz de quem era e onde, nunca o texto.
 */
export function RegistroDeModeracao({ communityId }: { communityId: number }) {
  const t = useT();
  const idioma = idiomaAtual();
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(antes?: number) {
    setCarregando(true);
    setErro(null);
    try {
      const pagina = await api<Entrada[]>(`/api/communities/${communityId}/registro${antes ? `?antes=${antes}` : ''}`);
      setEntradas((atuais) => (antes ? [...(atuais ?? []), ...pagina] : pagina));
      setTemMais(pagina.length === 50);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    setEntradas(null);
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const frase = (e: Entrada) => {
    const acao = ACOES[e.acao];
    const desligou = e.acao === 'canal.modo-lento' && Number(e.detalhe) === 0;
    const segundos = e.acao === 'membro.silenciado' ? Number(e.detalhe) * 60 : Number(e.detalhe);
    return t(desligou ? DESLIGOU_O_MODO_LENTO : (acao?.frase ?? e.acao), {
      quem: e.quem?.nome ?? t('Conta excluída'),
      alvo: e.alvo?.nome ?? t('Conta excluída'),
      canal: e.canal ?? '',
      cargo: e.detalhe ?? '',
      nome: e.detalhe ?? '',
      tempo: Number.isFinite(segundos) && segundos > 0 ? duracao(segundos, idioma) : '',
    });
  };

  return (
    <>
      <h2>{t('Registro de moderação')}</h2>
      {erro && <p className="form-error">{erro}</p>}
      {entradas && entradas.length === 0 && <p className="settings-hint">{t('Nada registrado ainda. Só aparecem aqui as ações com poder sobre os outros.')}</p>}
      <ul className="registro-de-moderacao">
        {entradas?.map((e) => {
          const Icone = ACOES[e.acao]?.icone ?? Hash;
          return (
            <li key={e.id} className="registro-linha">
              <Icone size={16} aria-hidden="true" className="registro-icone" />
              <span className="registro-frase">{frase(e)}</span>
              <time dateTime={e.at} title={new Date(e.at).toLocaleString(idioma)} className="registro-quando">
                {quando(e.at, idioma)}
              </time>
            </li>
          );
        })}
      </ul>
      {temMais && entradas && (
        <button className="btn-secondary" disabled={carregando} onClick={() => void carregar(entradas[entradas.length - 1].id)}>
          {t('Ver mais')}
        </button>
      )}
    </>
  );
}
