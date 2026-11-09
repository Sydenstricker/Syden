#!/usr/bin/env bash
# Guarda um recorte limitado dos logs do host dentro do volume cifrado.
set -euo pipefail
umask 077

MONTAGEM=/srv/syden-cofre
DADOS="$MONTAGEM/dados"
AQUI="$(cd "$(dirname "$0")" && pwd)"
DESTINO="$DADOS/diagnostico-host.log"

[ "$(id -u)" -eq 0 ] || { echo "rode com sudo." >&2; exit 1; }
mountpoint -q "$MONTAGEM" || { echo "O cofre precisa estar montado em $MONTAGEM." >&2; exit 1; }
[ -d "$DADOS" ] || { echo "A pasta de dados não existe: $DADOS." >&2; exit 1; }

TEMP="$(mktemp "$DADOS/.diagnostico-host.XXXXXX")"
trap 'rm -f "$TEMP" "$TEMP.limite"' EXIT

{
  echo "Diagnóstico do host — UTC"
  date -u --iso-8601=seconds
  echo
  echo "=== Boots mantidos pelo journal ==="
  if ! journalctl --list-boots --no-pager; then
    echo "Falha ao listar os boots do journal."
  fi
  for BOOT in -2 -1 0; do
    echo
    echo "=== Boot $BOOT: Docker, SSH, logind e kernel (até 250 linhas) ==="
    if ! journalctl --boot="$BOOT" --unit=docker.service --unit=ssh.service --unit=systemd-logind.service \
        --kernel --no-pager --output=short-iso-precise --lines=250; then
      echo "Falha ao ler o journal do boot $BOOT."
    fi
  done
  echo
  echo "=== Estado dos serviços Docker deste deploy ==="
  if ! docker compose -f "$AQUI/docker-compose.yml" ps -a; then
    echo "Falha ao consultar os serviços Docker deste deploy."
  fi
} > "$TEMP"

TAMANHO="$(wc -c < "$TEMP")"
if [ "$TAMANHO" -gt 524288 ]; then
  {
    echo "AVISO: recorte reduzido para caber no limite de 512 KiB do painel."
    tail -c 500000 "$TEMP"
  } > "$TEMP.limite"
  mv "$TEMP.limite" "$TEMP"
fi

chown 1000:1000 "$TEMP"
chmod 600 "$TEMP"
mv "$TEMP" "$DESTINO"
echo "Diagnóstico do host salvo no volume cifrado."
