#!/bin/bash
# uso: mutacoes.sh <ID> <unit|e2e>
S=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad
C=$S/repos-copia; mkdir -p $S/mut/log
restaurar() { for r in erp-shell erp-zona-1 erp-zona-2 erp-zona-acesso; do git -C $C/$r checkout -q -- . ; done; }
R=$1; restaurar
if ! node $S/mut/muts.mjs $R; then echo "$R NAO APLICOU"; restaurar; exit 1; fi
for r in erp-shell erp-zona-1 erp-zona-2 erp-zona-acesso; do git -C $C/$r diff; done > $S/mut/log/$R.diff
echo "$R DIFF: $(grep -c '^[-+][^-+]' $S/mut/log/$R.diff) linhas"
$S/mut/rodar.sh $R $2
restaurar
