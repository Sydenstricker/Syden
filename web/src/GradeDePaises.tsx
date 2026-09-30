import { useMemo } from 'react';
import { chave, idiomaAtual, useT } from './i18n';
import { type Regiao, nomeDoPais, paisesDoIdioma, porRegiao } from './i18n/paises';

/**
 * Os nomes das cinco regiões, AQUI e não em paises.ts.
 *
 * Não é organização: é a ferramenta. A varredura que conta textos a traduzir pula a pasta i18n
 * inteira — lá o português é a CHAVE, e acusá-lo seria acusar o dicionário. Um chave() escrito dentro
 * de paises.ts não é visto por ninguém, e estas cinco frases nasceriam faltando em cada idioma novo
 * sem nenhum aviso. Aqui fora, a contagem as enxerga e cobra.
 */
const NOME_DA_REGIAO: Record<Regiao, string> = {
  africa: chave('África'),
  asia: chave('Ásia'),
  europa: chave('Europa'),
  americas: chave('Américas'),
  oceania: chave('Oceania'),
};

/**
 * ONDE ESTE IDIOMA É FALADO, em quadradinhos.
 *
 * Cada quadradinho é um país membro da ONU; os acesos falam o idioma escolhido. Agrupados por região,
 * o olho lê o alcance sem ler número nenhum: o inglês toma a Oceania quase inteira e quase não existe
 * na Europa; o francês se espalha pela África; o russo é um punhado.
 *
 * ---------------------------------------------------------------------------------------------------
 * POR QUE NÃO É UM MAPA, que era a ideia original e ficou mais bonita.
 *
 * Um mapa-múndi com países pintados desenha fronteira, e fronteira é posição política: Caxemira,
 * Crimeia, Saara Ocidental, Chipre. Publicar isso numa loja com mercados por país tem consequência
 * real — na Índia, publicar mapa do país fora do padrão oficial é crime, e a Índia é justamente um dos
 * países que o inglês pintaria. Não existe mapa neutro: o da ONU é ilegal lá, e o indiano ofende
 * Paquistão e China.
 *
 * A grade some com o problema inteiro em vez de administrá-lo. Ela não desenha território: conta
 * cadeiras na Assembleia Geral, que é um conjunto objetivo. E de quebra não baixa nada — o mapa
 * custaria 50 KB de SVG, isto custa CSS.
 *
 * Foram desenhados três candidatos antes desta escolha — mapa preenchido, mapa de pontos e a grade —
 * e a comparação lado a lado está fora do repositório (a pasta imagem/ não sobe). O que ficou dela é
 * esta decisão e o motivo dela, que é o que importa reler.
 * ---------------------------------------------------------------------------------------------------
 *
 * OS NOMES DOS PAÍSES vêm do `Intl.DisplayNames` do navegador, em qualquer língua: são 193 nomes que
 * nunca precisam ser traduzidos à mão, e que já vão estar certos nos 61 idiomas que ainda faltam.
 *
 * OS NOMES DAS CINCO REGIÕES, não. O navegador só conhece código de país de duas letras; para os
 * numéricos da ONU ele devolve o próprio número, e a tela ficou escrita "002 · 23/54" — ver o
 * comentário em paises.ts. São cinco textos traduzidos à mão, e pronto.
 */
export function GradeDePaises({ idioma }: { idioma: string }) {
  const t = useT();
  const lendoEm = idiomaAtual();
  const regioes = useMemo(() => porRegiao(idioma), [idioma]);
  const quantos = paisesDoIdioma(idioma).length;

  if (quantos === 0) return null;

  // Para quem usa leitor de tela: a lista dos países MARCADOS, que é a informação. Ler os 193
  // quadradinhos em voz alta seria despejar o mundo inteiro para dizer meia dúzia de nomes.
  const marcados = paisesDoIdioma(idioma)
    .map((p) => nomeDoPais(p, lendoEm))
    .sort((a, b) => a.localeCompare(b, lendoEm));

  return (
    <div className="grade-paises">
      <p className="grade-paises-conta">
        {t('{quantos} dos 193 países da ONU', { quantos })}
      </p>

      <div className="grade-paises-regioes" role="img" aria-label={marcados.join(', ')}>
        {regioes.map((r) => (
          <div key={r.id} className="grade-paises-regiao">
            <small>
              {t(NOME_DA_REGIAO[r.id])} · {r.marcados.size}/{r.paises.length}
            </small>
            <div className="grade-paises-grade">
              {r.paises.map((pais) => (
                <i
                  key={pais}
                  className={r.marcados.has(pais) ? 'aceso' : undefined}
                  /* O título é o que aparece ao passar o mouse, e é o que faz o quadradinho deixar de
                     ser enfeite: dá para descobrir QUAL país é cada um. */
                  title={nomeDoPais(pais, lendoEm)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
