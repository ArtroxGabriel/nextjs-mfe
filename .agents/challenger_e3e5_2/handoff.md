# Handoff challenger_e3e5_2 (final)

Veredito: APPROVE. Nenhuma divergencia de texto entre roteiro e observado nas linhas reescritas; nenhum achado ALTO ou MEDIO.

Evidencia bruta: scratchpad da sessao, subpasta c2/ (r1.out, r2.out, a12.out, a14.out, sig-*.out, conf-*.txt, ver-*.txt, o-*.out, vr.log, dev.log, oidc.log).

## Execucao
- Dev (`task showcase -- --log`): A1-A13 por HTTP, A12, A14 (SIGINT), A15; conferir x2 (exit 0, saidas identicas); verificar x2 (7/7, 83,9 s e 121 s).
- OIDC (`task showcase:oidc -- --log`): A1-A11, A13, A14, A15 (demo), logout Keycloak com e sem confirmacao; conferir x1; verificar x1 (7/7, F2 entrada 21,8 s, saida 30,2 s).
- `task verificar:redis` com o showcase DERRUBADO: 135 testes, pass 135, fail 0, skipped 0 (nenhuma suite do showcase na saida).
- Zona-demo: segundo processo, ACESSO_URL morto, SIGINT, SIGTERM, SIGHUP, EOF.

## Roteiro linha a linha (dev e oidc, mesmo resultado salvo nota)
F1 ok | F2 ok (entrada 21,2/22,2 s dev, 29,7/21,8 s oidc; saida 30,2-30,5 s) | F3 ok | F4 ok (503 em 7-10 ms) | F5 ok (clique so a mao) | F6 ok pelo teste | F7 ok (409 so pelo teste).
A1 307 /login?de=%2Fzona1 | A2 303 -> /, cookie HttpOnly Secure SameSite=Lax, UUID | A3 menu real "Inicio / Zona 1 — painel e relatorios / Zona 2 — tarefas", igual em /, /zona1, /zona2, item atual marcado: bate | A4 404 sem placeholder | A5 botao presente, clique so a mao | A6 toast "Tarefa concluida." 1x, recarregar nao repete | A7 r-1 sem Custo, r-3 404 | A8 celula bruno x zona1 = ac-07 "zona1.analista", toast "Acesso revogado.": bate | A9 bruno 404 na mesma sessao, menu so "/", Conceder de novo: menu volta a "/zona1", relatorios 404, celula "ativo · zona1.padrao": bate com o texto novo | A10 celula bruno x zona2 so "Conceder": bate | A11 303, depois todas as paginas 307 ao login (oidc: logout do Keycloak sem id_token_hint, confirmacao -> /login do shell, novo Entrar pede senha; sem confirmar, novo Entrar volta sem senha): bate | A12 503 Retry-After 5 em 327 ms, volta 856 ms apos a porta abrir (roteiro: 0,8-1,2 s) | A13 so a ana ve o bloco | A14 prazos bate (queda 10 ms, volta 7 ms, saida 404 em 30,5 s); nao observei o 503 intermediario "pode dar" depois de remover (meu poll so esperou o 404) | A15 supportId da pagina = linha `[zona] zona2: motivo=sonda codigo=ERRO_INTERNO supportId=...` do log com --log; demo: `motivo=conexao`; sem classe nem stack. Nota da suite e "Preparar" (--log, eva, reset) conferem com o observado, salvo que nao medi o crescimento de t-4/auditoria desta vez.

## Zona-demo (ataques)
- Segundo processo com o primeiro no ar: "a porta 3009 ja esta em uso: ja ha uma zona demo no ar ... Feche-o e tente de novo.", exit 1, sem stack; primeiro segue dono (mapa com demo, 3009 aberta so pelo primeiro).
- ACESSO_URL=http://127.0.0.1:4999: "nao consegui falar com a gestao de acesso (http://127.0.0.1:4999): o showcase precisa estar no ar...", exit 1, sem stack, 3009 fechada, mapa zona1,zona2,acesso.
- SIGINT, SIGTERM, SIGHUP (grupo), EOF: exit 0 em 14-25 ms, "Rota removida...", mapa zona1,zona2,acesso, 3009 fechada, 0 processos orfaos, sem stack.

## Achados
1. BAIXA/info: Ctrl-C do `task showcase` imprime 3-4 linhas `[ELIFECYCLE] Command failed.` (dev 3, oidc 4) no desligamento normal. Cosmetico.
2. BAIXA/info: a legenda do oidc diz "a senha e o proprio nome" (senha de ator de desenvolvimento documentada, nao segredo); nenhum token, cookie ou senha de servico em saida ou arquivo meu (grep: eyJ, __Host-session=<uuid>, dev-shell-escrita, dev-zona-leitura = 0).
3. Informativo: git status mostra `m repos/erp-dominio-stub` e `m repos/erp-moldura` (pnpm-lock, ja dito pelo worker), nao commitado por mim.
4. D33: nenhum item pior do que escrito, mas nao remedi o CSP da 503 nem o `kill -9` na demo (nao reverificados).

## Nao executado
Cliques em ilhas de cliente (A5, A6) so a mao, cobertos pela Server Action (A6) ou so presenca do botao (A5); A12 em oidc; kill -9 na zona demo; 503 intermediario de /demo apos remover; F6/F7-409 fora do teste.

## Estado final
Portas 3000-3003, 3009, 4001-4120 livres; Redis, Keycloak e Verdaccio no ar; dados na semente (`task showcase:dados:resetar` no fim).
