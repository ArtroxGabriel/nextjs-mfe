# Handoff revisor_e3e5_2 (final)

Veredito: APPROVE (por leitura; nada subido). Sem bloqueio; menores abaixo.

## 1. Achados do challenger
- A3: menu = `Início` + `m.nome` por módulo (criarPaginas.ts:80); semente "Zona 1 — ...", "Zona 2 — ...". Texto confere.
- A8/A10: grade pessoa x módulo, célula `situacao · perfil` + Revogar/Conceder (acesso/page.tsx), toasts "Acesso revogado."/"Acesso concedido." (acoes.ts). Bruno Analista (p-18) tem ac-07 zona1.analista e nenhum acesso à zona 2: só Conceder. Confere.
- A9: zona1 é categoria `direto` com perfilPadrao `zona1.padrao` (servidor.mjs criarAcesso), então reconceder cria acesso novo sem relatórios. Confere.
- A14: 503 antes do 404 após remoção, coerente com o TTL do mapa.
- A15 e `--log`: `subir({log})` usa stdio inherit (ambiente.mjs:137); Taskfile repassa `{{.CLI_ARGS}}`; a linha `[zona] ... supportId=` existe em rotas-auth.ts:72. Confere.
- Suíte não neutra (t-4, auditoria) agora documentada.

## 2. zona-demo.mjs
- Porta ocupada: EADDRINUSE vira ErroDeUso; nenhuma rota registrada (o registro vem depois do listen).
- Gestão de acesso fora: servidor fechado antes do ErroDeUso; rota não registrada.
- Registro recusado (>=300): servidor fechado, Error simples (stack crua, mas útil; não engolido).
- Erro inesperado no listen é relançado; `principal` só captura ErroDeUso. A suíte importa `subirZonaDemo` e segue compatível.

## 3. conferir.mjs
eva (p-21) só tem zona2.leitor: bloco de fragmento exige os dois módulos, logo "não vê" é coerente; ela existe no realm do Keycloak. Regex de token ganhou `eva` e manteve `eyJ`. Nada perdido.

## 4. Invariantes e estilo
Nada no BFF; nenhum segredo impresso. Linhas adicionadas sem travessão, `·`, `→`, `×` ou emoji; parágrafos em linha única.

## Menores (não bloqueiam)
- zona-demo.mjs:25 `catch {}` descarta a causa (timeout, DNS, recusa viram a mesma frase); sugestão `{ cause: e }` e incluir `e.message` em stderr.
- zona-demo.mjs:24-26: se o POST chegar à gestão de acesso mas a resposta estourar o timeout de 5 s, a rota fica registrada com o servidor fechado (rota órfã); janela estreita, só tolerável no showcase.
- zona-demo.mjs:23-27: `await zona.fechar()` dentro do catch pode lançar e mascarar o ErroDeUso; improvável.
- ROTEIRO "Preparar": menciona `task showcase:dados:resetar` duas vezes (redundância de texto).
