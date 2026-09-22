#!/bin/bash
# uso: mutL.sh <ID|BASE>  -> roda só lacunas2 (e2e) e a unidade extra (test-aud) contra a mutação
A=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad/aud2
C=$A/copia; L=$A/log
APPS="erp-shell erp-zona-1 erp-zona-2 erp-zona-acesso"
restaurar() { for r in $APPS; do git -C $C/repos/$r checkout -q -- . ; done; }
R=$1; restaurar
[ "$R" = BASE ] || node $A/muts.mjs $R || { echo "$R NAO APLICOU"; exit 1; }
( cd $C/repos/erp-shell && timeout 60 node --test test-aud/*.test.mjs > $L/$R.uaud.txt 2>&1 )
echo "$R UAUD: $(grep -E '^ℹ (pass|fail)' $L/$R.uaud.txt | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $L/$R.uaud.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"
if [ "$2" != unit ]; then
( cd $C && CONSTRUIR=1 timeout 900 node --test base/verificacao/lacunas2.test.mjs > $L/$R.lac.txt 2>&1 )
$A/liberar.sh
echo "$R LAC: $(grep -E '^ℹ (pass|fail)' $L/$R.lac.txt | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $L/$R.lac.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"
fi
restaurar
