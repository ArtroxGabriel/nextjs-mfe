# SDD ledger — plan: docs/superpowers/plans/2026-10-07-nucleo-0104-html-inerte.md

BASE núcleo 610217d (erp-nucleo, master)
Task 1: dispatched (Sonnet), nucleo BASE 610217d
Task 1: implemented (nucleo 610217d..50a0fea), RED 15 -> GREEN 286/286, M1-M13 caught; review dispatched
Task 1: ⚠️ resolved by controller: server-only kept (line 1), commit without footer, not pushed until close, report has M1-M13 table and 286/286
Task 1: minor (deferred): balanced stack is not valid HTML nesting (<p><ul></ul></p>, <a><a></a></a>, <li> outside a list pass; parser restructures DOM, no execution vector)
Task 1: minor (deferred): id/class accept any clean value (DOM clobbering, reuse of consumer CSS classes); declared limit
Task 1: minor (deferred): href accepts any local path, including GET routes with effect (needs a user click; domain decides); no test documents these limits
Task 1: complete (nucleo 610217d..50a0fea, review clean)
