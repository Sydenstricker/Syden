

Os três valores de identidade já estão no  — são públicos (o Publisher aparece
dentro de todo MSIX) e ficam ali para não haver chance de digitar errado na hora de gerar.

**O pacote sai SEM ASSINATURA, e é assim mesmo:** quem assina é a Microsoft, na publicação. A
consequência prática é que ele **não dá para instalar na sua máquina para testar** — o Windows recusa
pacote sem assinatura. Quem testa é a certificação da Store.

**Um aviso de erro no fim da geração é esperado** nesta máquina: o electron-builder tenta extrair as
ferramentas de assinatura, que contêm links simbólicos do macOS, e o Windows recusa criá-los sem Modo
de Desenvolvedor. O  já foi escrito antes disso. Confira que ele existe em  e
siga em frente.
## Publicar na Microsoft Store (tira o aviso do Windows)

O aviso de "aplicativo não reconhecido" some quando o pacote é assinado por uma autoridade em que o
Windows confia. Há dois caminhos, e só um deles é barato:

- **EXE/MSI**: a Microsoft **não assina**. Ela exige que o instalador já chegue assinado com certificado
  comprado de uma autoridade certificadora (R$ 1.000–2.000 por ano, renovável). Os US$ 19 da conta de
  desenvolvedor não resolvem nada aqui.
- **MSIX**: a **Microsoft assina o pacote** ao publicá-lo. Sem certificado, sem renovação, sem aviso.
  É o caminho que usamos.

Para gerar o pacote, três valores do Partner Center (o produto → *Identidade do produto*):

```bash
MSSTORE_IDENTITY_NAME=...          # "Nome do pacote"
MSSTORE_PUBLISHER="CN=..."         # a linha "Publisher", copiada letra por letra
MSSTORE_PUBLISHER_DISPLAY_NAME=... # "Nome de exibição do publisher"
npm run dist:loja -w desktop
```

O `.appx` sai em `desktop/release/` e é o que se envia no Partner Center.

**O que muda para quem instalar pela Store:** quem atualiza é a Store, não o app. O `npm run dist` de
sempre continua gerando o `Syden-Setup.exe` para quem baixar direto do site — esse continua mostrando o
aviso, porque não é assinado.
