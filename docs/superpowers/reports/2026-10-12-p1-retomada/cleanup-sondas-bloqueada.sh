#!/bin/sh
# Usar somente com pares PID:PPID anotados nesta execução, após conferir a identidade.
# A visibilidade de /proc do executor é isolada; consulta o host como o MESMO uid, sem privilégios novos.
set -eu
[ "$#" -gt 0 ] || { echo 'informe PID:PPID dos filhos próprios do autoteste' >&2; exit 1; }
docker run --rm -i --pid=host --user="$(id -u)" redis:7.4-alpine sh -s -- "$@" <<'INNER'
set -eu
for par in "$@"; do
  case "$par" in *[!0-9:]*|'') exit 1;; esac
  pid=${par%:*}; pai=${par#*:}
  [ "$pid" != "$pai" ] || exit 1
  [ -r /proc/$pid/cmdline ] || continue
  realPai=$(awk '/^PPid:/ {print $2}' /proc/$pid/status)
  [ "$realPai" = "$pai" ] || { echo "PPID mudou: recusa pid=$pid"; exit 1; }
  # Recusa pai genérico; ambos devem ser os testes Node exatos anotados pelo worker.
  for processo in "$pid" "$pai"; do
    tr '\000' '\n' < /proc/$processo/cmdline | awk '$0=="base/verificacao/navegador.test.mjs" || $0=="/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/navegador.test.mjs" {f=1} END {exit !f}' || exit 1
  done
  echo "encerrando filho próprio do autoteste pid=$pid ppid=$pai"
  kill -TERM "$pid"
done
INNER
