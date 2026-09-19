; Páginas do instalador do Janja (NSIS, incluído pelo electron-builder).
; Este arquivo precisa ser UTF-8 com BOM, senão os acentos aparecem embaralhados.
; Quebra de linha no texto do NSIS é $\r$\n. Idiomas por código numérico, porque este arquivo é
; incluído antes de o NSIS carregar os idiomas: 1046 = português (Brasil), 1033 = inglês,
; 3082 = espanhol (o electron-builder usa "SpanishInternational").

LangString janjaWelcomeTitle 1046 "Bem-vindo ao Janja!"
LangString janjaWelcomeTitle 1033 "Welcome to Janja!"
LangString janjaWelcomeTitle 3082 "¡Bienvenido a Janja!"

LangString janjaWelcomeText 1046 "Obrigado por escolher o Janja!$\r$\n$\r$\nEm poucos cliques você vai estar pronto para chamar a galera, compartilhar a tela e soltar aquele :kkkk: no chat.$\r$\n$\r$\nAqui não tem assinatura, não tem Nitro e não tem servidor cheio de estranhos. Só os seus amigos (e aquele que sempre esquece o microfone ligado).$\r$\n$\r$\nClique em Próximo para continuar."
LangString janjaWelcomeText 1033 "Thanks for choosing Janja!$\r$\n$\r$\nIn a few clicks you'll be ready to call the gang, share your screen and drop a :kkkk: in the chat.$\r$\n$\r$\nNo subscription, no Nitro and no server full of strangers. Just your friends (and that one who always forgets the mic on).$\r$\n$\r$\nClick Next to continue."
LangString janjaWelcomeText 3082 "¡Gracias por elegir Janja!$\r$\n$\r$\nEn pocos clics vas a estar listo para llamar a la banda, compartir la pantalla y soltar un :kkkk: en el chat.$\r$\n$\r$\nAquí no hay suscripción, no hay Nitro y no hay servidor lleno de desconocidos. Solo tus amigos (y ese que siempre deja el micrófono encendido).$\r$\n$\r$\nHaz clic en Siguiente para continuar."

LangString janjaFinishTitle 1046 "Tudo pronto!"
LangString janjaFinishTitle 1033 "All set!"
LangString janjaFinishTitle 3082 "¡Todo listo!"

LangString janjaFinishText 1046 "O Janja foi instalado com sucesso.$\r$\n$\r$\nAgora é só entrar numa sala e esperar a turma chegar. Se alguém perguntar quem trouxe o Janja para o grupo, pode assumir o crédito.$\r$\n$\r$\nBoa conversa!"
LangString janjaFinishText 1033 "Janja has been installed.$\r$\n$\r$\nNow just hop into a room and wait for the crew. If anyone asks who brought Janja to the group, feel free to take the credit.$\r$\n$\r$\nHave a great chat!"
LangString janjaFinishText 3082 "Janja se instaló correctamente.$\r$\n$\r$\nAhora solo entra a una sala y espera a que llegue la banda. Si alguien pregunta quién trajo Janja al grupo, puedes llevarte el crédito.$\r$\n$\r$\n¡Buena charla!"

LangString janjaRunText 1046 "Abrir o Janja agora"
LangString janjaRunText 1033 "Open Janja now"
LangString janjaRunText 3082 "Abrir Janja ahora"

LangString janjaGoodbyeTitle 1046 "Já vai?"
LangString janjaGoodbyeTitle 1033 "Leaving already?"
LangString janjaGoodbyeTitle 3082 "¿Ya te vas?"

LangString janjaGoodbyeText 1046 "Este assistente vai remover o Janja do seu computador.$\r$\n$\r$\nSua conta, mensagens e amizades continuam guardadas no servidor: se mudar de ideia, é só instalar de novo e entrar com a mesma conta. A porta fica sempre aberta.$\r$\n$\r$\nClique em Próximo para continuar."
LangString janjaGoodbyeText 1033 "This wizard will remove Janja from your computer.$\r$\n$\r$\nYour account, messages and friendships stay safe on the server: if you change your mind, just install it again and sign in with the same account. The door is always open.$\r$\n$\r$\nClick Next to continue."
LangString janjaGoodbyeText 3082 "Este asistente eliminará Janja de tu computadora.$\r$\n$\r$\nTu cuenta, tus mensajes y tus amistades siguen guardados en el servidor: si cambias de opinión, solo instálalo de nuevo e inicia sesión con la misma cuenta. La puerta siempre está abierta.$\r$\n$\r$\nHaz clic en Siguiente para continuar."

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(janjaWelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(janjaWelcomeText)"
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  ; Mesmo comportamento da página padrão: oferece abrir o Janja ao terminar.
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "$(janjaFinishTitle)"
  !define MUI_FINISHPAGE_TEXT "$(janjaFinishText)"
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "$(janjaRunText)"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(janjaGoodbyeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(janjaGoodbyeText)"
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
