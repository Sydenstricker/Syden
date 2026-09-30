// @ts-check
// O que desenha a janelinha de quem está na chamada. Roda DENTRO dela, isolado, sem acesso a Node —
// só recebe a lista pela ponte (ver sobreposicao-preload.js) e monta as linhas.
//
// Sem nenhum texto próprio de propósito: os nomes são de pessoas e não se traduzem. É por isso que
// esta página não precisou do dicionário pequeno que a tela offline precisou.

const lista = document.getElementById('lista');

/**
 * A cor do rosto, tirada do NOME.
 *
 * Precisa ser estável (a mesma pessoa, sempre a mesma cor) e não pode depender do site: aqui dentro
 * não há acesso ao perfil de ninguém. A paleta é a mesma de web/src/profileStyles.ts, para o rosto na
 * sobreposição não sair de uma cor e o da lista de pessoas de outra.
 *
 * SOMAR OS CÓDIGOS DAS LETRAS NÃO SERVE, e isso foi visto na primeira foto: "Sydenstricker", "Leo" e
 * "Rafa" saíram os três vermelhos, de quatro pessoas na tela. A soma espalha mal — nomes com as
 * mesmas letras em ordens diferentes caem no mesmo lugar, e o resto se amontoa. Numa lista de quatro
 * rostos, três iguais destroem a única coisa que a janelinha faz.
 *
 * O FNV-1a espalha de verdade e continua sendo cinco linhas. Nos mesmos quatro nomes: quatro cores.
 */
const CORES = ['#e2574c', '#e0822f', '#c79a1e', '#77a93a', '#2fa88c', '#3d97cc', '#5b6fd6', '#8f6fd6', '#d45f95'];

function corDe(nome) {
  let h = 2166136261;
  for (const c of String(nome)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return CORES[h % CORES.length];
}

/** A inicial que vai dentro do círculo. Nome vazio não deixa a bolinha em branco. */
function inicial(nome) {
  const texto = String(nome).trim();
  return texto ? [...texto][0].toUpperCase() : '?';
}

window.sydenSobreposicao.aoReceber((pessoas) => {
  lista.textContent = '';
  for (const pessoa of pessoas) {
    const linha = document.createElement('div');
    linha.className = 'pessoa' + (pessoa.falando ? ' falando' : '') + (pessoa.mudo ? ' mudo' : '');

    const cara = document.createElement('span');
    cara.className = 'cara';
    cara.style.background = corDe(pessoa.nome);
    cara.textContent = inicial(pessoa.nome);

    const nome = document.createElement('span');
    nome.className = 'nome';
    // textContent, e nunca innerHTML: o nome vem de outra pessoa, e nome é conteúdo de usuário.
    nome.textContent = pessoa.nome;

    linha.append(cara, nome);
    lista.append(linha);
  }
});
