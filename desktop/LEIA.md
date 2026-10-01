# O app de desktop do Syden

> Este arquivo começava com onze linhas que eram uma **duplicata truncada** da seção de baixo — alguém
> colou o bloco duas vezes e, no caminho, os trechos entre crases se perderam ("já estão no  —",
> "confira que ele existe em  e"). Foram removidas; o texto íntegro é o que está aqui.

## Submeter uma versão nova, do começo ao fim

**NÃO EXISTE COMANDO QUE SUBMETA.** O comando só GERA o pacote; o envio é na mão, no Partner Center, e
é assim de propósito — a Store pede notas de versão e confirmação a cada envio.

1. **Confira a versão** em `desktop/package.json` (`"version"`). É ela que vira o nome do arquivo e é
   ela que a Store compara: **enviar um pacote com versão igual ou menor que a publicada é recusado.**
2. **Publique o site ANTES**, se a build mudar de endereço. O app carrega `app.config.json` → hoje
   `https://syden.chat/app/`. Um pacote apontando para um endereço que ainda não existe abre direto na
   tela de sem conexão, e a certificação da Store vê isso.
3. **Gere:**
   ```bash
   npm run dist:loja -w desktop
   ```
4. **Confira que o arquivo saiu**, porque a geração termina com um erro esperado (ver abaixo):
   ```bash
   ls -la desktop/release/*.appx
   ```
5. **Envie** em [Partner Center](https://partner.microsoft.com/dashboard) → Syden → **Enviar
   atualização** → Pacotes → subir o `.appx` → **Notas de versão** → Enviar para certificação.
   A certificação costuma levar de algumas horas a um dia.

**Os textos da listagem estão em `store/listagem.md`** — cole de lá, não reescreva na hora.

## Publicar na Microsoft Store (tira o aviso do Windows)

O aviso de "aplicativo não reconhecido" some quando o pacote é assinado por uma autoridade em que o
Windows confia. Há dois caminhos, e só um deles é barato:

- **EXE/MSI**: a Microsoft **não assina**. Ela exige que o instalador já chegue assinado com certificado
  comprado de uma autoridade certificadora (R$ 1.000–2.000 por ano, renovável). Os US$ 19 da conta de
  desenvolvedor não resolvem nada aqui.
- **MSIX**: a **Microsoft assina o pacote** ao publicá-lo. Sem certificado, sem renovação, sem aviso.
  É o caminho que usamos.

Para gerar o pacote:

```bash
npm run dist:loja -w desktop
```

Os três valores de identidade já estão no `desktop/package.json` — são públicos (o Publisher aparece
dentro de todo MSIX publicado) e ficam ali para não haver chance de digitar errado na hora de gerar.

O `.appx` sai em `desktop/release/` e é o que se envia no Partner Center.

**O pacote sai SEM ASSINATURA, e é assim mesmo:** quem assina é a Microsoft, na publicação. A
consequência prática é que ele **não dá para instalar nesta máquina para testar** — o Windows recusa
pacote sem assinatura. Quem testa é a certificação da Store.

**Sobre erros no fim da geração — e este aviso já escondeu uma falha de verdade.**

Há um erro que é **mesmo** esperado nesta máquina: o electron-builder tenta extrair as ferramentas de
assinatura, que trazem links simbólicos do macOS, e o Windows recusa criá-los sem Modo de
Desenvolvedor. Esse é inofensivo, e o `.appx` já foi escrito antes dele.

**Mas existe outro erro que termina igualzinho na tela e NÃO gera pacote nenhum**, e foi o que
aconteceu com a 0.1.5: o manifesto ficou inválido e o empacotador da Microsoft recusou com
`0x80080204 - The package manifest is not valid`. Como o aviso acima dizia "um erro no fim é
esperado", a falha passaria por normal — e a submissão seria feita com o pacote da versão anterior,
ou não seria feita.

**Então a regra não é "ignore o erro": é OLHAR SE O ARQUIVO SAIU**, e com a data e o tamanho certos.

```bash
ls -la desktop/release/*.appx
```

Um `.appx` do Syden tem ~164 MB. Se o da versão que você acabou de gerar não está ali, a geração
falhou — não importa o que a tela disse. `desktop/test/manifesto.test.mjs` guarda as duas coisas que
já deram errado no manifesto, e roda junto com o `npm test`.

Para conferir por dentro o que a Store vai ler (identidade e se o módulo nativo do áudio entrou), o
`.appx` é um ZIP: o `AppxManifest.xml` está na raiz dele.

**O que muda para quem instalar pela Store:** quem atualiza é a Store, não o app. O `npm run dist` de
sempre continua gerando o `Syden-Setup.exe` para quem baixar direto do site — esse continua mostrando o
aviso, porque não é assinado.
