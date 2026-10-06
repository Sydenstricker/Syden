import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useDirectory } from './directory';
import { useT } from './i18n';
import type { Cargo, Community, CommunityMember } from './types';

// OS CARGOS PERSONALIZADOS: nome e cor que a comunidade cria e dá a quem quiser (ver o bloco "OS CARGOS"
// em server/src/db.ts). São a base de outras funções — cargo por nível, por reação, de quem entra.
//
// CARGO É IDENTIDADE, NÃO PODER: o que cada um pode fazer continua nos três papéis (dono, administrador,
// membro). Por isso a cor do cargo aparece numa etiqueta, e não no nome — o nome tem a cor que a PESSOA
// escolheu na Aparência, e um cargo passar por cima disso tiraria dela uma escolha que é dela.

/** As cores sugeridas, para quem não quer abrir o seletor. Qualquer outra vale. */
const CORES = ['#f5b83d', '#e5534b', '#2fbf71', '#3ccfb8', '#5865f2', '#b07cf2', '#f27cb0', '#9aa1b1'];

/** Os cargos de alguém, como etiquetas: a bolinha na cor do cargo e o nome. */
export function EtiquetasDeCargo({ ids, onRemover }: { ids: number[] | undefined; onRemover?: (cargo: Cargo) => void }) {
  const t = useT();
  const { cargos } = useDirectory();
  const deles = cargos.filter((c) => ids?.includes(c.id));
  if (deles.length === 0) return null;
  return (
    <span className="cargos-etiquetas">
      {deles.map((cargo) => (
        <span key={cargo.id} className="cargo-etiqueta">
          <span className="cargo-bolinha" style={{ background: cargo.cor }} aria-hidden="true" />
          <bdi>{cargo.nome}</bdi>
          {onRemover && (
            <button
              type="button"
              className="cargo-tirar"
              aria-label={t('Tirar o cargo {cargo}', { cargo: cargo.nome })}
              title={t('Tirar o cargo {cargo}', { cargo: cargo.nome })}
              onClick={() => onRemover(cargo)}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Dar e tirar cargos de uma pessoa, na lista de membros das configurações (só para quem administra).
 * A lista de "dar" só oferece os que ela ainda não tem.
 */
export function CargosDoMembro({ community, member }: { community: Community; member: CommunityMember }) {
  const t = useT();
  const { cargos } = useDirectory();
  const [erro, setErro] = useState<string | null>(null);
  const faltam = cargos.filter((c) => !member.cargos?.includes(c.id));

  async function mudar(cargoId: number, dar: boolean) {
    setErro(null);
    try {
      await api(`/api/communities/${community.id}/members/${member.id}/cargos/${cargoId}`, { method: dar ? 'PUT' : 'DELETE' });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <span className="cargos-do-membro">
      <EtiquetasDeCargo ids={member.cargos} onRemover={(cargo) => void mudar(cargo.id, false)} />
      {faltam.length > 0 && (
        <select
          className="cargo-dar"
          aria-label={t('Dar cargo a {pessoa}', { pessoa: member.username })}
          value=""
          onChange={(e) => e.target.value && void mudar(Number(e.target.value), true)}
        >
          <option value="">{t('+ Cargo')}</option>
          {faltam.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      )}
      {erro && <span className="form-error small">{erro}</span>}
    </span>
  );
}

/** Uma linha do editor: nome, cor e "mostrar separado", salvos na hora em que mudam. */
function LinhaDoCargo({ community, cargo }: { community: Community; cargo: Cargo }) {
  const t = useT();
  const [nome, setNome] = useState(cargo.nome);
  const [erro, setErro] = useState<string | null>(null);
  // A cor e o "separado" mudam NA HORA, sem esperar o servidor: presa ao valor de lá, a caixa voltava a
  // ficar desmarcada até a resposta chegar, e o clique parecia não ter pegado.
  const [cor, setCor] = useState(cargo.cor);
  const [separado, setSeparado] = useState(cargo.separado);
  // Outra pessoa da administração mudou: os campos acompanham.
  useEffect(() => setNome(cargo.nome), [cargo.nome]);
  useEffect(() => setCor(cargo.cor), [cargo.cor]);
  useEffect(() => setSeparado(cargo.separado), [cargo.separado]);

  async function salvar(mudanca: Partial<Pick<Cargo, 'nome' | 'cor' | 'separado'>>) {
    setErro(null);
    try {
      await api(`/api/communities/${community.id}/cargos/${cargo.id}`, { method: 'PATCH', body: mudanca });
    } catch (e) {
      setErro((e as Error).message);
      setNome(cargo.nome);
      setCor(cargo.cor);
      setSeparado(cargo.separado);
    }
  }

  async function apagar() {
    setErro(null);
    try {
      await api(`/api/communities/${community.id}/cargos/${cargo.id}`, { method: 'DELETE' });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <li className="cargo-linha">
      <input
        type="color"
        value={cor}
        aria-label={t('Cor do cargo {cargo}', { cargo: cargo.nome })}
        onChange={(e) => {
          setCor(e.target.value);
          void salvar({ cor: e.target.value });
        }}
      />
      <input
        className="cargo-nome"
        value={nome}
        maxLength={32}
        aria-label={t('Nome do cargo')}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => nome.trim() && nome.trim() !== cargo.nome && void salvar({ nome: nome.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <label className="cargo-separado">
        <input
          type="checkbox"
          checked={separado}
          onChange={(e) => {
            setSeparado(e.target.checked);
            void salvar({ separado: e.target.checked });
          }}
        />
        {t('Separado na lista')}
      </label>
      <button
        type="button"
        className="icon-plain expression-delete"
        aria-label={t('Apagar o cargo {cargo}', { cargo: cargo.nome })}
        title={t('Apagar o cargo {cargo}', { cargo: cargo.nome })}
        onClick={() => void apagar()}
      >
        <Trash2 size={16} />
      </button>
      {erro && <span className="form-error small">{erro}</span>}
    </li>
  );
}

/** Criar e editar os cargos da comunidade, nas configurações dela (só para quem administra). */
export function EditorDeCargos({ community }: { community: Community }) {
  const t = useT();
  const { cargos } = useDirectory();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES[0]);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (!nome.trim()) return;
    setErro(null);
    try {
      await api(`/api/communities/${community.id}/cargos`, { method: 'POST', body: { nome: nome.trim(), cor } });
      setNome('');
      // A próxima cor sugerida é outra, para dois cargos seguidos não nascerem iguais.
      setCor(CORES[(CORES.indexOf(cor) + 1) % CORES.length]);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="settings-card editor-de-cargos">
      <p className="settings-hint">
        {t('Cargos dão nome e cor a grupos de pessoas: "Veterano", "Turma da raide". Não mudam o que cada um pode fazer na comunidade.')}
      </p>
      {cargos.length > 0 && (
        <ul className="cargo-lista">
          {cargos.map((cargo) => (
            <LinhaDoCargo key={cargo.id} community={community} cargo={cargo} />
          ))}
        </ul>
      )}
      <form
        className="cargo-novo"
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
      >
        <input type="color" value={cor} aria-label={t('Cor do cargo novo')} onChange={(e) => setCor(e.target.value)} />
        <input value={nome} maxLength={32} placeholder={t('Nome do cargo')} aria-label={t('Nome do cargo')} onChange={(e) => setNome(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={!nome.trim()}>
          <Plus size={16} aria-hidden="true" /> {t('Criar cargo')}
        </button>
      </form>
      {erro && <p className="form-error">{erro}</p>}
    </div>
  );
}
