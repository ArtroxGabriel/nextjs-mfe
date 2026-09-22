#!/bin/bash
# uso: mut.sh <ID> [e2e|e2e-sem-build|unit]
A=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad/aud2
C=$A/copia; L=$A/log
APPS="erp-shell erp-zona-1 erp-zona-2 erp-zona-acesso"
restaurar() { for r in $APPS; do git -C $C/repos/$r checkout -q -- . ; done; git -C $C/base checkout -q -- . ; }
R=$1; MODO=${2:-e2e}; restaurar
if ! node $A/muts.mjs $R; then echo "$R NAO APLICOU"; restaurar; exit 1; fi
for r in $APPS; do git -C $C/repos/$r diff; done > $L/$R.diff
echo "$R DIFF: $(grep -c '^[-+][^-+]' $L/$R.diff) linhas"
( cd $C/repos/erp-shell && timeout 180 node --test test/*.test.mjs > $L/$R.unit.txt 2>&1 )
echo "$R UNIT: $(grep -E '^ℹ (pass|fail)' $L/$R.unit.txt | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $L/$R.unit.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"
if [ "$MODO" != unit ]; then
  B=1; [ "$MODO" = e2e-sem-build ] && B=0
  ( cd $C && CONSTRUIR=$B timeout 1200 node --test base/verificacao/*.test.mjs > $L/$R.e2e.txt 2>&1 )
  $A/liberar.sh
  echo "$R E2E: $(grep -E '^ℹ (pass|fail)' $L/$R.e2e.txt | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $L/$R.e2e.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"
  grep -q 'build\|Command failed' $L/$R.e2e.txt && grep -m3 -E 'Command failed|Error:' $L/$R.e2e.txt | cut -c1-200
fi
restaurar
