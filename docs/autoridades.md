# Caso grave: remover, guardar a prova e comunicar às autoridades

O passo a passo de quem cuida do Syden quando aparece **exploração, abuso ou aliciamento de criança ou adolescente**.
É obrigação do ECA Digital (Lei 15.211/2025, arts. 27 e 28): remover, guardar e comunicar, **com ou sem denúncia**. Os
termos de uso (seção 6) prometem isso a quem usa o Syden.

Escrito em 17/10/2026, junto com a proteção de adolescentes (ver "Adolescentes no Syden" no CLAUDE.md).

## Como o caso chega

- **Denúncia marcada "envolve risco a uma criança ou adolescente"**: vai para o topo do painel (Uso do servidor →
  Denúncias), com a marca GRAVE.
- **O Shield bloqueou uma imagem** (correspondência com material conhecido): o registro do servidor ganha a linha
  `SHIELD BLOQUEOU UM ENVIO — olhe isto`, com o sha256. A imagem de uma denúncia de transmissão não é recusada (é a
  prova): a denúncia nasce GRAVE.
- **Qualquer outro caminho** (e-mail para contato@syden.chat, algo visto por acaso): abra uma denúncia você mesmo e
  marque como grave, para o caso ficar registrado no mesmo lugar.

## Os passos, na ordem

1. **Tirar do ar, na hora.** Apagar a mensagem ou o anexo; cortar a transmissão (menu da pessoa na chamada → Cortar a
   transmissão e a câmera); banir a conta (Uso do servidor → Denúncias → Banir ou suspender), com um motivo curto e
   sem detalhes do conteúdo.
2. **Guardar a prova antes de qualquer outra coisa.** O Syden já guarda sozinho: a cópia do texto denunciado, a
   imagem da denúncia de transmissão (a de caso grave não é apagada no prazo de 180 dias) e o registro de auditoria.
   **A conta banida NÃO deve ser excluída**: excluída, ela vai para a caixa-preta e some em 90 dias. Banida, ela
   continua inteira enquanto a autoridade precisar.
3. **Comunicar.** Fora do app, a pelo menos um destes (confira o endereço no dia; eles mudam):
   - **SaferNet Brasil** — a Central Nacional de Denúncias de Crimes Cibernéticos, em parceria com o Ministério Público
     Federal. Aceita denúncia de abuso sexual infantil online.
   - **Polícia Federal** — a comunicação de crimes cibernéticos pelo site da PF.
   - Em perigo imediato a uma criança: **Disque 100** (Direitos Humanos) ou **190**.
   - Se a vítima ou o autor estiver fora do Brasil: também o **NCMEC** (CyberTipline), que recebe de serviços do
     mundo todo.
   **Nunca baixe, reenvie nem mostre o material** a ninguém para "provar": a comunicação descreve onde está e quando,
   e a autoridade pede o que precisar. Repassar o material é crime, mesmo com boa intenção.
4. **Registrar no Syden.** Na denúncia, em "Para quem foi comunicado e o protocolo", escreva o órgão e o número do
   protocolo recebido, e clique em Registrar a comunicação. Fica no registro de auditoria para sempre: é o que mostra
   que a obrigação foi cumprida.
5. **Resolver a denúncia** dizendo o que foi feito (sem descrever o conteúdo).

## Pedido de autoridade depois

Ofício ou ordem judicial pedindo dados: responda pelo que está guardado — a conta banida (inteira), a denúncia com a
cópia e a imagem, o registro de auditoria, e, se a conta tiver sido excluída, a caixa-preta (`node
scripts/caixa-preta.mjs`, só dentro do servidor). O Marco Civil (art. 15) manda guardar os registros de acesso a
aplicação por 6 meses; o pedido da autoridade pode estender o prazo de um caso.
