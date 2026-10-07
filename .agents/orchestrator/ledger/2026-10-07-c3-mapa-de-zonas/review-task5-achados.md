# Review task 5 (final)

Veredito: Aprovado com ressalvas (spec cumprida; correcoes pequenas de documento).

Important
- docs/desenho/mfe/01-operacao.md (paragrafo da zona travada): cita "limite declarado, D28" para Server Action em zona travada; o limite esta no D31.

Minor
- docs/arquitetura/alvo.md (linha "Falha isolada de zona", adicionada): "normalizado × cru" mantem o `×` (item 6); o relatorio diz varredura limpa.
- "em ate um TTL" sem "mais uma releitura" em README.md, alvo.md, atual.md, infraestrutura-alvo.md, 02-zonas.md (item 3 pedia a precisao).
- Numeros medidos divergem entre ADR-0015 nota 4 (2207/1985), DEFERRED D31 (2077 a 2207) e relatorio (2217/2002).
- Paragrafos quebrados em varias linhas nas linhas adicionadas de DEFERRED.md (bloco D7) e AGENTS.md (invariante 4).
- ADR-0015 decisao 4 ainda cita `nucleo.zonas.listar()` (a nota 1 corrige, a decisao nao).
- Diagrama do proxy em atual.md ganhou nos no fim; corte no PDF afeta justamente o trecho novo.
- Teste /_next/data sem controle positivo.
