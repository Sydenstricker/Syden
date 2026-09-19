; Páginas do instalador do Syden (NSIS, incluído pelo electron-builder).
; Este arquivo precisa ser UTF-8 com BOM, senão os acentos aparecem embaralhados.
; Quebra de linha no texto do NSIS é $\r$\n. Idiomas por código numérico, porque este arquivo é
; incluído antes de o NSIS carregar os idiomas: 1046 = português (Brasil), 1033 = inglês,
; 3082 = espanhol (o electron-builder usa "SpanishInternational").

; Pasta padrão. O que vem depois da última \ ("Syden") é acrescentado quando a pessoa escolhe uma pasta
; em "Procurar": escolher U:\ vira U:\Syden. Sem isso, escolher a raiz de um disco deixava o botão de
; instalar cinza (o NSIS não instala na raiz, porque desinstalar apagaria o disco inteiro).
InstallDir "$LOCALAPPDATA\Programs\Syden"

LangString sydenWelcomeTitle 1046 "Bem-vindo ao Syden!"
LangString sydenWelcomeTitle 1033 "Welcome to Syden!"
LangString sydenWelcomeTitle 3082 "¡Bienvenido a Syden!"

LangString sydenWelcomeText 1046 "Obrigado por escolher o Syden!$\r$\n$\r$\nEm poucos cliques você vai estar pronto para chamar a galera, compartilhar a tela e soltar aquele :kkkk: no chat.$\r$\n$\r$\nAqui não tem assinatura, não tem anúncio e não tem servidor cheio de estranhos. Só os seus amigos (e aquele que sempre esquece o microfone ligado).$\r$\n$\r$\nClique em Próximo para continuar."
LangString sydenWelcomeText 1033 "Thanks for choosing Syden!$\r$\n$\r$\nIn a few clicks you'll be ready to call the gang, share your screen and drop a :kkkk: in the chat.$\r$\n$\r$\nNo subscription, no ads and no server full of strangers. Just your friends (and that one who always forgets the mic on).$\r$\n$\r$\nClick Next to continue."
LangString sydenWelcomeText 3082 "¡Gracias por elegir Syden!$\r$\n$\r$\nEn pocos clics vas a estar listo para llamar a la banda, compartir la pantalla y soltar un :kkkk: en el chat.$\r$\n$\r$\nAquí no hay suscripción, no hay anuncios y no hay servidor lleno de desconocidos. Solo tus amigos (y ese que siempre deja el micrófono encendido).$\r$\n$\r$\nHaz clic en Siguiente para continuar."

LangString sydenFinishTitle 1046 "Tudo pronto!"
LangString sydenFinishTitle 1033 "All set!"
LangString sydenFinishTitle 3082 "¡Todo listo!"

LangString sydenFinishText 1046 "O Syden foi instalado com sucesso.$\r$\n$\r$\nAgora é só entrar numa sala e esperar a turma chegar. Se alguém perguntar quem trouxe o Syden para o grupo, pode assumir o crédito.$\r$\n$\r$\nBoa conversa!"
LangString sydenFinishText 1033 "Syden has been installed.$\r$\n$\r$\nNow just hop into a room and wait for the crew. If anyone asks who brought Syden to the group, feel free to take the credit.$\r$\n$\r$\nHave a great chat!"
LangString sydenFinishText 3082 "Syden se instaló correctamente.$\r$\n$\r$\nAhora solo entra a una sala y espera a que llegue la banda. Si alguien pregunta quién trajo Syden al grupo, puedes llevarte el crédito.$\r$\n$\r$\n¡Buena charla!"

LangString sydenRunText 1046 "Abrir o Syden agora"
LangString sydenRunText 1033 "Open Syden now"
LangString sydenRunText 3082 "Abrir Syden ahora"

LangString sydenGoodbyeTitle 1046 "Já vai?"
LangString sydenGoodbyeTitle 1033 "Leaving already?"
LangString sydenGoodbyeTitle 3082 "¿Ya te vas?"

LangString sydenGoodbyeText 1046 "Este assistente vai remover o Syden do seu computador.$\r$\n$\r$\nSua conta, mensagens e amizades continuam guardadas no servidor: se mudar de ideia, é só instalar de novo e entrar com a mesma conta. A porta fica sempre aberta.$\r$\n$\r$\nClique em Próximo para continuar."
LangString sydenGoodbyeText 1033 "This wizard will remove Syden from your computer.$\r$\n$\r$\nYour account, messages and friendships stay safe on the server: if you change your mind, just install it again and sign in with the same account. The door is always open.$\r$\n$\r$\nClick Next to continue."
LangString sydenGoodbyeText 3082 "Este asistente eliminará Syden de tu computadora.$\r$\n$\r$\nTu cuenta, tus mensajes y tus amistades siguen guardados en el servidor: si cambias de opinión, solo instálalo de nuevo e inicia sesión con la misma cuenta. La puerta siempre está abierta.$\r$\n$\r$\nHaz clic en Siguiente para continuar."

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(sydenWelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(sydenWelcomeText)"
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  ; Mesmo comportamento da página padrão: oferece abrir o Syden ao terminar.
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "$(sydenFinishTitle)"
  !define MUI_FINISHPAGE_TEXT "$(sydenFinishText)"
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "$(sydenRunText)"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(sydenGoodbyeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(sydenGoodbyeText)"
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
