#!/usr/bin/env bash
# Abre o cofre depois de um reinício da máquina e põe o Syden de volta no ar.
# No servidor, de dentro de deploy/:   sudo ./cofre-abrir.sh
#
# Enquanto o cofre está fechado, a API não sobe (ela confere a marca .cofre, ver server/src/config.ts) e o site mostra o
# Syden fora do ar. O Caddy e o LiveKit sobem sozinhos; só a API espera a senha.
set -euo pipefail

ARQUIVO=/var/lib/syden/cofre.img
NOME=syden-cofre
MONTAGEM=/srv/syden-cofre
AQUI="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "rode com sudo." >&2; exit 1; }
[ -f "$ARQUIVO" ] || { echo "não há cofre em $ARQUIVO (ele foi criado? ver docs/cofre.md)" >&2; exit 1; }

if mountpoint -q "$MONTAGEM"; then
  echo "O cofre já está aberto."
else
  [ -e "/dev/mapper/$NOME" ] || cryptsetup open "$ARQUIVO" "$NOME"
  mount "/dev/mapper/$NOME" "$MONTAGEM"
  echo "Cofre aberto."
fi

cd "$AQUI"
docker compose up -d --wait api
echo "O Syden está no ar."
