# Achados Task 3 (final)

Spec: conforme (✅). Qualidade: aprovada.

Critical: nenhum. Important: nenhum.

Minor
- docs/adr/0011 adendo 1 (fim): cita `alvo.md` §6, arquivo fora de commit; referência pendente no repositório até o humano commitá-lo.
- docs/arquitetura/atual.md: não editado. Não está errado (não afirma que nenhuma zona usa fragmento; l.86 lista só a capacidade do núcleo), só incompleto: o diagrama (l.25-26) e a tabela de ator (l.158, ana) não mostram a aresta servidor→servidor zona 1 → zona 2 nem o bloco no painel. Sugestão: uma linha quando o humano liberar a edição.
- erp-zona-1 app/zona1/page.tsx: `fragmentos.buscar` roda também para quem não tem o módulo da zona 2 (bruno, davi): uma chamada inútil à zona 2 por render, que responde 404. Correto quanto ao invariante 8; custo só.
- erp-zona-1 lib/fragmentos.ts: `process.env.ZONA2_URL` lido na carga do módulo; ok porque a página é dinâmica (cookies), mas valor errado derruba a página na carga (criarFragmento lança) em vez de sumir o bloco; comportamento fail-fast, só vale documentar.
- base.test.mjs C1c: não confere o payload RSC (`rsc: 1`) nem ausência de token no HTML; o brief deixa isso para o challenger.
- Fora do diff (núcleo, ehHtmlInerte): `\son[a-z]+\s*=` não pega `<img/onerror=...>` (barra no lugar do espaço). A CSP sem nonce barra o handler, mas a conferência "inerte" é lista negra; sugerir ao auditor do gate.
