import { Link2, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { AVISOS, ligarCom, NOMES, type Provedor } from './entradaSocial';
import { MarcaSocial } from './MarcasSociais';
import { useT } from './i18n';

// "Entrar com", nas configurações da conta: ligar e desligar Google, Discord, GitHub e Steam numa conta
// que já existe.
//
// Ligar é a resposta para o caso mais comum de todos: a pessoa já tem conta no Syden, entra pelo GitHub,
// e cai numa conta nova em folha — porque o Syden não tinha como saber que era ela. Depois de ligado,
// os dois caminhos levam à mesma conta.

interface Estado {
  ligados: Provedor[];
  possiveis: Provedor[];
  /** Sem senha, o último provedor ligado é a única porta — e o Syden não deixa fechá-la. */
  temSenha: boolean;
}

export function EntradasLigadas() {
  const t = useT();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<Provedor | null>(null);

  useEffect(() => {
    void api<Estado>('/api/me/social')
      .then(setEstado)
      .catch((e) => setErro((e as Error).message));
  }, []);

  async function ligar(provedor: Provedor) {
    setOcupado(provedor);
    setErro(null);
    // Dando certo, a página sai do ar antes de o then rodar; o catch é para quando o servidor recusa.
    await ligarCom(provedor).catch((e) => {
      setErro((e as Error).message);
      setOcupado(null);
    });
  }

  async function desligar(provedor: Provedor) {
    setOcupado(provedor);
    setErro(null);
    try {
      const { ligados } = await api<{ ligados: Provedor[] }>(`/api/me/social/${provedor}`, { method: 'DELETE' });
      setEstado((atual) => (atual ? { ...atual, ligados } : atual));
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(null);
  }

  if (erro && !estado) return <p className="form-error">{erro}</p>;
  if (!estado) return null;
  // Nenhum provedor configurado no servidor: a seção inteira não faz sentido e some.
  if (estado.possiveis.length === 0) return null;

  // Desligar o último jeito de entrar trancaria a pessoa do lado de fora. O servidor recusa de qualquer
  // jeito; aqui o botão já nasce desligado, com o motivo escrito — melhor do que deixar clicar e negar.
  const ultimaPorta = (provedor: Provedor) => !estado.temSenha && estado.ligados.length === 1 && estado.ligados[0] === provedor;

  return (
    <>
      <h3>{t('Entrar com')}</h3>
      <p className="settings-hint">
        Ligue a sua conta do Google, Discord, GitHub ou Steam para entrar no Syden por lá, sem digitar senha. Dá para
        ligar mais de um, e todos levam a esta mesma conta.
      </p>

      {erro && <p className="form-error">{erro}</p>}

      <ul className="entradas-ligadas">
        {estado.possiveis.map((provedor) => {
          const ligado = estado.ligados.includes(provedor);
          const trancado = ultimaPorta(provedor);
          return (
            <li key={provedor}>
              <MarcaSocial provedor={provedor} size={20} />
              <span className="entradas-ligadas-texto">
                <strong>{NOMES[provedor]}</strong>
                <small>{ligado ? 'Ligado a esta conta' : (AVISOS[provedor] ?? 'Não está ligado')}</small>
                {trancado && <small className="entradas-ligadas-travado">{t('É o seu único jeito de entrar. Defina uma senha antes de desligar.')}</small>}
              </span>
              <button
                type="button"
                className={ligado ? 'btn-secondary danger' : 'btn-secondary'}
                disabled={ocupado !== null || trancado}
                onClick={() => void (ligado ? desligar(provedor) : ligar(provedor))}
              >
                {ligado ? <Unlink size={15} /> : <Link2 size={15} />}
                {ocupado === provedor ? 'Um instante…' : ligado ? 'Desligar' : 'Ligar'}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
