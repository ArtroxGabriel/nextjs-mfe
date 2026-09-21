# Roteiro de verificação manual

## Base genérica em `repos/`

Leva uns 10 minutos. A verificação automática faz o mesmo por HTTP:
`node --test base/verificacao/*.test.mjs` (esperado: `tests 30`, `pass 30`).

**Preparar.** `node base/scripts/registry.mjs up`, instale cada app (README) e rode
`node base/scripts/subir-base.mjs`. Use `http://localhost:3000`, não `127.0.0.1`: o cookie
`__Host-session` exige origem segura, e o navegador só trata `localhost` assim.

| # | Faça | Deve acontecer | Requisito |
|---|---|---|---|
| A1 | Abra `/zona1` sem ter entrado | vai para `/login?de=%2Fzona1` | camada 1 |
| A2 | Entre como **ana** | volta para `/`; o cookie `__Host-session` é HttpOnly e só um UUID | N3 |
| A3 | Veja o menu | Início, Painel da zona 1, Tarefas; o mesmo menu em `/zona1` e `/zona2`, com o item atual marcado | N4, N5 |
| A4 | Abra `/zona1/relatorios` e `/acesso` digitando a URL | 404, sem página de "sem acesso" | N5, D6 |
| A5 | Em `/zona1`, clique **Avisar no toast do shell** | toast no canto, disparado pela zona | N4 |
| A6 | Em `/zona2`, clique **Concluir e ir para a zona 1** | a página muda para `/zona1` e o toast "Tarefa concluída." aparece uma vez; recarregar não o repete | N4 |
| A7 | Saia e entre como **carla**; abra `/zona1/recursos/r-1` | sem a seção Custo; `/zona1/recursos/r-3` dá 404 | dado é do domínio |
| A8 | Como carla, em `/acesso`, desligue a célula `zona1.analista` × Relatórios | toast "Concessão atualizada." | N5, N6 |
| A9 | Em outra janela anônima, entre como **bruno** e abra `/zona1/relatorios` | 404 e o item sumiu do menu, sem novo login; religue em A8 e ele volta | D7 |
| A10 | Em `/acesso`, procure a célula `zona1.analista` × Tarefas | não existe: perfil de zona não concede módulo de outra zona | D8 |
| A11 | Clique **Sair** e use o botão Voltar do navegador | qualquer página volta ao login: a sessão acabou em todas as zonas | N3 |
| A12 | Derrube só a zona 2 (Ctrl-C no processo dela ou `kill` na porta 3002) e abra `/zona2` | 503 com `Retry-After: 5` e a página "zona indisponível"; `/` e `/zona1` seguem funcionando. Suba a zona de volta: em ~1,5 s `/zona2` volta | falha isolada de zona (**sem gate ainda**) |

Limites conhecidos: login de desenvolvimento sem senha, store de sessão em arquivo e sem
renovação de token (ver `alvo.md` §6). O item A12 descreve o comportamento implementado no shell,
que ainda não passou por gate independente.

A PoC anterior tinha um roteiro próprio (Parte B deste arquivo), preservado na tag `poc-final`.
