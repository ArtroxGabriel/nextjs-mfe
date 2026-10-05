# handoff challenger_d19b_1 (parcial)

- etapa 0: documentos lidos (LEIA-PRIMEIRO, AMBIENTE, adendo 3, CONFIGURACAO, DEFERRED). Portas 3000-3003/4001-4120 livres no inicio (ss -ltn); Redis, Keycloak, Verdaccio no ar.
- proximo: lib.mjs + cenario 1 (token vencido, rajadas)
- etapa 1 em andamento: run-c1.sh (config tarefa=lock5/espera4000/timeout2000 e padrao=lock15/espera2000/timeout5000, janela 5, vida 20s; N 10/30/100 x / e /zona1, 3 reps). Saidas out-c1-*.txt
- etapa 1 FEITA: 12 combinacoes x 3 reps (out-c1-*.txt). Todas 200 (10/30/100, / e /zona1, configs tarefa e padrao), 1 SET da sessao por lote, refresh mudou, nenhum REFRESH_TOKEN_ERROR do Keycloak na janela das minhas execucoes (2 antigos, 17:04 e 17:22 locais, anteriores a mim). Rep 0 (a frio) mais lenta: n=100 /zona1 max 1902 ms (teto padrao 2000).
- proximo: c2 (Keycloak stop/pause), c3 (token na janela), c4 (config invalida), ...
- etapa 3 FEITA (janela, saudavel e pause): out-c3-*.txt
- etapa 2 FEITA: out-c2-vencido-{stop,pause}-{tarefa,padrao}[-quente].txt. Achados: com JWKS do stub frio (sem aquecimento) o stub cai em backoff de 30 s (ERP_JWKS_INTERVALO_MIN_S) e recuperacao leva ~30 s apos o IdP voltar; com aquecimento: perdedores esperam o teto (2s padrao / 4s tarefa), o vencedor do lock nao espera (stop: 40-90 ms; pause: paga o timeout do IdP 2-5 s), sessao fica no Redis, recupera sem novo login (padrao-pause: 10,3 s apos o IdP voltar, ate o lock vencer).
- proximo: c4 config invalida, c5 SHELL_HOSTS, c6 sair, c7 regressao D2, c8 suites
- etapa 4 FEITA (out-c4-*.txt): 6 configs invalidas -> 500 'Internal Server Error' + mensagem no log; janela=60 registra motivo=janela-de-renovacao 1x e renova com metade da vida; sem segredo no log
- etapas 5/6 FEITAS (out-c5-hosts*.txt, out-c5-padrao.txt): paginas e Server Action de zona pelos 2 hosts OK com 'localhost:3000, 127.0.0.1:3000'; sem SHELL_HOSTS o 127.0.0.1 e recusado (controle); sair aceita os 2; Origin https sem XFP=403; com XFP https=303; cross-origin action=500 sem mudanca de estado

> **Interrompido em 2026-10-05 (~18:50 local) pelo limite de sessão da API**, depois da etapa 6 e antes de terminar a 7
> (regressão do D2: `out-c7-*.txt` parciais) e a 8 (suítes). Conferido pelo orquestrador ao parar: portas 3000–3003 e
> 4001–4120 livres, nenhum `next-server`/`servidor.mjs` vivo, Keycloak religado e no padrão (`task showcase:checar` ok),
> submódulos sem mudança fora dos lockfiles já conhecidos. **Retomar o mesmo agente** (SendMessage) a partir da etapa 7.
