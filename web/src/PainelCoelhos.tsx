import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { COELHOS, type Coelho, escolherCoelho, useCoelho } from './coelho';
import { useT } from './i18n';

// A aba dos coelhos da tela inicial: os dois lado a lado, para escolher qual representa o Syden.
//
// Passando o mouse, cada um se mexe do jeito dele: o OurBunny dá um pulo e solta estrelinhas, e o
// BigChunkus, que é pesado, afunda e balança o chão. É o que dá personalidade aos dois sem precisar de
// texto explicando quem é quem.

export function PainelCoelhos({ aoFechar }: { aoFechar: () => void }) {
  const t = useT();
  const escolhido = useCoelho();

  // A confirmação existe porque a escolha muda coisas que NÃO ESTÃO À VISTA neste painel: o ícone do
  // aplicativo, na barra de tarefas, e a tela de entrada. Sem ela a pessoa troca, fecha, e só descobre
  // depois que o Syden mudou de cara — sem ligar uma coisa à outra.
  const [confirmando, setConfirmando] = useState(false);
  const primeiraVez = useRef(true);

  useEffect(() => {
    // Não confirma o que a pessoa não fez: ao abrir, já existe um coelho escolhido.
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    setConfirmando(true);
    const relogio = setTimeout(() => setConfirmando(false), 6000);
    return () => clearTimeout(relogio);
  }, [escolhido]);

  const nome = COELHOS.find((c) => c.id === escolhido)?.nome ?? '';

  return (
    <div className="vila-painel coelhos" role="dialog" aria-label="Escolher o coelho do Syden">
      <header>
        <h3>Os coelhos do Syden</h3>
        <button className="vila-painel-fechar" aria-label="Fechar" onClick={aoFechar}>
          ✕
        </button>
      </header>
      <p className="coelhos-lead">
        {t('Escolha quem representa o seu Syden. Muda em três lugares: o')} <strong>ícone do aplicativo</strong>, a{' '}
        <strong>tela de entrada</strong> e a <strong>estátua da praça</strong>. Vale só neste computador — ninguém mais
        vê a sua escolha.
      </p>

      <div className="coelhos-grade">
        {COELHOS.map((coelho) => (
          <button
            key={coelho.id}
            className={`coelho-cartao ${coelho.id}${escolhido === coelho.id ? ' escolhido' : ''}`}
            onClick={() => escolherCoelho(coelho.id as Coelho)}
            aria-pressed={escolhido === coelho.id}
          >
            <span className="coelho-palco">
              <img src={coelho.url} alt="" aria-hidden="true" />
              {/* As estrelinhas do OurBunny: só aparecem com o mouse em cima. */}
              {coelho.id === 'our' && (
                <>
                  <span className="faisca f1" aria-hidden="true">
                    ✦
                  </span>
                  <span className="faisca f2" aria-hidden="true">
                    ✦
                  </span>
                  <span className="faisca f3" aria-hidden="true">
                    ✦
                  </span>
                </>
              )}
              {/* A poeirinha que o BigChunkus levanta ao cair. */}
              {coelho.id === 'big' && <span className="poeira" aria-hidden="true" />}
            </span>
            <strong>{coelho.nome}</strong>
            <small>{coelho.sobre}</small>
            {escolhido === coelho.id && (
              <span className="coelho-marca">
                <Check size={14} aria-hidden="true" /> em uso
              </span>
            )}
          </button>
        ))}
      </div>

      {/* `aria-live` faz o leitor de tela anunciar isto quando aparece, sem tirar o foco de onde está. */}
      <p className={`coelhos-confirmacao${confirmando ? ' visivel' : ''}`} role="status" aria-live="polite">
        {confirmando && (
          <>
            <Check size={14} aria-hidden="true" /> Pronto: o <strong>{nome}</strong> agora é o ícone do aplicativo e a
            cara da tela de entrada. Para voltar, é só escolher o outro.
          </>
        )}
      </p>
    </div>
  );
}
