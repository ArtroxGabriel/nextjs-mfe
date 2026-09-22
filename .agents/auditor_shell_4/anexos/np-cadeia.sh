#!/bin/bash
# Prova de ponta a ponta do buraco do teste de completude do L1: página de módulo nova /zona1/[secao]
# com o MESMO fail-open vetado (engole erro com `codigo`, deixa notFound() subir), na CÓPIA.
# Roda a suíte inteira (CONSTRUIR=1) e depois só G11 de lacunas4.test.mjs. Restaura no fim.
S=/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/09322a0e-689b-4bc7-ad2e-80de22035516/scratchpad/aud4
C=$S/copia; X=/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/auditor_shell_4/anexos; L=$X/saidas
F="$C/repos/erp-zona-1/app/zona1/[secao]/page.tsx"
mkdir -p "$(dirname "$F")"
cat > "$F" <<'PAG'
import { exigirModulo } from '@/lib/pagina'
import { listarRecursos } from '@/lib/dominio-a'

export default async function Secao({ params }: { params: Promise<{ secao: string }> }) {
  try { await exigirModulo('zona1.painel') } catch (e) { if (!(e && typeof e === 'object' && 'codigo' in e)) throw e }
  const { secao } = await params
  const recursos = await listarRecursos()
  return (<><h1>Secao do modulo {secao}</h1><ul>{recursos.map((r) => <li key={r.id}>{r.nome}</li>)}</ul></>)
}
PAG
git -C $C/repos/erp-zona-1 status --porcelain > $L/NP-cadeia.diff; cat "$F" >> $L/NP-cadeia.diff
( cd $C && CONSTRUIR=1 timeout 1500 node --test base/verificacao/*.test.mjs > $L/NP-cadeia.e2e.txt 2>&1 ); $X/liberar.sh
echo "NP-cadeia E2E: $(grep -E '^ℹ (pass|fail)' $L/NP-cadeia.e2e.txt | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $L/NP-cadeia.e2e.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"
cp $X/lacunas4.test.mjs $C/base/verificacao/
( cd $C && timeout 600 node --test --test-name-pattern G11 base/verificacao/lacunas4.test.mjs > $L/NP-cadeia.lac.txt 2>&1 ); $X/liberar.sh
echo "NP-cadeia LAC(G11): $(grep -E '^ℹ (pass|fail)' $L/NP-cadeia.lac.txt | tr '\n' ' ') FALHAS: $(grep -E '^✖ ' $L/NP-cadeia.lac.txt | sed 's/ ([0-9.]*ms)//' | sort -u | tr '\n' ';')"
rm -f $C/base/verificacao/lacunas4.test.mjs
git -C $C/repos/erp-zona-1 checkout -q -- . ; git -C $C/repos/erp-zona-1 clean -fdq app; touch $C/repos/erp-zona-1/package.json
