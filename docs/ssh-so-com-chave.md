# SSH só com chave: fechar a porta para as tentativas de senha

**Plano escrito em 09/11/2026, a pedido dele, para retomar depois dos testes do PixelLab.** Ainda NÃO foi feito.

## O que se mediu em 12/11/2026 (e por que ficou como pendência, decisão dele)

- **A senha do root já não entra pelo SSH** (`PermitRootLogin prohibit-password` já vale), e **nenhuma conta tem senha
  utilizável** (o `/etc/shadow` não tem hash em ninguém; só o root tem shell). Uma senha vazada não serve hoje: as ~14,8
  mil tentativas por dia não têm chance. A etapa 2 vira defesa a mais (um usuário criado no futuro com senha).
- **Por isso a etapa 0 muda:** não há senha do root para entrar no console da Hetzner. A porta de emergência de verdade é
  o **"Reset root password"** do painel, que gera uma na hora. A conta da Hetzner (senha forte; conferir a verificação em
  duas etapas) é a porta que importa.
- **O risco que sobra é a chave do PC SEM SENHA** (conferido: `ssh-keygen -y -P '' -f ~/.ssh/id_ed25519` abre). Quem
  copiar o arquivo entra como root. A saída, quando ele quiser:

```powershell
ssh-keygen -p -f $env:USERPROFILE\.ssh\id_ed25519        # a senha nova; a chave é a mesma, o servidor não muda
# como administrador, uma vez: o agente guarda a chave aberta enquanto o Windows estiver logado
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519                   # depois de cada vez que ligar o PC
```

  O que muda: sem o agente, cada `ssh` pede a senha (o `git pull` e o resto dentro da conexão, não), e o `ssh` que o
  Claude roda nas conversas (logs, diagnóstico) FALHA, porque não tem como digitar a senha. Com o agente, nada muda,
  exceto o primeiro `ssh` depois de ligar o PC. O deploy do site e as tarefas do servidor não usam esta chave.

## Por que

O SSH é a porta pela qual se entra no servidor para administrá-lo (é por ela que se roda `cofre-abrir.sh`). Hoje ela
aceita dois jeitos de provar quem é: a **senha** e a **chave** (um arquivo que só existe no computador dele).

O registro do servidor mostra robôs do mundo inteiro tentando, o dia todo, entrar como `root`, `admin`, `steam`,
`user`… com senhas chutadas, várias por minuto (`journalctl` de 08/11/2026). Nenhum entrou. Mas, enquanto a senha for
aceita, cada tentativa é uma chance: se a senha do root for fraca ou vazar, quem entrar tem a máquina inteira — o banco,
os arquivos e, com o cofre aberto, tudo o que ele protege (ver `docs/cofre.md`: o cofre não protege a máquina ligada;
contra isso vale a chave SSH).

**A solução final (decisão dele):** o SSH aceita **só a chave do PC dele**; a **porta de emergência é o console da
Hetzner** (Cloud Console → o servidor → ícone `>_`), uma tela do servidor dentro do navegador que não depende do SSH e
onde se entra com a senha do root. Opcional, e recomendado: uma **segunda chave**, de outro aparelho, para não depender
de um computador só.

## O cuidado que não se pula

**Perder o acesso ao servidor é crítico.** Por isso: testar a porta de emergência ANTES, testar a chave ANTES, manter
uma sessão SSH aberta durante a troca e só fechá-la depois de entrar de novo, numa janela nova, só com a chave. O
servidor também valida a configuração (`sshd -t`) antes de aplicá-la.

## As etapas (uma por vez; cola-se o resultado de cada uma antes da próxima)

### Etapa 0 — a porta de emergência funciona?

No painel da Hetzner: o servidor → **Console** (`>_`). Entrar como `root` com a senha do root.

- Entrou: anotar essa senha num lugar seguro (gerenciador de senhas). É ela que salva o dia se a chave sumir.
- Não sabe a senha: PARAR e decidir junto. O painel tem "Reset root password", que gera uma nova — só com calma.

### Etapa 1 — a chave do PC já entra sozinha?

No PowerShell do PC dele:

```powershell
ssh -o PasswordAuthentication=no -o PreferredAuthentications=publickey root@2.28.78.99 "echo entrou com a chave"
```

- `entrou com a chave`: a chave já funciona; pular para a etapa 2.
- `Permission denied (publickey…)`: copiar a chave para o servidor (pede a senha uma última vez) e repetir o teste:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@2.28.78.99 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

  (Se não existir `id_ed25519.pub`, criar antes com `ssh-keygen -t ed25519`, aceitando o lugar padrão e pondo uma
  senha na chave.)

### Etapa 2 — desligar a senha (com uma janela de segurança aberta)

1. Abrir uma sessão SSH e **deixá-la aberta** até o fim (é a rede de segurança).
2. Nela, criar o arquivo que manda no resto (o prefixo `00-` faz ele valer antes do `50-cloud-init.conf`, que no
   Ubuntu costuma ligar a senha):

```bash
cat > /etc/ssh/sshd_config.d/00-so-chave.conf <<'FIM'
# Só chave: a senha nem é tentada (docs/ssh-so-com-chave.md). Emergência: o console da Hetzner.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
FIM
sshd -t && systemctl reload ssh
```

   `sshd -t` só deixa recarregar se a configuração estiver certa; se ele reclamar, nada mudou.
3. **Numa janela NOVA** do PowerShell, sem fechar a outra, repetir o teste da etapa 1. Tem de dar `entrou com a chave`.
4. Conferir que a senha agora é recusada:

```powershell
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password root@2.28.78.99
```

   Tem de responder `Permission denied (publickey)` sem nem pedir senha.
5. Só então fechar a janela de segurança.

**Se algo der errado no passo 3:** a janela de segurança continua conectada; nela, `rm /etc/ssh/sshd_config.d/00-so-chave.conf
&& systemctl reload ssh` desfaz tudo. Se as duas janelas caírem: o console da Hetzner (etapa 0) e o mesmo comando.

### Etapa 3 (opcional) — a segunda chave

No outro aparelho, `ssh-keygen -t ed25519`, e a linha do `.pub` dele acrescentada a `~/.ssh/authorized_keys` no
servidor (pela sessão que já entra). Testar a entrada a partir dele.

## Depois (não faz parte deste plano)

- `fail2ban`, para nem registrar as tentativas: com a senha desligada, elas já não têm chance; é só barulho no registro.
- Registrar aqui a data em que foi feito e em quais aparelhos estão as chaves.
