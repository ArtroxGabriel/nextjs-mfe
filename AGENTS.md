# AGENTS.md — regras para quem escreve código aqui

Vale para pessoas e agentes. Curto de propósito: o manual completo, com exemplos e o porquê de
cada regra, está em [`docs/desenho/bff/manual-completo.md`](docs/desenho/bff/manual-completo.md).

## O sistema em três linhas

- Next.js 16 (App Router) como **BFF** de domínios de negócio; o navegador nunca recebe credencial.
- **Multi-Zones:** um shell (`repos/erp-shell`) e zonas independentes, cada uma um repositório e
  um processo; o navegador só fala com o shell.
- **Núcleo** compartilhado em `@erp/nucleo`, sem nenhum domínio de negócio. Se desligar um
  componente muda alguma resposta, ele é núcleo; se só fica mais lento, é extensão.

## Invariantes — nunca viole

Invariante sem teste não é invariante, é intenção: cada um tem verificação nos testes dos
pacotes ou em `repos/verificacao/`.

1. **NUNCA** exponha `access_token`, `refresh_token` ou lista de grupos ao navegador.
2. **NUNCA** passe DTO sensível como prop para componente `'use client'`. O objeto inteiro
   é serializado no payload RSC, inclusive campos não renderizados.
3. **SEMPRE** inclua `import 'server-only'` em módulo que toque credencial ou sessão.
4. **SEMPRE** chame domínio por um destino do **registro de destinos** do núcleo
   (`nucleo.destino(nome)`), nunca com `fetch` direto. A zona escolhe o modelo de caminho
   declarado e preenche parâmetros; origem, método e credencial são do registro — RFC 10017.
   Ver ADR-0009. Única exceção: o script de deploy `scripts/registrar-manifesto.ts`, que roda
   fora do Next e usa `fetch` com origem fixa, `redirect: 'manual'` e timeout.
5. **SEMPRE** revalide sessão no primeiro bloco de toda Server Action. Ela é endpoint público.
6. **SEMPRE** use `If-Match` em mutação de recurso versionado, com a versão que o cliente
   conhece. O núcleo recusa PUT/PATCH/DELETE sem ela; POST que só define um valor
   (conceder, restringir, atribuir) não tem versão a comparar (ADR-0009, decisão 13).
7. Responda **`401`** sem credencial, **`404`** para recurso fora do escopo de grupo,
   **`403`** para ação negada sobre recurso que o usuário legitimamente vê.
8. **NUNCA** renderize placeholder de "sem acesso". Ausência de permissão é ausência de elemento.
9. **NUNCA** confie em `_permissoes` como autorização, e **nunca** recarregue o recurso
   numa Server Action só para reverificá-lo. O domínio decide.
10. **NUNCA** exponha o domínio à internet, e **nunca** crie endpoint no BFF alcançável
    sem cookie de sessão. O único consumidor do BFF é o navegador do próprio usuário.
11. **NUNCA** crie variável `NEXT_PUBLIC_*` com credencial ou endpoint interno.
12. **SEMPRE** normalize erro para `{ codigo, supportId }`. Sem stacktrace, sem nome de classe.
13. **NUNCA** cacheie payload protegido no BFF. Ver ADR-0007.
14. **NUNCA** deixe uma extensão alterar semântica de campo já usado pelo núcleo.
15. **NUNCA** grave, renove ou encerre sessão fora do shell. Escrita de sessão e
    autenticação só existem em `@erp/nucleo/shell`; zona nenhuma importa esse subpath.
16. **SEMPRE** verifique o módulo na camada 2 em toda página (`exigirModulo`) e em toda
    Server Action (`acaoProtegida`). Módulo não permitido é `404`, como recurso fora do escopo.
17. **NUNCA** declare perfil ou módulo fora do prefixo da própria zona. Perfil de zona só
    concede módulo dela; perfil global é `plataforma.*` e nasce no domínio de gestão de acesso.

## Onde colocar

| Preciso de… | Coloque em | A sessão chega por |
|---|---|---|
| dado para renderizar | Server Component, via `nucleo.destino(...)` | render (`sessaoDaPagina`) |
| mudar estado | Server Action dentro de `acaoProtegida` | revalidada no início da action |
| dado que o navegador busca depois | `app/{zona}/api/bff/` (route handler) | cookie do `fetch` |
| bloco de outra zona | `criarFragmento` na consumidora, `responderFragmento` na dona (ADR-0011) | cookie repassado |
| chamada vinda de fora da aplicação | **não no BFF**: leve ao domínio | — |

Verificação de acesso: `proxy.ts` (cookie existe?) → layout/página (`exigirModulo`, 404) → UI
(botão some) → **domínio** (a única que um `curl` não contorna). As três primeiras são
experiência de uso; nenhuma substitui o domínio.

## Comandos

```bash
pnpm verificar                          # ponta a ponta, na raiz (sobe, verifica, derruba)
cd repos/erp-<parte> && pnpm test       # testes de um pacote ou do shell
node --test test/*.test.mjs             # sempre com glob explícito
```

Antes de abrir PR ou enviar: nenhum invariante violado; testes do repositório e ponta a ponta
verdes; decisão estrutural nova tem ADR em `docs/adr/`; armadilha nova vai para
`.agents/orchestrator/AMBIENTE.md`.

## Onde está o resto

`README.md` (rodar) · `docs/README.md` (arquitetura) · `.agents/orchestrator/LEIA-PRIMEIRO.md`
(trabalho em andamento) · `README.md` de cada `repos/erp-*` (o que cada parte é).
