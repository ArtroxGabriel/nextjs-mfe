#!/bin/bash
cd /home/wilson-castro/Documents/projects/mira/nextjs-mfe
for cfg in tarefa padrao; do for n in 10 30 100; do for p in / /zona1; do
  f=.agents/challenger_d19b_1/out-c1-$cfg-$n-$(echo $p | tr / _).txt
  node .agents/challenger_d19b_1/c1.mjs $cfg $n $p bruno 3 > $f 2>&1
done; done; done
echo done > .agents/challenger_d19b_1/c1.done
