# Handoff revisor_c3_1 (final)

Veredito: APROVA. Nenhum achado crítico nem importante. Quatro menores.

Verificado: pnpm test do shell (83) e do stub (22) verdes; saida-de-rede, seguranca-estatica e ambiente (69) verdes. Não subi servidores.

Etapas concluídas: shell (mapa, gateway, proxy, config, página de erro), stub, scripts registrar-rota das 3 zonas, N8, AGENTS.md, CONFIGURACAO.md, ADR-0015, infraestrutura-alvo, D31.

Conferido sem defeito:
- Destino do cookie: o alvo vem só de `zona.origem` do mapa validado (`new URL(...).origin`, formato sem credencial/caminho, padrão `host:porta`); `alvo.origin !== zona.origem` conferido no proxy e no gateway; a guarda do Redis é revalidada na leitura (`validarLista`); id reservado e `-static` recusados; `Host` e `x-middleware-*` não atravessam; nada do navegador escolhe o destino.
- `/_gateway`: `ehRotaDoGateway` decodifica e ignora caixa; testes cobrem `%5F`, caixa, duplo e `/_next/data`.
- N8: exceções do gateway (`node:http/https`) e dos três `registrar-rota.ts` listadas com motivo; sem `fetch` fora delas.
- Invariante 12: página só com id e supportId validados por regex; log sem stack.

## Menores

1. `repos/erp-shell/app/%5Fgateway/[...caminho]/route.ts:20` e `lib/gateway-zona.ts:81`: o route handler não confere que a requisição veio do proxy; toda a defesa é o `ehRotaDoGateway` no proxy. Se uma grafia escapar (suspeita não confirmada: `//_gateway/zona1` com `curl --path-as-is`; o teste de `base.test.mjs:1042` não a inclui), o gateway serve documento de zona sem a camada 1 (só a zona recusa por cookie). Correção: o proxy põe um cabeçalho interno com segredo por processo (ou valor aleatório gerado no boot e guardado em `globalThis`) e o handler dá 404 sem ele; acrescentar `//_gateway/zona1` ao teste.
2. `lib/mapa-zonas.ts:46`: `*` no host casa pontos, então `zona-*.svc.local` aceita `zona-x.outro-ns.svc.local` (muda de namespace). É o documentado em CONFIGURACAO.md, mas o texto não avisa do risco. Correção: `*` valer um rótulo (`[a-z0-9-]*`, sem ponto) e um `**` explícito para vários, ou avisar na documentação que o padrão deve ancorar o namespace antes do `*`.
3. `lib/decisao-proxy.ts` (ramo `mapaVazio`) e `lib/gateway-zona.ts:84`: mapa vazio legítimo (nenhuma zona registrada, fonte respondeu `[]`) também dá 503 com "Zona Offline" e log de erro para qualquer caminho com forma de zona (`/abc`), não 404. A decisão 6 do ADR fala só de falha de fonte e guarda. Correção: usar `vazioPorFalha` (exposto pelo mapa) para só responder 503 nesse caso.
4. `docs/desenho/mfe/01-operacao.md:201`: afirma `experimental.caseSensitiveRoutes` no shell, mas `next.config.ts` não o define (nem antes do C3 com certeza: não consegui confirmar o histórico, o git foi recusado pelo classificador). Correção: reescrever o trecho dizendo que o mapa casa sem diferenciar caixa (`encontrar` em minúsculas) e o proxy decide, ou restaurar a opção se ela era necessária.

Observação sem ação: os `registrar-rota.ts` têm padrão `svc.${id}` e origem `127.0.0.1` se faltar `ERP_ZONA_ORIGEM_INTERNA`, igual aos `registrar-manifesto.ts`; em produção o shell ainda recusa a origem fora de `ERP_ZONAS_ORIGENS_PERMITIDAS`. O token de serviço do stub não tem segredo (declarado).
