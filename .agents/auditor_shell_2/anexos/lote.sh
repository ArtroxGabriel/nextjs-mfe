#!/bin/bash
A=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad/aud2
for id in "$@"; do
  case $id in N8*) m=e2e-sem-build;; *) m=e2e;; esac
  $A/mut.sh $id $m
done
