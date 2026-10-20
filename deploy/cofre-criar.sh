#!/usr/bin/env bash
# Cria o COFRE do Syden: um disco cifrado (LUKS2) onde passam a morar o banco e os arquivos, e muda os dados
# para dentro dele. Roda UMA VEZ, no servidor, de dentro de deploy/:   sudo ./cofre-criar.sh [tamanho, ex.: 40G]
#
# Por que a senha não fica no servidor (decisão dele, 20/10/2026): os backups da Hetzner copiam o disco inteiro.
# Com a chave ao lado dos dados, o backup levaria as duas coisas, e cifrar não protegeria nada. O preço: depois de
# cada reinício da máquina, o Syden só volta quando alguém rodar ./cofre-abrir.sh e digitar a senha.
#
# O passo a passo, com o que fazer se der errado, está em docs/cofre.md. LEIA ANTES.
set -euo pipefail

ARQUIVO=/var/lib/syden/cofre.img
NOME=syden-cofre
MONTAGEM=/srv/syden-cofre
DADOS="$MONTAGEM/dados"
AQUI="$(cd "$(dirname "$0")" && pwd)"

falha() { echo "ERRO: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "rode com sudo."
[ -f "$AQUI/.env" ] || falha "não achei $AQUI/.env (rode de dentro de deploy/)."
[ ! -e "$ARQUIVO" ] || falha "o cofre já existe ($ARQUIVO). Para abrir depois de um reinício: ./cofre-abrir.sh"
grep -q '^DADOS=' "$AQUI/.env" && falha "o .env já tem DADOS=: o cofre parece já ter sido configurado."
command -v cryptsetup >/dev/null || { echo "Instalando o cryptsetup…"; apt-get update -qq && apt-get install -y -qq cryptsetup; }
command -v rsync >/dev/null || apt-get install -y -qq rsync

# O volume de hoje (o nome leva o projeto do compose na frente: deploy_janja_data).
VOLUMES=$(docker volume ls -q | grep -E '(^|_)janja_data$' || true)
[ "$(echo "$VOLUMES" | grep -c .)" -eq 1 ] || falha "esperava UM volume *_janja_data, achei: '$VOLUMES'"
ORIGEM=$(docker volume inspect "$VOLUMES" -f '{{.Mountpoint}}')
USADO_MB=$(du -sm "$ORIGEM" | cut -f1)
LIVRE_MB=$(df -m --output=avail /var/lib | tail -1 | tr -d ' ')

# Tamanho: o pedido, ou 3× o que os dados ocupam hoje (no mínimo 10 GB), sem passar do livre menos 5 GB.
if [ $# -ge 1 ]; then
  TAMANHO="$1"
else
  QUER_MB=$(( USADO_MB * 3 )); [ "$QUER_MB" -lt 10240 ] && QUER_MB=10240
  CABE_MB=$(( LIVRE_MB - 5120 ))
  [ "$QUER_MB" -gt "$CABE_MB" ] && QUER_MB=$CABE_MB
  TAMANHO="${QUER_MB}M"
fi
echo "Dados de hoje: ${USADO_MB} MB em $ORIGEM. Livre no disco: ${LIVRE_MB} MB. Cofre: $TAMANHO."
read -r -p "Seguir? O Syden fica fora do ar durante a cópia. [s/N] " ok
[ "$ok" = "s" ] || exit 1

mkdir -p "$(dirname "$ARQUIVO")"
fallocate -l "$TAMANHO" "$ARQUIVO"
chmod 600 "$ARQUIVO"

echo
echo "== A SENHA DO COFRE. Guarde-a no gerenciador de senhas ANTES de seguir: sem ela, os dados se perdem. =="
cryptsetup luksFormat --type luks2 --batch-mode --verify-passphrase "$ARQUIVO"
echo "Agora a mesma senha, para abrir:"
cryptsetup open "$ARQUIVO" "$NOME"
mkfs.ext4 -q -L syden-cofre "/dev/mapper/$NOME"

# A pasta onde o cofre se monta fica IMUTÁVEL quando vazia: com o cofre fechado, nada consegue gravar nela —
# nem o Docker, que criaria $DADOS vazio e deixaria o servidor subir sem os dados de verdade.
mkdir -p "$MONTAGEM"
chattr +i "$MONTAGEM"
mount "/dev/mapper/$NOME" "$MONTAGEM"

echo "Parando a API e copiando os dados para dentro do cofre…"
cd "$AQUI"
docker compose stop api
mkdir -p "$DADOS"
rsync -aHAX "$ORIGEM/" "$DADOS/"
touch "$DADOS/.cofre"
chown --reference="$ORIGEM" "$DADOS" "$DADOS/.cofre"

# A SENHA DE RECUPERAÇÃO. O cryptsetup pergunta PRIMEIRO pela senha que já existe ("Enter any existing passphrase") e só
# depois pela nova — e em 20/10/2026, na primeira vez que isto rodou de verdade, a de recuperação foi digitada na
# primeira pergunta, o script parou aqui e deixou o Syden fora do ar. Por isso o aviso diz qual é qual, e errar a
# senha não derruba mais nada: dá para tentar de novo, ou pular e criar a de recuperação depois (docs/cofre.md).
echo
echo "== SENHA DE RECUPERAÇÃO: uma segunda senha que também abre o cofre. Guarde num lugar DIFERENTE da primeira. =="
echo "   1ª pergunta (Enter any existing passphrase): a senha do COFRE, a que você acabou de criar."
echo "   2ª e 3ª (Enter new passphrase / Verify): a NOVA senha de recuperação."
until cryptsetup luksAddKey "$ARQUIVO"; do
  read -r -p "Não deu. Tentar de novo? (n pula; crie depois com: sudo cryptsetup luksAddKey $ARQUIVO) [S/n] " de_novo
  [ "$de_novo" = "n" ] && break
done

printf '\n# O cofre (deploy/cofre-criar.sh, %s): os dados moram no disco cifrado.\nDADOS=%s\nCOFRE=sim\n' "$(date +%F)" "$DADOS" >> .env
docker compose up -d --wait api

echo
echo "Pronto: o Syden está rodando com os dados no cofre."
echo "Os dados ANTIGOS, sem cifra, continuam no volume $VOLUMES. Confira o Syden por alguns dias e então siga"
echo "a seção 'Apagar o que ficou sem cifra' de docs/cofre.md."
