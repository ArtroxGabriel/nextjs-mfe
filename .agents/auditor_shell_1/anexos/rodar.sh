#!/bin/bash
# uso: rodar.sh <rotulo> [e2e]   — roda a unidade do shell (cópia) e, se pedido, a e2e com CONSTRUIR=1
S=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad
C=$S/repos-copia; L=$S/mut/log; mkdir -p $L
R=$1
( cd $C/erp-shell && timeout 120 node --test test/*.test.mjs > $L/$R.unit.txt 2>&1 )
U=$(grep -E '^ℹ (pass|fail)' $L/$R.unit.txt | tr '\n' ' ')
UF=$(grep -E '^✖ ' $L/$R.unit.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')
echo "$R UNIT: $U FALHAS: $UF"
if [ "$2" = e2e ]; then
  ( cd $C && CONSTRUIR=1 timeout 900 node --test verificacao/*.test.mjs > $L/$R.e2e.txt 2>&1 )
  $S/mut/liberar.sh
  E=$(grep -E '^ℹ (pass|fail)' $L/$R.e2e.txt | tr '\n' ' ')
  EF=$(grep -E '^✖ ' $L/$R.e2e.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')
  echo "$R E2E: $E FALHAS: $EF"
fi
