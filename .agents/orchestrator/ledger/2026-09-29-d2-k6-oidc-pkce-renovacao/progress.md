# SDD ledger — plan: docs/superpowers/plans/2026-09-29-d2-k6-oidc-pkce-renovacao.md
Ledger recriado em 2026-10-01 nesta máquina (o original ficou na outra); estado de RETOMADA.md.
Task 1: complete (commits nucleo cf56312, stub 29bdc1c, zona-2 7d11a62, principal d1d6345; review clean, segundo RETOMADA.md)
Decisão humana 2026-10-01: Task 2 muda só erp-nucleo (fonte, testes, version 0.10.0 no package.json) sem publicar no Verdaccio nem tocar as apps; publicação + lockstep nas 4 apps vão para a Task 4.
Task 2: dispatched implementer (opus) at nucleo base cf56312, main base a45d36b
Correção 2026-10-01: commits com rodapé de atribuição (stub 908de82, moldura e637cf8, principal 434a5dc) e seus reverts removidos por push forçado; branches voltaram a 29bdc1c, a875c21, 51fd1ab.
Task 2: implementer DONE_WITH_CONCERNS (nucleo d481d14, main dcecec5; 180/180); review package review-task2-nucleo.diff
Task 2: review (opus) — spec ✅; 1 Important (logout durante renovar ressuscita sessão: gravar incondicional após identidade.renovar, criarNucleo.ts:587-602); FIX_BASE nucleo d481d14
Task 2: minor (deferred): lock de arquivo — tomada de lock velho pode dar dois vencedores (sessao-arquivo.ts:289-304); ajustar comentário "mitigada"
Task 2: minor (deferred): teste de 20 renovações concorrentes no nível da fábrica sem a variante Redis falso com NX (ADR-0013 Consequências)
Task 2: minor (deferred): transações expiradas nunca limpas nos stores de arquivo/memória
Task 2: minor (deferred): sessaoMemoria().adquirirLockRenovacao não chama validarTtlDoLock
Task 2: minor (deferred): ERP_RENOVACAO_JANELA_S < ERP_TOKEN_VIDA_S/2 documentado mas não imposto
Task 2: minor (deferred): teste de tempo dos perdedores (<200ms) pode oscilar em CI
Task 2: minor (deferred): fronteira.mjs usa nomes genéricos (iniciar/concluir/renovar) como marcadores de escrita
Task 2: minor (deferred): identidade-dev sem teto absoluto de sessão (ERP_SESSAO_MAXIMA_S)
Pendência para Task 4: wrapper lib/redis.ts do shell precisa de getDel/NX; ADR-0013 §2 (leitor das zonas descarta refreshToken/idToken) não feito — shell precisaria de leitura completa própria
Task 2: fix round 1/5 (implementer: 1 addressed via regravar/SET XX PX, 184/184, mutação ok; commits d481d14..fd94ecc) — scoped re-review NÃO despachada: humano pediu parada em 2026-10-01
Task 2: fix round 1/5 — re-review dispatched (sonnet) 2026-10-03, package rereview-task2-r1.diff
Task 2: fix round 1/5 (1 addressed, 0 open; commits d481d14..fd94ecc; re-review sonnet: sem quebra nova)
Task 2: complete (commits nucleo cf56312..fd94ecc, main dcecec5; review clean)
Task 3: dispatched implementer (opus) at nucleo base fd94ecc, main base eca45ad; install openid-client ^6.8.8 (dev + optional peer) aprovado no plano
Task 3: implementer DONE_WITH_CONCERNS (nucleo c172bc8, main 635f2f5; 211/211); review package review-task3.diff
Task 3: review (opus) — spec ✅ com ressalva; 1 Important (encerrar põe id_token_hint na URL de logout que vai ao navegador, identidade-oidc.ts:226; teste:420 trava o vazamento); FIX_BASE nucleo c172bc8
Task 3: minor (deferred): urlRetorno aceita query/fragmento; openid-client stripParams faz redirect_uri divergir → todo login null (validar soOrigemECaminho)
Task 3: minor (deferred): concluir trata invalid_client (401) como recusa null em vez de lançar (renovar lança)
Task 3: minor (deferred): peer "opcional" openid-client é obrigatório para quem importa /shell (reexport estático) — Task 4 adiciona no erp-shell e documenta
Task 3: minor (deferred): encerrar lança se discovery falha, depois que encerrarSessao já apagou a sessão — devolver urlLogout null ou try/catch na rota sair (Task 4)
Task 3: minor (deferred): porta identidade.ts não documenta que concluir/iniciar lançam em erro transitório (rota retorno precisa try/catch)
Task 3: minor (deferred): ehTransitorio trata todo TypeError (inclui CodedTypeError de argumento) como transitório
Task 3: minor (deferred): causa do erro descartada sem rastro no servidor (emissor errado, invalid_client) — diagnosticar IdP difícil
Task 3: fix round 1/5 — resumed implementer: remover id_token_hint (client_id + post_logout_redirect_uri)
Task 3: fix round 1 implementer DONE (nucleo 9a593a4; 211/211; mutação ok); re-review dispatched (sonnet)
Task 3: fix round 1/5 (1 addressed, 0 open; commits c172bc8..9a593a4)
Task 3: minor (deferred): sem id_token_hint o Keycloak pode não redirecionar ao post_logout_redirect_uri — conferir no ponta a ponta
Task 3: complete (commits nucleo fd94ecc..9a593a4, main 635f2f5; review clean)
Task 4: dispatched implementer (opus) at main 620b192, shell c8a3683, nucleo 9a593a4; inclui publicar nucleo 0.10.0 no Verdaccio local + lockstep 4 apps + openid-client no shell; resolução: proxy só chama nucleo.sessao.renovarSessao (lock dentro da fábrica, decisão da Task 2)
Task 4: implementer DONE_WITH_CONCERNS (shell 03ba9b0, z1 6791943, z2 4965236, zacesso d396627, main 4604f08; nucleo 0.10.0 publicado de 9a593a4; shell 70/70, verificar 109+4 pulados); review package review-task4.diff
Task 4: review (opus) — spec quase ✅; 1 Important (logout OIDC barrado pela CSP form-action 'self'; ADR-0013 decisão 6 pede politicaDeSeguranca(nonce,{formularioPara}) — falta no núcleo; correção conforme o ADR: núcleo 0.10.1 + lockstep); FIX_BASE shell 03ba9b0, z1 6791943, z2 4965236, zacesso d396627, main 8e12c41
Task 4: minor (deferred): node --test à mão no shell exige --conditions react-server (decisao-proxy importa server-only) — armadilha para AMBIENTE.md
Task 4: minor (deferred): vidaTransacaoS no shell repete padrão/teto do núcleo (600/3600) para o Max-Age do cookie — ideal iniciarLogin devolver expiraEm
Task 4: minor (deferred): cola de proxy.ts (semSessaoSe, Set-Cookie em redirect/next) sem teste unitário
Task 4: minor (deferred): GET /api/auth/entrar grava transação no store sem autenticação (amplificação; limitar taxa na borda)
Task 4: minor (deferred): resposta atrasada com cookie morto pode apagar __Host-session novo de outra aba
Task 4: minor (deferred, segurança, pré-existente): build/start fixam ERP_PERMITIR_IDENTIDADE_DEV=1; sem IDP_EMISSOR em produção, /login/dev fica aberto — recusa explícita ou aviso
Task 4: minor (deferred): p95 do proxy (1 leitura do store por requisição) não medido, exigido pelo ADR-0013
Task 4: ⚠️ ADR-0013 Consequências "Documentos a atualizar" (AGENTS.md inv. 4 e 15, 06-seguranca.md, 11-testes.md) — conferir na Task 6
Task 4: fix round 1/5 — resumed implementer: formularioPara no núcleo 0.10.1 + lockstep
Task 4: fix round 1 implementer DONE (nucleo 2fa8c06 v0.10.1 publicado, shell d333932, z1 c7f52cf, z2 a8b1753, zacesso 5b02a2b, main 78b019b; nucleo 219/219, shell 73/73, verificar 109+4). Controller confirmou lacuna: task scripts:test V1 vermelho (4 variáveis de sessão do núcleo 0.10 fora da lista de inclusão) — reenviado ao implementer como rodada 1b antes da re-revisão
Task 4: rodada 1b DONE (main 117236f; scripts:test 20/20, mutações 5/5); re-review dispatched (sonnet) sobre os dois achados
Task 4: fix round 1/5 (2 addressed, 0 open; nucleo 9a593a4..2fa8c06, shell 03ba9b0..d333932, z1..c7f52cf, z2..a8b1753, zacesso..5b02a2b, main 8e12c41..117236f)
Task 4: minor (deferred): V1 usa() ignora chamador da função isenta no próprio arquivo definidor; alcançabilidade ignora import()/require dinâmico
Task 4: complete (nucleo 2fa8c06 v0.10.1, shell d333932, z1 c7f52cf, z2 a8b1753, zacesso 5b02a2b, main 117236f; review clean)
Task 5: dispatched implementer (opus) at main 6a80058, stub 29bdc1c; resolução: stub é .mjs e não depende do núcleo (sincronizar núcleo no stub não se aplica; lockstep 0.10.1 já feito)
Task 5: implementer DONE_WITH_CONCERNS (stub 4712d4e, main 2c058cb; stub 69/69, verificar 111+4, redis 115/115, mutações 23/24 com M17 equivalente); preocupação: Bearer svc.<app> aceito em modo JWT (ADR decisão 7 diz só JWT) — decisão do humano; review package review-task5.diff
Task 5: review (opus) — spec quase ✅; 1 Important CONFLITA COM ADR-0013 decisão 7: Bearer svc.<app> sem autenticação aceito em modo JWT (base.mjs:41-45,80-81), alcança primeiro-acesso/decisoes/eventos (svc.idp) e manifesto; docs subestimam; M17 confirmada equivalente. Na base, só scripts/registrar-manifesto.ts (zona-1, zona-2) usa svc. → decisão do humano
Task 5: minor (deferred): base64url sem checagem de forma canônica (maleabilidade só da assinatura)
Task 5: minor (deferred): falhar-fechado no vencimento do TTL do JWKS com IdP fora derruba todos ≥ ERP_JWKS_INTERVALO_MIN_S — documentar em CONFIGURACAO §4
Task 5: minor (deferred): intervalo mínimo do JWKS medido início a início; timeout > intervalo permite buscas seguidas
Task 5: minor (deferred): r.json() do JWKS sem limite de tamanho/content-type
Task 5: minor (deferred): azp não conferido (qualquer cliente com mapper erp-dominios passa)
Task 5: minor (deferred): teste do token de serviço só verifica notEqual(401)
Task 5: ⚠️ teste ADR "página de zona 200 após vencer o 1º token" e e2e com Keycloak real → Task 6
Task 5: decisão do humano 2026-10-03: opção (a) — adendo ao ADR-0013; em modo JWT svc.<app> só registra o manifesto do próprio módulo; svc.idp, decisoes, eventos, primeiro-acesso recusados; docs com alcance real. fix round 1/5 — resumed implementer
Task 5: fix round 1 implementer DONE (stub 783242b, main 1f4414c; stub 71/71, verificar 112+4, redis 116/116, mutações R1–R6 pegas); re-review dispatched (sonnet)
Task 5: fix round 1/5 (1 addressed, 0 open; stub 4712d4e..783242b, main 2c058cb..1f4414c)
Task 5: minor (deferred): varredura de rotas do teste lê o fonte por regex (piso de 117 chamadas mitiga); R1 só no nível do stub
Task 5: complete (stub 29bdc1c..783242b, main 2c058cb..1f4414c; review clean)
Task 6: dispatched implementer (opus) at main 1f4414c; escopo ampliado pelo controlador com os ⚠️ das revisões: showcase em modo OIDC (E3), teste ADR página de zona 200 após vencer o 1º token, documentos da lista do ADR-0013, p95 do proxy
Task 6: implementer NEEDS_CONTEXT parcial (main 232c8f4, 5a1d2f0; 409/409, verificar 112+4, redis 116/116); itens 3,4 feitos; itens 1,2 bloqueados: next start = NODE_ENV=production recusa IdP http:// (decisão 5) — decisão do humano (a) ERP_PERMITIR_HTTP_LOCAL loopback núcleo 0.10.2 / (b) TLS local / (c) next dev no modo OIDC
Task 6: decisão do humano 2026-10-03: opção (a) exceção de loopback (ERP_PERMITIR_HTTP_LOCAL), núcleo 0.10.2 + lockstep + adendo 2 ao ADR-0013; resumed implementer para itens 1 e 2
Task 6: implementer DONE (nucleo 63e0425 v0.10.2, stub 962932c, shell e171df8, z1 42df5ea, z2 7bf1cce, zacesso 75f8234, main 232c8f4..0d391d0; 419/419, verificar 112+4, redis 116/116, oidc 5/5); pushed; review package review-task6.diff
Task 6: review (opus) de 2026-10-03 perdida com a sessão (sem veredito); 2026-10-05 re-dispatched (opus) sobre o mesmo review-task6.diff (submódulos conferidos sem mudança), com achados gravados em review-task6-achados.md a cada etapa
2026-10-05: regras de processo novas (achados parciais do revisor; ledger no git via task orquestrador:ledger), commit 55d22c6. Pacote da revisão final pronto: review-final.diff (principal 4c88d33..HEAD, submódulos desde as fixações de antes do d1d6345; 418 KB) — despachar depois do veredito da Task 6
Task 6: review (opus, 2026-10-05) — aprovado com ressalvas; 1 Important I1 (oidc.test.mjs:186-194: lote de 20 concorrentes não prova renovação na janela nem renovação única; mutação "só renova vencido" passaria; frase usada como evidência em ADR-0013, 11-testes §3.2, PENDENCIAS §4, atual.md); achados em review-task6-achados.md
Task 6: minor (fix na rodada 1): M1 CONFIGURACAO.md:21,24,61 e ADR-0013 decisão 5 sem citar a exceção do adendo 2; M2 verificar:oidc sai 0 com Keycloak fora (pulo); M3 oidc.test.mjs:177 origem 4001 fixa
Task 6: minor (deferred → triagem final): M4 logout OIDC não seguido até o Keycloak (menor T3 do id_token_hint agora verificável; ROTEIRO A11)
Task 6: minor (sem ação): M5 pnpm-lock do stub com hash local de @erp/contratos 0.2.1 (AMBIENTE §1)
Task 6: fix round 1/5 — dispatched implementer (opus) para I1, M1, M2, M3
Task 6: fix round 1 implementer DONE (main d82e5b7; verificar:oidc 5/5, EXIGIR=1 com emissor inalcançável vermelho, estatica 51/51, scripts 20/20, redis 116/116; mutações (a) só renova vencido e (b) sem lock pegas); re-review dispatched (sonnet), package rereview-task6-r1.diff
Task 6: re-review (sonnet) aprovado com 2 menores: R1 (lote pode passar do vencimento e mascarar 'só renova vencido'), R2 (monitorarRedis sem try/finally). Corrigidos pelo controlador em 848e5fe: verificar:oidc 5/5, estatica 51/51, scripts 20/20
Task 6: fix round 1/5 (I1, M1–M3 addressed + R1, R2; main d82e5b7, 848e5fe)
Task 6: complete (main 232c8f4..848e5fe, núcleo 0.10.2 63e0425; review clean após correções). M4 → triagem da revisão final
Final review: package review-final.diff rebuilt at main 848e5fe; dispatched (opus) com triagem dos menores adiados
Final review (opus): pronto para o gate após A1–A5 (docs + A3 logout seguido no Keycloak); N1–N5 Minor; triagem: A3=M4, demais B (DEFERRED) ou C. Controlador acrescentou A6 (N2 logout CSRF: SameSite=Lax impede encerrar no store, mas resposta cross-site apaga o cookie). Dispatched implementer (opus) A1–A6 + DEFERRED dos B; relatório final-fix-report.md
