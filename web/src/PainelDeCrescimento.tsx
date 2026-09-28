import { Gift, MailQuestion, UserPlus, Users } from 'lucide-react';
import type { ResumoDeContas } from './types';
import { useT } from './i18n';

// Quantas pessoas existem no Syden, e como elas chegaram.
//
// A pergunta que isto responde é a que o dono faz toda semana: "está crescendo?". Antes ela só tinha
// resposta abrindo o banco no servidor. Os números de 1, 7 e 30 dias estão lado a lado de propósito —
// o total sozinho não diz nada, porque total nunca cai; o que conta é o ritmo.

function Numero({ valor, rotulo, icone, destaque }: { valor: number; rotulo: string; icone?: React.ReactNode; destaque?: boolean }) {
  return (
    <li className={destaque ? 'destaque' : undefined}>
      <strong>{valor}</strong>
      <span>
        {icone}
        {rotulo}
      </span>
    </li>
  );
}

export function PainelDeCrescimento({ contas, online }: { contas: ResumoDeContas; online: number }) {
  const t = useT();
  return (
    <section className="crescimento">
      <h3>
        <Users size={18} aria-hidden="true" /> {t('Pessoas')}
      </h3>

      <ul className="crescimento-numeros">
        <Numero valor={contas.total} rotulo="contas no total" destaque />
        <Numero valor={online} rotulo="online agora" destaque />
        <Numero valor={contas.hoje} rotulo="nas últimas 24h" icone={<UserPlus size={13} aria-hidden="true" />} />
        <Numero valor={contas.seteDias} rotulo="nos últimos 7 dias" />
        <Numero valor={contas.trintaDias} rotulo="nos últimos 30 dias" />
      </ul>

      <ul className="crescimento-numeros secundarios">
        {/*
          Estes três não são vaidade, são coisas para fazer:
          - sem comunidade: chegou e não tem com quem falar. Se for muita gente, o convite não está
            circulando e o Syden está sendo uma sala vazia para quem entra.
          - por confirmar: cadastrou e não abriu o link. Se for muita gente, o e-mail está caindo em spam.
          - vagas na insígnia: até quando ainda dá para chamar alguém e a pessoa pegar a dos 25 primeiros.
        */}
        <Numero valor={contas.semComunidade} rotulo="ainda sem comunidade" />
        <Numero
          valor={contas.porConfirmar}
          rotulo="sem confirmar o e-mail"
          icone={<MailQuestion size={13} aria-hidden="true" />}
        />
        <Numero valor={contas.comProvedor} rotulo="entram por Google, Discord, GitHub ou Steam" />
        <Numero
          valor={contas.vagasNaInsignia}
          rotulo={contas.vagasNaInsignia > 0 ? 'vagas na insígnia dos 25 primeiros' : 'a insígnia dos 25 primeiros acabou'}
          icone={<Gift size={13} aria-hidden="true" />}
        />
      </ul>
    </section>
  );
}
