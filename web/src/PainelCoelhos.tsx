import { Check } from 'lucide-react';
import { COELHOS, type Coelho, escolherCoelho, useCoelho } from './coelho';

// A aba dos coelhos da tela inicial: os dois lado a lado, para escolher qual representa o Syden.
//
// Passando o mouse, cada um se mexe do jeito dele: o OurBunny dá um pulo e solta estrelinhas, e o
// BigChunkus, que é pesado, afunda e balança o chão. É o que dá personalidade aos dois sem precisar de
// texto explicando quem é quem.

export function PainelCoelhos({ aoFechar }: { aoFechar: () => void }) {
  const escolhido = useCoelho();

  return (
    <div className="vila-painel coelhos" role="dialog" aria-label="Escolher o coelho do Syden">
      <header>
        <h3>Os coelhos do Syden</h3>
        <button className="vila-painel-fechar" aria-label="Fechar" onClick={aoFechar}>
          ✕
        </button>
      </header>
      <p className="coelhos-lead">Escolha quem representa o seu Syden: o ícone do app e a estátua da praça seguem a sua escolha.</p>

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
    </div>
  );
}
