import { Check } from 'lucide-react';
import { COELHOS, type Coelho, escolherCoelho, useCoelho } from './coelho';
import { useT } from './i18n';
import { CoelhoArte } from './Vila';

// A aba dos coelhos da tela inicial: os dois lado a lado, para escolher qual fica na estátua da praça.
// Cada cartão desenha o MESMO coelho da estátua (CoelhoArte), e não uma imagem à parte: o que se
// escolhe é exatamente o que aparece.
//
// Passando o mouse, cada um se mexe do jeito dele: o OurBunny dá um pulo e solta estrelinhas, e o
// BigChunkus, que é pesado, afunda e balança o chão. É o que dá personalidade aos dois sem precisar de
// texto explicando quem é quem.

export function PainelCoelhos({ aoFechar }: { aoFechar: () => void }) {
  const t = useT();
  const escolhido = useCoelho();

  return (
    <div className="vila-painel coelhos" role="dialog" aria-label="Escolher o coelho do Syden">
      <header>
        <h3>Os coelhos do Syden</h3>
        <button className="vila-painel-fechar" aria-label="Fechar" onClick={aoFechar}>
          ✕
        </button>
      </header>
      <p className="coelhos-lead">{t('Escolha o coelho da estátua da praça.')}</p>

      <div className="coelhos-grade">
        {COELHOS.map((coelho) => (
          <button
            key={coelho.id}
            className={`coelho-cartao ${coelho.id}${escolhido === coelho.id ? ' escolhido' : ''}`}
            onClick={() => escolherCoelho(coelho.id as Coelho)}
            aria-pressed={escolhido === coelho.id}
          >
            <span className="coelho-palco">
              <svg className="coelho-figura" viewBox="-19 -45 38 48" aria-hidden="true">
                <CoelhoArte id={0} gordo={coelho.id === 'big'} />
              </svg>
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
