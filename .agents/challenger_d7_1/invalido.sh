#!/bin/bash
D=/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/challenger_d7_1
cd /home/wilson-castro/Documents/projects/mira/nextjs-mfe/repos/erp-shell
echo "=== $*" >> $D/out-t3-invalidos.txt
env "$@" ERP_PERMITIR_IDENTIDADE_DEV=1 SESSAO_DIR=$(mktemp -d) setsid pnpm exec next start -p 3000 > $D/l.tmp 2>&1 &
P=$!
sleep 7
curl -s -o /dev/null -w "http=%{http_code}\n" -m 5 localhost:3000/login >> $D/out-t3-invalidos.txt
sleep 1
kill -TERM -- -$P 2>/dev/null; sleep 1; kill -KILL -- -$P 2>/dev/null
grep -iE "configuracao|rror" $D/l.tmp | head -3 >> $D/out-t3-invalidos.txt
