# P1: correção do gate iteração 2 em 2026-10-12

Tasks permanecem abertas até aplicação dos documentos, commit do principal e gate independente. P1 operacional não concluído. Nenhum commit criado por este worker; nenhum submódulo alterado. Lockfiles locais preservados.

Task 1: dist limpo antes de build, comandos assíncronos, cleanup síncrono em SIGINT/SIGTERM/exit, grupos próprios aguardados e teto configurável. Testes reais de install/publish nos dois sinais, saída explícita, filho resistente e tarball com órfãos plantados. Autenticação e redirect real permanecem em task scripts:test.

Task 2: sem mudança no shell. Registrar observação do challenger: Ready antecede recusa sem IdP, código 1 e nenhuma resposta servida.

Task 3: sem execução remota. Redirect de metadata recusado; download pnpm segue redirect. Limite declarado com zero Authorization no destino entre origens de loopback e adulteração recusada por SHA-512. Registro oficial sem redirects recomendado; D34 proposto.

Task 4: relatório e sete scripts descartáveis movidos ao scratchpad, seis tarefas removidas. Principal pronto no working tree para commit pelo orquestrador; propostas de documentos neste scratchpad. Nenhuma aprovação de gate atribuída ao worker.

Scripts 60 pass, 0 fail, 0 skip; estática 52 pass, 0 fail, 0 skip; lockstep 0.10.4 nas quatro apps, saída 0. Nenhum submódulo alterado, portanto task test não foi repetido nesta correção.
M1 a M14 detectadas em cópia isolada, zero sobreviventes. Baselines: 43 pass, 0 fail, 0 skip. Execuções com mutações: 123 testes, 103 pass, 20 falhas esperadas, 0 skip, 0 cancelled.

| Mutação | Pass/fail esperado/skip | Teste que detectou |
|---|---|---|
| M1 | 9/1/0 | versao existente, 401 e 500 nunca chegam ao build ou publish |
| M2 | 9/1/0 | versao existente, 401 e 500 nunca chegam ao build ou publish |
| M3 | 9/1/0 | hash diferente impede instalacao e preserva lockfile e node_modules |
| M4 | 9/1/0 | redirect do registro nao recebe token nem e seguido |
| M5 | 9/1/0 | registro externo exige HTTPS; CI nao cai silenciosamente no Verdaccio local |
| M6 | 11/2/0 | instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar<br>pnpm real instala fixture com Authorization e lock congelado via pacotes.instalar |
| M7 | 8/2/0 | tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez<br>dist orfao nao entra no tarball real da publicacao |
| M8 | 7/1/0 | D18: scripts de producao nao autorizam identidade dev implicitamente |
| M9 | 7/1/0 | D18: producao sem IdP recusa antes de servir; somente showcase autoriza identidade dev |
| M10 | 5/1/0 | nucleo declarado sem resolucao no lockfile reprova |
| M11 | 9/1/0 | dist orfao nao entra no tarball real da publicacao |
| M12 | 1/5/0 | SIGINT durante instalar real remove auth e aguarda os filhos proprios<br>SIGTERM durante instalar real remove auth e aguarda os filhos proprios<br>SIGINT durante publicar real remove auth e aguarda os filhos proprios<br>SIGTERM durante publicar real remove auth e aguarda os filhos proprios<br>sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento |
| M13 | 5/1/0 | exit explicito durante autenticacao remove auth sincronamente |
| M14 | 5/1/0 | sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento |

Logs de cada baseline/mutação e famílias: /tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/c3ace712-bc26-43d0-aa52-376d9e480ce4/scratchpad/codex/worker_p1_3. As 20 falhas são deliberadas em cópias mutadas, não regressões do checkout. Nenhuma mutação ficou na árvore principal.
