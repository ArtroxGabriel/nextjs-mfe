# Revisão da tarefa 4 — achados (final)

Progresso registrado por arquivo.

## Lido: README, rota %5Fgateway, instrumentation, configuracao, decisao-proxy, gateway-zona (diff 1-663)
- gateway-zona.ts:539 `x-forwarded-proto` = valor do navegador quando vier (`??`); `x-forwarded-host` sempre sobrescrito. A conferir no Next.
- gateway-zona.ts:656-662 `locationRelativo`: `http://zona//evil.com/x` vira `//evil.com/x` (protocol-relative → redirecionamento aberto se a zona ecoar caminho). Menor.
- Rota interna não confere cookie; depende só do proxy. Conferir matcher e normalização `_next/data` (risco 2).
- `aoAbortar` responde 404 ao cliente que já fechou: inócuo.

## Lido: mapa-zonas, pagina-erro-zona, rotas-auth, subida, zonas, next.config, proxy.ts (diff 680-1247)
- Instância preguiçosa via globalThis; register() só em nodejs com process.exit. OK.
- Retentativa curta só com vazio por falha. OK.
- pagina-erro-zona: id e supportId filtrados por regex antes de entrar no HTML. OK.
- ehRotaDoGateway decodifica (%5F) e ignora caixa. OK. Falta ver _next/data e matcher (risco 2).
- proxy.ts: paraZona copia TODOS os cabeçalhos do navegador (inclusive x-forwarded-*) nos dois caminhos.

## Riscos 1, 2 e 4 no código do Next 16.3.4 (lido em node_modules/next/dist/server)
- R1 CONFIRMADO: resolve-routes.js:466-469 põe `x-middleware-rewrite` = getRelativeURL(destino, initUrl) em resHeaders (absoluto para outra origem); router-server.js:395-417 escreve resHeaders na resposta ANTES do proxyRequest. Sem opção que tire. Antes do C3 o rewrites() do next.config não punha. Importante, plan-mandated, decisão do humano.
- R2 ACHADO: com skipProxyUrlNormalize o proxy vê o initURL cru (next-server.js:1136-1137), mas o roteamento normaliza `/_next/data/<buildId>/X.json` → `/X` (resolve-routes.js:256-293, ativo sempre que há proxy). `/_next/data/<buildId>/_gateway/zona1.json` com cookie: o proxy vê `/_next/data/...` (não é gateway, nem zona) → prosseguir; o Next casa `/_gateway/[...caminho]`. Plausível; não executado (sem subir servidor). Sem cookie → login (inv. 10 intacto). Fragmento/zonas: inalcançáveis por aí (zonas só pelo rewrite do proxy). Públicas/CSP: ficam mais estritas, não mais fracas.
- R4: base-server.js:607-611 usa `??=` (valor do navegador vence); proxy-request.js (caminho rápido, httpxy sem xfwd) já repassava o do navegador antes do C3. Nenhum código de zona/núcleo lê x-forwarded-proto. Menor.

## Lido: test/apoio-mapa, test/gateway.test.mjs (diff 1248-1533)
- Cobertura do gateway sólida: gzip byte a byte, 2 Set-Cookie, hop-by-hop ida e volta, Location, x-forwarded-*, alvo só do mapa com Host/XFH hostis, teto 503+supportId+no-store+conexão fechada, recusa, ociosidade, cliente fecha, _fragmento, mapa vazio, HEAD.
- Falta caso: Location `http://origem//outro.host/x` (vira `//outro.host/x`).

## Lido: testes do shell (mapa-zonas, proxy-renovacao, proxy, zonas), zonas.json apagado (diff 1534-2207)
- Decisão por tipo, 404 do /_gateway (7 grafias x cookie x método), alvo só do mapa, mapa vazio 503, zona nova, renovação antes do caminho: cobertos.
- proxy.test:2030 confirma que `/_next/data/...` não é tratado como gateway (base do achado R2).

## Lido: diff principal (ambiente, base.test, saida-de-rede, zona-de-teste, CONFIGURACAO)
- L9/L9b/L9c/L11 e /_gateway 404 assertam o que o brief pede. Guarda: DEL + regravação + PTTL + shell frio. Recusa de tokens: ok.
- L10: aceita até 2·TTL+1 s (brief: "em até um TTL"); medido ~2,1 s com TTL 2 s. Afrouxado; pode ir a TTL+1 s.
- L10 DEPENDE do vazamento R1: asserta `_rsc=abc12` dentro de `x-middleware-rewrite` (base.test:2510). Corrigir R1 quebra o teste.
- Teste do gzip tolera `x-middleware-rewrite: /_gateway/...` (só o relativo). ok.
- Ociosidade sem regra "maior que ERP_DESTINO_TIMEOUT_MS" (a verificação roda com 3000 < 5000). Menor.
- CONFIGURACAO: as duas variáveis novas com padrão e teto. ok.

## R2, aprofundado
- router-server.js:343-381 não troca `req.url` pelo caminho resolvido; NextRequestAdapter (spec-extension/adapters/next-request.js:89-101) monta a URL do route handler a partir de `req.url`. Logo, por `/_next/data/<id>/_gateway/zona1.json`, o gateway vê `/_next/data/...` → `caminhoOriginal` não tira prefixo → mapa não acha → sem forma de zona → 404. A defesa em profundidade do gateway (re-derivar do próprio caminho) fecha o desvio. Rebaixado a Menor: pedir teste e2e que fixe isso.

## Veredito (final)
- Spec: ✅ (com R1 levado ao humano).
- Importante (plan-mandated, decisão do humano): R1 `x-middleware-rewrite` com a origem interna no caminho rápido; L10 depende dele.
- Menores: x-forwarded-proto do navegador; L10 afrouxado (2·TTL+1 s); Location `//host`; ociosidade sem regra > destino; R2 sem teste e2e; ADR-0015 fala em Sec-Fetch-Dest (Task 5).
- Qualidade da tarefa: Aprovada; R1 bloqueia o fechamento do C3 até a decisão humana.
