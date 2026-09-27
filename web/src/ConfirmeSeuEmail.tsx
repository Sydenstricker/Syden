import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from './api';

// A tela de quem acabou de se cadastrar, ou de quem tentou entrar sem ter confirmado.
//
// Ela existe porque o cadastro deixou de entregar a sessão na hora: a conta nasce, mas só abre depois
// que a pessoa clica no link que chegou na caixa dela. Sem uma tela dizendo isso com todas as letras, o
// que a pessoa vive é "criei a conta e não aconteceu nada" — e some.
//
// Por isso aqui tem as três coisas que resolvem sozinhas quase todos os casos: dizer para onde foi,
// lembrar do spam, e o botão de mandar de novo.

export function ConfirmeSeuEmail({ paraOndeFoi, username, aoVoltar }: { paraOndeFoi: string; username: string; aoVoltar: () => void }) {
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado');
  const [erro, setErro] = useState<string | null>(null);

  async function reenviar() {
    setEstado('enviando');
    setErro(null);
    try {
      await api('/api/auth/reenviar-confirmacao', { method: 'POST', token: null, body: { username } });
      setEstado('enviado');
    } catch (e) {
      setErro((e as Error).message);
      setEstado('parado');
    }
  }

  return (
    <div className="auth-card confirme-email">
      <MailCheck size={40} aria-hidden="true" className="confirme-email-icone" />
      <h1>Falta só confirmar</h1>
      <p>
        Mandamos um link para <strong>{paraOndeFoi}</strong>. Abra ele e a sua conta está pronta — é o que garante que
        você consiga recuperar a senha um dia, se esquecer.
      </p>
      <p className="settings-hint">
        Não chegou em alguns minutos? Dê uma olhada no spam ou nas promoções. Se não estiver lá, mande de novo.
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {estado === 'enviado' && <p className="form-success">Enviado. Confira a sua caixa.</p>}

      <button type="button" className="btn-primary" disabled={estado === 'enviando'} onClick={() => void reenviar()}>
        {estado === 'enviando' ? 'Enviando…' : 'Mandar o link de novo'}
      </button>
      <p className="auth-switch">
        <button type="button" className="link" onClick={aoVoltar}>
          Voltar para a entrada
        </button>
      </p>
    </div>
  );
}
