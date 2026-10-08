# Handoff auditor_e3e5_5 (final)

Iteração 6 do gate do E3, E4 e E5, só auditor. Principal `fb008b3`, correção da iteração 5 em `5a06f1e`.

## Veredito: PASS

3 mutações, 2 pegas, 1 viva sem veto. Detalhe em `mutacoes.txt`.

## O que foi feito

1. A correção é só de teste: `git diff e50b36d 5a06f1e --stat` mostra só `base/scripts/zona-demo.test.mjs` (10+, 6-),
   que extrai `deleteDaDemo` (um DELETE, caminho `/v2/zonas/demo/rota`, `Bearer svc.demo`) e o usa em ZD5, ZD8 e ZD6.
2. P4 reaplicado exatamente como no auditor_e3e5_4 (`voltar()` sem o `id`): PEGA por ZD6 e ZD8
   (actual `/v2/zonas/zona9/rota`, expected `/v2/zonas/demo/rota`); 9 pass, 2 fail.
3. Busca de mutação nova, com proporção, fora do que os quatro auditores anteriores já listaram:
   - Q2 (`remover()` volta cedo com a zona derrubada): PEGA por ZD6.
   - Q1 (o `sair()` só remove se o laço achar a zona no ar): VIVA, não veto. Não é mutação pontual do código
     existente (acrescenta condição que o comando não tem); a forma pontual no lugar onde a lógica mora (Q2) é pega.
     Observação para o D33 se incomodar: nenhum teste faz Enter e depois Ctrl-C pelo script.
   Fora disso, o que o roteiro A14 e o comando prometem (registrar, derrubar com rota mantida, voltar na mesma porta e
   com o mesmo id, remover com a credencial da zona em todos os caminhos de saída, códigos de saída e mensagens de
   falha) já está coberto pelas mutações anteriores e pela suíte atual.
4. Regressão por família, tudo revertido e showcase derrubado:
   - `task test`: exit 0; contratos 20, núcleo 286, moldura 26, domínio-stub 83, shell 161 (576 pass, 0 fail;
     as zonas 1, 2 e acesso não têm script de teste).
   - `task verificar:estatica`: 52/52, exit 0.
   - `task scripts:test`: 40/40, exit 0.
   - `task verificar:redis`: 135/135, 0 pulados, exit 0.

## Estado

Árvore: só `m repos/erp-dominio-stub` e `m repos/erp-moldura` (lockfile, esperado) e este diretório.
Portas 3000 a 3003, 3009 e 4001 a 4120 livres no início e no fim; Redis (6379), Keycloak (8080) e Verdaccio (4873)
no ar. Arnês e logs no scratchpad da sessão.
