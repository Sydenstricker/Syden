# O cofre: o banco e os arquivos guardados com cifra

Desde 20/10/2026 (decisão dele: degrau 1 da criptografia), o banco do Syden (`janja.db`) e os arquivos que as pessoas
sobem (`arquivos/`) moram num **disco cifrado (LUKS2)**, um arquivo de `/var/lib/syden/cofre.img` que só abre com a
senha. **A senha não fica no servidor:** os backups da Hetzner copiam o disco inteiro, e com a chave ao lado o backup
levaria as duas coisas.

## O que isto protege, e o que não protege

- **Protege:** os backups e snapshots da Hetzner, o disco da máquina desligada, um disco descartado ou levado. Quem
  tiver só isso tem um arquivo de ruído.
- **Não protege** a máquina LIGADA: com o cofre aberto, quem entrar como root no servidor lê tudo, como antes. Contra
  isso valem a chave SSH, o firewall e as atualizações.
- **Não é ponta a ponta:** o Syden continua lendo as mensagens para mostrar, buscar, moderar e responder à justiça. A
  política de privacidade só pode dizer "guardados com criptografia", nunca "nem nós lemos".

## As duas senhas

`cofre-criar.sh` pede duas: a **do dia a dia** e a **de recuperação** (qualquer uma abre). Guarde-as em lugares
DIFERENTES — por exemplo, a primeira no gerenciador de senhas e a segunda impressa, num lugar seguro. **Perder as duas
é perder o Syden inteiro:** não existe "esqueci a senha" num disco cifrado, nem a Hetzner consegue abrir.

## Criar a senha de recuperação depois

Se ela não foi criada no `cofre-criar.sh`: `sudo cryptsetup luksAddKey /var/lib/syden/cofre.img`. A PRIMEIRA pergunta
(`Enter any existing passphrase`) é a senha do cofre que já existe; as duas seguintes, a nova de recuperação.

## Criar o cofre (uma vez)

1. **Antes:** faça um snapshot do servidor no painel da Hetzner (Servidor → Snapshots). É a volta se algo der errado.
2. Atualize o servidor como sempre (`git pull`, `sudo docker compose up -d --build --wait`). O servidor novo sabe
   esperar o cofre.
3. Escolha uma hora vazia: a API fica fora do ar enquanto os dados são copiados (segundos para o banco; para os
   arquivos, depende do tamanho, uns 100 MB por segundo).
4. No servidor, em `deploy/`:
   ```bash
   chmod +x cofre-*.sh
   sudo ./cofre-criar.sh
   ```
   Ele mostra o tamanho que vai usar (3× os dados de hoje, mínimo 10 GB) e pergunta antes de seguir. Para escolher o
   tamanho: `sudo ./cofre-criar.sh 40G`.
5. Confira o Syden: entrar, ver as mensagens antigas, abrir um avatar e um anexo.

O script acrescenta ao `.env` duas linhas, `DADOS=/srv/syden-cofre/dados` e `COFRE=sim`: a primeira põe os dados no
cofre, a segunda faz a API se recusar a subir com o cofre fechado (senão ela criaria um banco novo e vazio).

## Depois de cada reinício da máquina

O Syden fica fora do ar até alguém abrir o cofre. Reinício é raro: atualização do Ubuntu que pede, manutenção da
Hetzner (eles avisam por e-mail), ou um desligamento pelo painel. O UptimeRobot avisa por e-mail quando cair.

```bash
ssh <servidor>
cd janja/deploy && sudo ./cofre-abrir.sh      # pede a senha
```

## Apagar o que ficou sem cifra

Depois de alguns dias com o Syden funcionando pelo cofre, os dados ANTIGOS, sem cifra, ainda estão em três lugares:

1. **O volume antigo do Docker:** `sudo docker volume rm deploy_janja_data` (o nome exato aparece no fim do
   `cofre-criar.sh`).
2. **Os backups da Hetzner de antes do cofre:** a Hetzner guarda os 7 últimos e vai trocando sozinha; em uma semana
   os antigos saem. Para não esperar, apague-os no painel (Servidor → Backups). Apague também o snapshot do passo 1.
3. **Os blocos do disco:** apagar um arquivo não apaga o conteúdo, e num disco virtual não há como garantir que um
   preenchimento com zeros cubra tudo. É a parte que só some de verdade com o tempo (o disco é reescrito) ou trocando
   de servidor. Vale saber; não vale perder sono.

## Se o cofre encher

`df -h /srv/syden-cofre` mostra quanto resta. Para aumentar (com a API parada, uns minutos):

```bash
cd janja/deploy && sudo docker compose stop api
sudo fallocate -l <novo tamanho, ex.: 80G> /var/lib/syden/cofre.img
sudo cryptsetup resize syden-cofre        # pede a senha
sudo resize2fs /dev/mapper/syden-cofre
sudo docker compose up -d --wait api
```

## Restaurar um backup da Hetzner

O backup traz o cofre cifrado junto com o resto do disco. Depois de restaurar, a máquina sobe com o cofre fechado:
`sudo ./cofre-abrir.sh` e a senha, como depois de qualquer reinício.
