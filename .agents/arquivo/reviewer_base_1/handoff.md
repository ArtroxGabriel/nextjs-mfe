# reviewer_base_1 (revisor-mfe, opus) — gate da base genérica, 2026-09-21

Alvo: repositório principal `1b9e811`; contratos 89b1688, núcleo ecc376b, moldura ec33b01, stub 1f2679a,
shell 4027f87, zona-1 3097608, zona-2 9870027, zona-acesso d0deadd. Handoff salvo pelo orquestrador
(o agente não tem ferramenta de escrita); texto integral do relatório abaixo, resumido só na formatação.

**Veredito: REQUEST_CHANGES** — nenhum bloqueante (categorias 1–5); cinco importantes, cinco menores.

Executado: pnpm test em contratos 13/13, núcleo 57/57 (fronteira ok), moldura 10/10, stub 15/15; script em
processo contra gestao-acesso.mjs; git ls-tree/.gitmodules/remotes. Só lido: shell, zonas, verificacao, scripts.

## Importantes
1. Base validada fora do commit `1b9e811`: erp-moldura, erp-shell, erp-zona-1, erp-zona-2, erp-zona-acesso sem
   remoto e não registrados como submódulo; clone limpo não reproduz o gate; `repos/README.md` afirma o contrário.
2. Invariante 17: manifesto `zona: 'plataforma'` aceito; `plataforma.super` concede módulo de qualquer zona
   (confirmado em processo); perfil `plataforma.admin-acesso` duplicável (chaves React repetidas em /acesso).
3. Invariante 15 / ADR-0009 decisão 11: `sessaoArquivo({modo:'escrita'})`, `identidadeDev` e `escrita` estão na raiz
   pública; a regex estática não pega `modo: "escrita"`, `modo:'escrita'` nem variável. Garantia é convenção.
4. Suspeita forte: HostDeToast só lê `flash` no useState inicial; com JS, `redirect('/acesso')` é navegação suave e o
   toast de /acesso não aparece; o cookie vive 60 s e aparece fora de contexto no próximo documento.
5. Invariante 12: `exigirNaAcao` fora do try nas actions; sessão expirada vira tela genérica de erro do Next.

## Menores
1. Scripts `registrar-manifesto.ts` usam fetch direto (sem timeout, seguem redirect); N8 não varre `scripts/`.
2. Invariante 6 ("SEMPRE If-Match em mutação") × núcleo (só PUT/PATCH/DELETE) e POSTs de /acesso sem versão.
3. Spec 2026-09-09 linha 135 ("interno nunca importa portas") × fronteira.mjs.
4. Regra D8 duplicada na tela /acesso (page.tsx:13-14).
5. README instala as apps sem publicar @erp/* antes; Verdaccio novo tem volume vazio.

## Falta verificação executável
Invariante 16 (toda page chama exigirModulo, toda action chama exigirNaAcao; concluirTarefa por quem não tem o
módulo); 17 (manifesto `plataforma`); 15 (teste estrutural em vez de regex).
