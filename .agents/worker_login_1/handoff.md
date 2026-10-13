# worker_login_1 (final), 2026-10-13

Correção do desvio do ADR-0014, adendo 1, item 8: `concluirLogin` consulta `/v2/eu` com o token recém-obtido, pelo registro de destinos, antes de gravar a sessão. `401` recusa; 3xx, 5xx, timeout e corpo inválido falham sem gravar; pessoa ativa sem módulos entra. Mock recusa pessoa suspensa. Executado pelo Codex; verificação ponta a ponta e uma correção de teste feitas pelo orquestrador.

- Commits: núcleo `36b6c72` (0.10.5, publicado uma vez no Verdaccio local), stub `b5a232a`, shell `ed94e90`, zona 1 `d7737fc`, zona 2 `f9376f3`, zona de acesso `563b47f`; principal `28b36b9`.
- Contagens: unidades 588/0/0; estática 52/0/0; lockstep 0.10.5; Redis 138/0/0; OIDC 9/0/0; arquivo 133/0/5 (os 5 dependem de Redis ou Keycloak).
- Mutações (8, todas pegas): gravar antes de consultar; ignorar 401; aceitar 5xx/timeout; recusar módulos vazios; token de serviço ou ausente; `fetch` direto; mock suspenso 200; sessão provisória apagada depois.
- Achado do orquestrador: os casos OIDC nunca tinham rodado (o teste lia `.access_token` de um token que já é texto e mandava `Bearer undefined`). Corrigido no principal.
- Achado de isolamento: um teste antigo do D2 usava a porta fixa 4120, que é da sessão vizinha; passou a porta efêmera.
- Limite aceito: falha passageira na consulta consome a transação; a pessoa entra de novo.
- Gate pendente (revisor, challenger, auditor).
