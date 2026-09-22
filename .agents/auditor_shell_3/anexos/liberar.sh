#!/bin/bash
# Mata o que estiver escutando nas portas do gate (nunca a 4873).
for p in 3000 3001 3002 3003 4001 4002 4003 4004 4010; do
  for pid in $(ss -ltnpH "sport = :$p" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do kill -9 $pid 2>/dev/null; done
done
sleep 0.5
ss -ltnH | grep -E ':(300[0-3]|400[1-4]|4010)\b' && echo "PORTAS AINDA OCUPADAS" || true
