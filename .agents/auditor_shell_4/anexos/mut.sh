#!/bin/bash
# uso: mut.sh <ID|BASE> [e2e|unit]   Aplica a mutação na CÓPIA, roda as suítes, restaura.
#  - apps: unidade do shell (node --test test/*.test.mjs) + e2e (CONSTRUIR=1 node --test base/verificacao/*.test.mjs)
#  - D-*: dist do @erp/nucleo instalado nas apps; força rebuild (touch package.json) e restaura o dist depois
#  - N-*: fonte do erp-nucleo; roda só a unidade do núcleo (tsc + node --conditions react-server --test test/*.test.mjs)
S=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/09322a0e-689b-4bc7-ad2e-80de22035516/scratchpad/aud4
X=/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/auditor_shell_4/anexos
C=$S/copia; L=$X/saidas; mkdir -p $L
APPS="erp-shell erp-zona-1 erp-zona-2 erp-zona-acesso"
restaurar() {
  for r in $APPS erp-nucleo erp-dominio-stub; do git -C $C/repos/$r checkout -q -- . ; git -C $C/repos/$r clean -fdq -e node_modules -e .next -e dist ; done
  rm -rf $C/base/verificacao $C/base/scripts; cp -a $S/base-orig/verificacao $S/base-orig/scripts $C/base/
  if [ "$1" = dist ]; then
    for a in $APPS; do cp -a $S/dist-orig/$a/. "$(readlink -f $C/repos/$a/node_modules/@erp/nucleo)/dist/"; touch $C/repos/$a/package.json; done
  fi
}
R=$1; MODO=${2:-e2e}
case $R in D-*) TIPO=dist;; N-*) TIPO=nucleo;; *) TIPO=app;; esac
restaurar
if [ "$R" != BASE ] && ! node $X/muts.mjs $R; then echo "$R NAO APLICOU"; restaurar $TIPO; exit 1; fi
if [ $TIPO = dist ]; then
  for a in $APPS; do diff -r $S/dist-orig/$a "$(readlink -f $C/repos/$a/node_modules/@erp/nucleo)/dist"; touch $C/repos/$a/package.json; done > $L/$R.diff
else
  for r in $APPS erp-nucleo; do git -C $C/repos/$r diff; done > $L/$R.diff
fi
echo "$R DIFF: $(grep -c '^[-+<>][^-+<>]' $L/$R.diff) linhas"
resumo() { echo "$(grep -E '^ℹ (pass|fail)' $1 | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $1 | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"; }
if [ $TIPO = nucleo ]; then
  ( cd $C/repos/erp-nucleo && npx tsc -p tsconfig.json && timeout 300 node --conditions react-server --test test/*.test.mjs ) > $L/$R.nucleo.txt 2>&1
  echo "$R NUCLEO: $(resumo $L/$R.nucleo.txt)"
  restaurar; ( cd $C/repos/erp-nucleo && npx tsc -p tsconfig.json ); exit 0
fi
( cd $C/repos/erp-shell && timeout 180 node --test test/*.test.mjs > $L/$R.unit.txt 2>&1 )
echo "$R UNIT: $(resumo $L/$R.unit.txt)"
if [ "$MODO" != unit ]; then
  ( cd $C && CONSTRUIR=1 timeout 1500 node --test base/verificacao/*.test.mjs > $L/$R.e2e.txt 2>&1 )
  $X/liberar.sh
  echo "$R E2E: $(resumo $L/$R.e2e.txt)"
  grep -q 'Command failed' $L/$R.e2e.txt && grep -m3 -E 'Command failed|Error:' $L/$R.e2e.txt | cut -c1-200
fi
restaurar $TIPO
