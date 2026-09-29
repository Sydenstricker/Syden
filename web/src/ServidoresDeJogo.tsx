import { Check, Copy, Gamepad2, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { ConfirmDialog } from './ConfirmDialog';
import { MobileBackButton } from './MobileBackButton';
import type { Community, ServidorDeJogo } from './types';
import { useT } from './i18n';

// A agenda de servidores de jogo da comunidade: Minecraft, Palworld, Valheim, o que a turma jogar.
//
// O problema que isto resolve é bobo e real: o endereço do servidor vive perdido numa mensagem de três
// semanas atrás, e toda vez que alguém novo chega a mesma pergunta volta. Aqui ele fica num lugar fixo,
// com botão de copiar — porque ninguém digita "mc.exemplo.com:25565" a mão sem errar.

const VAZIO = { nome: '', jogo: '', endereco: '', senha: '', observacao: '' };

/** Copiar com a resposta na tela: sem o "copiado", ninguém sabe se o clique pegou. */
function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiou, setCopiou] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiou(true);
      setTimeout(() => setCopiou(false), 1600);
    } catch {
      // Navegador sem permissão de área de transferência: o texto está na tela para copiar a mão.
    }
  }

  return (
    <button type="button" className="jogo-copiar" onClick={() => void copiar()} aria-label={`Copiar ${rotulo}`}>
      {copiou ? <Check size={14} /> : <Copy size={14} />}
      <code>{texto}</code>
    </button>
  );
}

function Formulario({
  inicial,
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial: typeof VAZIO;
  salvando: boolean;
  onSalvar: (dados: typeof VAZIO) => void;
  onCancelar: () => void;
}) {
  const t = useT();
  const [dados, setDados] = useState(inicial);
  const campo = (chave: keyof typeof VAZIO) => ({
    value: dados[chave],
    onChange: (e: { target: { value: string } }) => setDados({ ...dados, [chave]: e.target.value }),
  });

  function enviar(event: FormEvent) {
    event.preventDefault();
    onSalvar(dados);
  }

  return (
    <form className="jogo-form" onSubmit={enviar}>
      <div className="jogo-form-linha">
        <label className="campo">
          {t('Nome')}
          <input {...campo('nome')} placeholder={t('O survival do Léo')} maxLength={60} />
        </label>
        <label className="campo">
          {t('Jogo')}
          <input {...campo('jogo')} placeholder="Minecraft" maxLength={40} />
        </label>
      </div>
      <label className="campo">
        {t('Endereço')}
        <input {...campo('endereco')} placeholder={t('mc.exemplo.com:25565')} maxLength={120} />
      </label>
      <div className="jogo-form-linha">
        <label className="campo">
          {t('Senha (se tiver)')}
          <input {...campo('senha')} maxLength={60} />
        </label>
        <label className="campo">
          {t('Observação')}
          <input {...campo('observacao')} placeholder={t('Versão 1.21, sem PvP')} maxLength={300} />
        </label>
      </div>
      <div className="jogo-form-acoes">
        <button type="submit" disabled={salvando}>
          {t('Salvar')}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancelar}>
          {t('Cancelar')}
        </button>
      </div>
    </form>
  );
}

export function ServidoresDeJogo({ community, onMobileBack }: { community: Community; onMobileBack: () => void }) {
  const t = useT();
  const [servidores, setServidores] = useState<ServidorDeJogo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | 'novo' | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [apagando, setApagando] = useState<ServidorDeJogo | null>(null);

  const administra = community.role === 'owner' || community.role === 'admin';
  const base = `/api/communities/${community.id}/jogos`;

  useEffect(() => {
    setServidores(null);
    void api<ServidorDeJogo[]>(base)
      .then(setServidores)
      .catch((e) => {
        setErro((e as Error).message);
        setServidores([]);
      });
  }, [base]);

  async function salvar(dados: typeof VAZIO) {
    setSalvando(true);
    setErro(null);
    try {
      const novo = editando === 'novo';
      await api(novo ? base : `${base}/${editando}`, { method: novo ? 'POST' : 'PUT', body: dados });
      setServidores(await api<ServidorDeJogo[]>(base));
      setEditando(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(servidor: ServidorDeJogo) {
    setApagando(null);
    try {
      await api(`${base}/${servidor.id}`, { method: 'DELETE' });
      setServidores((atuais) => (atuais ?? []).filter((s) => s.id !== servidor.id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (servidores === null) return <p className="settings-hint">{t('Carregando…')}</p>;

  // Agrupado por jogo: uma turma que joga três coisas tem três blocos, e não uma lista embaralhada.
  const porJogo = new Map<string, ServidorDeJogo[]>();
  for (const servidor of servidores) {
    const lista = porJogo.get(servidor.jogo) ?? [];
    lista.push(servidor);
    porJogo.set(servidor.jogo, lista);
  }

  return (
    <div className="jogos">
      <header className="main-header">
        <MobileBackButton onBack={onMobileBack} />
        <Gamepad2 size={22} className="muted-icon" /> Servidores de jogos
        {administra && editando === null && (
          <button className="btn-secondary jogos-novo" onClick={() => setEditando('novo')}>
            <Plus size={16} /> {t('Adicionar')}
          </button>
        )}
      </header>

      <div className="jogos-corpo">
        {erro && <p className="form-error">{erro}</p>}

        {editando === 'novo' && (
          <Formulario inicial={VAZIO} salvando={salvando} onSalvar={(d) => void salvar(d)} onCancelar={() => setEditando(null)} />
        )}

        {servidores.length === 0 && editando === null && (
          <p className="jogos-vazio">
            {administra
              ? 'Nenhum servidor ainda. Ponha o endereço aqui e ele para de se perder nas mensagens antigas.'
              : 'A turma ainda não cadastrou nenhum servidor de jogo aqui.'}
          </p>
        )}

        {[...porJogo.entries()].map(([jogo, lista]) => (
          <section key={jogo} className="jogo-grupo">
            <h3>{jogo}</h3>
            {lista.map((servidor) =>
              editando === servidor.id ? (
                <Formulario
                  key={servidor.id}
                  inicial={{
                    nome: servidor.nome,
                    jogo: servidor.jogo,
                    endereco: servidor.endereco,
                    senha: servidor.senha ?? '',
                    observacao: servidor.observacao ?? '',
                  }}
                  salvando={salvando}
                  onSalvar={(d) => void salvar(d)}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <article key={servidor.id} className="jogo-cartao">
                  <div className="jogo-cartao-texto">
                    <strong>{servidor.nome}</strong>
                    <BotaoCopiar texto={servidor.endereco} rotulo="o endereço" />
                    {servidor.senha && (
                      <span className="jogo-senha">
                        {t('Senha:')} <BotaoCopiar texto={servidor.senha} rotulo="a senha" />
                      </span>
                    )}
                    {servidor.observacao && <small>{servidor.observacao}</small>}
                  </div>
                  {administra && (
                    <div className="jogo-cartao-acoes">
                      <button className="icon-button" aria-label="Editar" onClick={() => setEditando(servidor.id)}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-button danger" aria-label="Apagar" onClick={() => setApagando(servidor)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </article>
              ),
            )}
          </section>
        ))}
      </div>

      {apagando && (
        <ConfirmDialog
          title={t('Apagar este servidor?')}
          confirmLabel="Apagar"
          onConfirm={() => void apagar(apagando)}
          onCancel={() => setApagando(null)}
        >
          <p>
            <strong>{apagando.nome}</strong> sai da lista. O servidor do jogo em si não é afetado — o Syden só guarda o
            endereço, como uma agenda.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
