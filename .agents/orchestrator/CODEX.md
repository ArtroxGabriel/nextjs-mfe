# Handoff para o Codex (2026-10-13)

O estado atual está em `RETOMADA.md`; este arquivo só registra como o Codex entra no processo.

- Desde 2026-10-12 o orquestrador (Claude) despacha o trabalho para o Codex local com `codex exec` em sandbox `workspace-write`. `.git/` e `.agents/` do principal são somente leitura na sandbox: o Codex commita nos submódulos quando autorizado e entrega os textos; o orquestrador aplica e commita o principal.
- Antes de qualquer trabalho: `AGENTS.md`, `LEIA-PRIMEIRO.md`, `RETOMADA.md`, `AMBIENTE.md` e o plano em curso em `docs/superpowers/plans/`.
- Gate local do P1 aprovado em 2026-10-12 (iteração 4). Trabalho atual: G5 (revogação ativa).
- Não tocar `~/Documents/sisbin-planejamento-local` nem seus processos. Submódulo é enviado antes do principal e só com confirmação do humano.
- As equivalências antigas para ferramentas estão no commit `958c4a8` deste arquivo.
