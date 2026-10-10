// O botão "Copiar o Pix" da página de contribuir.
//
// Ele nasce ESCONDIDO no HTML e só aparece aqui, quando o navegador sabe copiar: um botão que não
// copia nada é pior do que nenhum botão. Sem ele, o código continua na tela para selecionar à mão.
//
// Os textos de resposta moram no HTML (data-copiado, data-falhou), e não aqui: a página existe em todos
// os idiomas do site, e o que está no HTML é traduzido junto com ela (web/scripts/site-traduzido.mjs).
const botao = document.querySelector('[data-copiar]');
const alvo = botao && document.getElementById(botao.dataset.copiar);

if (botao && alvo && alvo.textContent.trim() && navigator.clipboard) {
  const rotulo = botao.textContent;
  botao.hidden = false;
  botao.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(alvo.textContent.trim());
      botao.textContent = botao.dataset.copiado;
    } catch {
      botao.textContent = botao.dataset.falhou;
    }
    setTimeout(() => (botao.textContent = rotulo), 2500);
  });
}
