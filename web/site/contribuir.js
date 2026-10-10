// O botão "Copiar o Pix" da página de contribuir.
//
// Ele nasce ESCONDIDO no HTML e só aparece aqui, quando o navegador sabe copiar: um botão que não
// copia nada é pior do que nenhum botão. Sem ele, o código continua na tela para selecionar à mão.
const botao = document.querySelector('[data-copiar]');
const alvo = botao && document.getElementById(botao.dataset.copiar);

if (botao && alvo && alvo.textContent.trim() && navigator.clipboard) {
  const rotulo = botao.textContent;
  botao.hidden = false;
  botao.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(alvo.textContent.trim());
      botao.textContent = 'Copiado!';
    } catch {
      botao.textContent = 'Não deu para copiar: selecione o código acima';
    }
    setTimeout(() => (botao.textContent = rotulo), 2500);
  });
}
