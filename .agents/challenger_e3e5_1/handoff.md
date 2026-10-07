# Handoff challenger_e3e5_1 (final)

Veredito: REJECT (divergencias de texto do roteiro em A8, A9, A10, A15, menu em A3 e mensagem do segundo `showcase:zona-demo`; codigo e suites verdes nos dois modos).

Evidencias brutas: /tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/df6c0624-9cac-4e00-97ba-284245f60b18/scratchpad/ (conf-*.txt, ver-*.txt, oidc.log, roteiro*.mjs, a14.mjs, a12.mjs, eco.mjs, a11oidc.mjs).

## Execucao
- `task showcase` (dev): conferir x2 (exit 0, saida identica, estado e git inalterados); verificar x2 (7/7 pass, 76 s e ~144 s).
- `task showcase:oidc -- --log`: conferir x1 (exit 0, modo Keycloak), verificar x1 (7/7), A1-A13 e A14 reproduzidos por HTTP, logout Keycloak com/sem confirmacao.
- Sem token/cookie/senha em nenhuma saida (grep: dev-shell-escrita, dev-zona-leitura, segredo do cliente, eyJ..., __Host-session=<uuid>, dev.<ator>.<uuid>); unico trecho de URL com senha sai mascarado (`***`). Arquivos novos no repo: nenhum alem do estado do dominio.

## Tabela (F e A)
F1 ok | F2 ok (entrada 280/15248/23924/30412 ms dev; 22254 e 1055 ms oidc; saida 30,2-30,5 s dev, 30,2 s e 10,7 s oidc) | F3 ok | F4 ok (503 em 6-9 ms) | F5 ok (clique so a mao) | F6 ok | F7 ok (409 so pelo teste).
A1 ok | A2 ok (303 -> /, cookie HttpOnly Secure SameSite=Lax, UUID) | A3 DIVERGE (rotulos) | A4 ok | A5 botao presente, clique so a mao | A6 ok (toast "Tarefa concluida." 1x; recarregar nao repete) | A7 ok | A8 DIVERGE | A9 DIVERGE (religar) | A10 DIVERGE | A11 ok (dev e oidc, incl. confirmacao e sem confirmacao) | A12 ok (503 Retry-After 5 em 318 ms; volta 842 ms apos a porta abrir) | A13 ok | A14 ok nos prazos; texto do comando bate | A15 DIVERGE (log do shell so com --log).

## Achados
1. ALTA (roteiro): A8/A10 descrevem celula `zona1.analista` x Relatorios/Tarefas e toast "Concessao atualizada."; /acesso real e grade pessoa x modulo (Conceder/Revogar), perfil aparece como texto na celula; toasts reais "Acesso revogado."/"Acesso concedido.". Nao ha celula x Relatorios nem x Tarefas.
2. ALTA (roteiro): A9 "religue em A8 e ele volta" falso: revogar (ac-07, zona1.analista) e Conceder de novo cria ac-101 com perfil zona1.padrao; bruno volta a ver /zona1 no menu mas /zona1/relatorios segue 404. So `task showcase:dados:resetar` restaura. (A revogacao em si: 404 na proxima requisicao, mesma sessao, menu sem /zona1: ok.)
3. MEDIA (roteiro): A15 manda ler `[zona] <id>: motivo=... supportId=...` no log do shell, mas `task showcase` sobe tudo com stdio ignore (shell fd 1 -> /dev/null). So existe com `task showcase -- --log` (confirmado: supportId da pagina = ultima linha do log, `motivo=conexao codigo=ERRO_INTERNO`). Roteiro nao menciona `--log`.
4. MEDIA (zona-demo): segundo `task showcase:zona-demo` com o primeiro no ar falha com stack crua de node (`listen EADDRINUSE ... 127.0.0.1:3009`), sem mensagem clara. Sem rota orfa (primeiro continua dono; mapa intacto). Mesmo com ACESSO_URL inalcancavel: stack crua `TypeError: fetch failed`; porta 3009 fechada, rota nao registrada.
5. BAIXA (roteiro A3): menu real "Inicio / Zona 1 - painel e relatorios / Zona 2 - tarefas"; roteiro diz "Inicio, Painel da zona 1, Tarefas".
6. BAIXA (suite "sem rastro"): `showcase:verificar` nao e neutro: F7 faz a versao de t-4 crescer (documentado no teste, nao no roteiro) e F2/F4 acrescentam eventos de auditoria em gestao-acesso-v2.json (275 eventos apos 2 rodadas). Rota demo, mapa e portas ficam limpos.
7. BAIXA: a pagina 503 de zona fora do ar sai sem header Content-Security-Policy (as paginas 404 tem). Corpo sem <script>, tem 1 <style>; sem eco, sem stack. Informativo.
8. BAIXA (conferir): ATORES nao inclui eva (a legenda do subir lista 5 atores); o detalhe do bloco lista carla embora o rotulo cite so ana/bruno/davi.
9. Informativo: apos remover a rota, /demo devolve 503 (nao 404) ate o shell reler o mapa (visto em 2 execucoes seguidas); coerente com "no mesmo prazo", mas a pagina e de zona fora do ar, nao 404.
10. Informativo: o estado gravado dos dominios era anterior a semente (faltava eva, aviso do `task showcase`); `task showcase:dados:resetar` no fim deixou-o na semente atual.

## Passou no ataque
Zona demo removida em SIGINT, SIGTERM, SIGHUP (via task e direto) e EOF de stdin (~16 ms, mapa volta a zona1,zona2,acesso, porta 3009 fechada). Pagina de zona fora do ar: 5 entradas hostis (script, img onerror, %00, CRLF, ../, 3000 chars) -> 503, sem eco, sem stack, sem Set-Cookie, sem X-Powered-By. `verificar:redis` nao inclui a suite (glob base/verificacao/*.test.mjs; suite em showcase/); nao executei `task verificar:redis` (portas ocupadas pelo showcase e prova estrutural suficiente).

## Nao executado
Cliques em ilhas de cliente (A5 toast, A6 botao) so a mao; kill -9 da zona demo (rota ficaria orfa, nao testado); `task verificar:redis` real; segundo run de verificar em oidc; conferir/verificar com falha forcada para ver se a saida de erro vaza dado.

## Estado final
Portas 3000-3003, 3009, 4001-4120 livres; Redis, Keycloak, Verdaccio no ar; dados na semente.
