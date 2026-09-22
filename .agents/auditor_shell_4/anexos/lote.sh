#!/bin/bash
X=/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/auditor_shell_4/anexos
for id in "$@"; do $X/mut.sh $id | tee -a $X/lote-resultados.txt; done
