#!/bin/bash
# uso: np.sh — cria, uma de cada vez, uma página de módulo nova numa zona da CÓPIA e roda só os
# testes estáticos (l1-estatico.test.mjs = texto do base.test.mjs). Depois apaga a página.
C=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/09322a0e-689b-4bc7-ad2e-80de22035516/scratchpad/aud4/copia
X=/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/auditor_shell_4/anexos
PAG="import { exigirModulo } from '@/lib/pagina'
export default async function P() {
  await exigirModulo('zona1.painel')
  return <p>Conteudo novo</p>
}"
caso() { # id app caminho-relativo-ao-app/app  [conteudo]
  local id=$1 app=$2 rel=$3 f="$C/repos/$2/app/$3"
  mkdir -p "$(dirname "$f")"; printf '%s\n' "${4:-$PAG}" > "$f"
  local out; out=$(cd $C && node --test base/verificacao-aud4/l1-estatico.test.mjs 2>&1)
  local l1 i16
  l1=$(echo "$out" | grep -q '^✖ L1 cobre' && echo REPROVA || echo passa)
  i16=$(echo "$out" | grep -q '^✖ invariante 16 estatico' && echo REPROVA || echo passa)
  printf '%-22s %-16s %-45s L1-completude=%-8s inv16-estatico=%s\n' "$id" "$app" "$rel" "$l1" "$i16"
  echo "$out" | grep -E "sem entrada|sem exigirModulo" | head -2 | sed 's/^/      /'
  git -C $C/repos/$app checkout -q -- . ; git -C $C/repos/$app clean -fdq app
}
caso NP-literal       erp-zona-1 'zona1/novo/page.tsx'
caso NP-grupo         erp-zona-1 'zona1/(grupo)/novo/page.tsx'
caso NP-grupo-raiz    erp-zona-2 '(interno)/zona2/extra/page.tsx'
caso NP-dinamico-z1   erp-zona-1 'zona1/[secao]/page.tsx'
caso NP-dinamico-z2   erp-zona-2 'zona2/[id]/page.tsx'
caso NP-dinamico-rec  erp-zona-1 'zona1/recursos/[id]/editar/page.tsx'
caso NP-dinamico-raiz erp-zona-acesso '[x]/page.tsx'
caso NP-catchall      erp-zona-1 'zona1/[...resto]/page.tsx'
caso NP-catchall-opc  erp-zona-1 'zona1/recursos/[[...r]]/page.tsx'
caso NP-publico       erp-zona-1 'zona1/(publico)/segredo/page.tsx'
caso NP-publico-sem16 erp-zona-1 'zona1/(publico)/segredo/page.tsx' "export default function P() { return <p>Conteudo novo</p> }"
caso NP-page-ts       erp-zona-1 'zona1/novo/page.ts' "import { createElement } from 'react'
export default function P() { return createElement('p', null, 'Conteudo novo') }"
caso NP-page-jsx      erp-zona-1 'zona1/novo/page.jsx' "export default function P() { return <p>Conteudo novo</p> }"
caso NP-page-js       erp-zona-2 'zona2/novo/page.js' "export default function P() { return null }"
caso NP-paralela      erp-zona-1 'zona1/@modal/page.tsx'
caso NP-shell         erp-shell  '(app)/painel/page.tsx'
