#!/bin/bash
# uso: mutL.sh <ID|BASE> : aplica a mutação na cópia e roda SÓ anexos/lacunas3.test.mjs (e2e), depois restaura
S=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/09322a0e-689b-4bc7-ad2e-80de22035516/scratchpad/aud3
X=/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/auditor_shell_3/anexos
C=$S/copia; L=$X/saidas; APPS="erp-shell erp-zona-1 erp-zona-2 erp-zona-acesso"
restaurar() {
  for r in $APPS; do git -C $C/repos/$r checkout -q -- . ; done
  for a in $APPS; do cp -a $S/dist-orig/$a/. "$(readlink -f $C/repos/$a/node_modules/@erp/nucleo)/dist/"; done
  rm -f $C/base/verificacao/lacunas3.test.mjs
}
R=$1; restaurar
[ "$R" = BASE ] || node $X/muts.mjs $R || { echo "$R NAO APLICOU"; exit 1; }
case $R in D-*) for a in $APPS; do touch $C/repos/$a/package.json; done;; esac
cp $X/lacunas3.test.mjs $C/base/verificacao/
( cd $C && CONSTRUIR=1 timeout 900 node --test base/verificacao/lacunas3.test.mjs > $L/$R.lac.txt 2>&1 )
$X/liberar.sh
echo "$R LAC: $(grep -E '^ℹ (pass|fail)' $L/$R.lac.txt | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $L/$R.lac.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"
restaurar
case $R in D-*) for a in $APPS; do touch $C/repos/$a/package.json; done;; esac
