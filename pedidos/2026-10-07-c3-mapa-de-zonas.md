# Decisões do C3: mapa de zonas vivo

**Estado:** respondido em 2026-10-07.
**Aberto em:** 2026-10-07.
**Para:** o humano responsável pela base.
**O que espera por isto:** o C3 inteiro (#14). Nada do C3 começa antes da resposta. **Proposta completa:** [`docs/adr/0015-mapa-de-zonas-vivo-e-gateway.md`](../docs/adr/0015-mapa-de-zonas-vivo-e-gateway.md).

## Contexto

A base é um **shell** (porta de entrada; o navegador só fala com ele) na frente de **zonas** (cada módulo é uma aplicação Next.js própria). Hoje o shell sabe onde está cada zona por um arquivo, o `zonas.json`, que vira regras de redirecionamento interno (`rewrites`) **na hora do build**. Isso gera dois problemas:

1. **Zona nova exige um build novo do shell.** O objetivo pede o contrário: uma zona nova entra sem mexer no shell.
2. **Zona travada devolve um "Internal Server Error" cru** depois de 10 s. Quem responde é o próprio Next, sem deixar o shell pôr a página de erro da base, com o código de suporte. Foi combinado (D7) que o C3 resolveria isso.

Conferimos no código do Next 16: fazer o redirecionamento em tempo de execução, pelo `proxy.ts`, resolve o problema 1, mas não o 2. Por baixo passa pelo mesmo mecanismo, com o mesmo erro cru.

**A proposta:** o shell passa a encaminhar ele mesmo as requisições de zona (um "gateway", com `fetch`). Ele lê o mapa de zonas em tempo de execução, na gestão de acesso, e controla o tempo de espera, o que permite responder com a página da base. A zona continua declarando só `{ id, nome, funcionalidades }`. O endereço interno dela é registrado pelo script de deploy, não pelo código da zona.

## Pergunta

Seis decisões. Cada uma traz as opções e a recomendação.

**H1. "Sem republicar o shell" inclui não reiniciar o shell?**
- (i) Sim: o shell relê o mapa sozinho, a cada intervalo configurável (proposta: 30 s). **Recomendado:** é o que o requisito diz.
- (ii) Não: basta ler o mapa quando o shell sobe e reiniciá-lo quando entra uma zona nova. É mais simples, mas cada zona nova passa por um reinício do shell.

**H2. Mecanismo** (revisto depois da medição; ver "Avaliação de custo e desempenho" abaixo).
- (h) **Híbrido.** O `proxy.ts` lê o mapa vivo e decide por requisição. A **navegação de documento** (`Sec-Fetch-Dest: document`) passa pelo gateway, que entrega a página da base dentro do teto. **RSC, assets e Server Actions** seguem pelo redirecionamento rápido do Next, com o mapa vivo. Se uma busca de RSC falhar, o roteador do Next refaz a navegação como documento, que cai no gateway e mostra a página. **Recomendado.**
- (b) Gateway para tudo. Entrega a página em todos os casos, mas custa de 2 a 4,5 vezes mais CPU no shell por requisição, inclusive para assets e RSC, e tem mais código de proxy próprio para manter.
- (a) Só o redirecionamento em tempo de execução pelo `proxy.ts`. É o mais barato, mas continua com o erro cru: a decisão do D7 seria reaberta.

**H3. De onde vem o endereço interno de cada zona?**
- (i) Registro de rota feito pelo script de deploy da zona na gestão de acesso, com auditoria. Uma zona só registra a si mesma. **Recomendado.**
- (ii) Um modelo fixo de endereço (`http://erp-{id}:3000`), com só a lista de zonas vindo dos manifestos. Mais simples, mas exige DNS uniforme em produção e não serve para o ambiente local, que usa portas diferentes.
- (iv) Registro direto no Redis: o script de deploy grava a própria rota numa chave que só ele escreve (usuário ACL por zona), e o shell lê do Redis, que já usa. Dispensa o H4 e as duas rotas novas na gestão de acesso, o que corta duas fatias. Custos: sem a auditoria do domínio, um segredo do Redis a mais por zona no deploy, e o Redis passa a ser fonte da verdade do mapa (exige persistência ligada).
- (iii) Arquivo ou ConfigMap montado no shell. Na prática é o `zonas.json` com outro nome: não atende o objetivo.

**H4. Credencial do shell para ler o mapa.** Ler o mapa exige uma credencial de serviço própria do shell, o que adianta um pedaço do G5, que tinha ficado para depois do objetivo.
- (i) Adiantar só esse pedaço, com escopo mínimo (só ler o mapa). **Recomendado.**
- (ii) Esperar o G5. Nesse caso o C3 fica parado.

**H5. Zona que trava depois de já ter começado a responder.** A página da base só pode sair antes do primeiro byte da zona; depois disso o status já foi enviado.
- (i) Teto até o primeiro byte, com página da base. Depois disso, um tempo máximo de silêncio entre pedaços corta a resposta, sem página (limite declarado). O carregamento progressivo das páginas continua funcionando. **Recomendado.**
- (ii) O shell segura a resposta inteira até o teto para sempre poder trocar pela página. Tira o carregamento progressivo de todas as zonas.

**H6. O `zonas.json` depois da migração.**
- (i) Apagar: uma fonte só. O showcase registra as zonas pelo `task`. **Recomendado.**
- (ii) Manter como semente de desenvolvimento, com o risco de duas fontes divergirem.

**Risco a aceitar junto (vale para qualquer opção do H3):** o shell repassa à zona o cookie de sessão do usuário. Quem consegue registrar um endereço falso para uma zona recebe a sessão de quem abre aquela zona. As defesas são três: só a própria zona registra a si mesma; o shell só aceita endereços que casam uma lista configurada de padrões; e todo registro fica auditado.

## Avaliação de custo e desempenho (2026-10-07)

### O que muda no caminho de cada requisição

Hoje, quando o navegador pede uma página de zona, o shell não executa código nenhum para repassar o pedido. O Next usa um proxy interno que liga a conexão do navegador à conexão da zona e copia os bytes de um lado para o outro. É um trabalho pequeno e quase fixo, feito pelas rotinas de rede do próprio Node.

Com o gateway, o pedido entra no roteador do Next como se fosse uma rota do shell. O Next monta um objeto de requisição, executa o código do gateway, que abre uma nova conexão com a zona, e depois converte a resposta da zona de volta para o formato que o Node envia ao navegador. Cada pedaço da resposta passa por duas interfaces de stream em vez de nenhuma. É esse trabalho extra, feito em JavaScript, que custa CPU.

### Como foi medido

Montei um app Next 16.3.4 de teste, fora do repositório, usando o mesmo `node_modules` do shell, na frente de uma zona falsa. A zona falsa responde uma página HTML de 75 KB e um arquivo JS de 232 KB, comprimindo com gzip quando o pedido aceita, como faz uma zona Next. Comparei três variantes:

| Variante | O que é |
|---|---|
| Rewrite | o mecanismo de hoje, que também é o da opção (a) |
| Gateway com `fetch` | o gateway como o ADR propunha no início |
| Gateway com `node:http` | o gateway repassando os bytes comprimidos da zona sem abrir |

Cada caso rodou 8 segundos com conexões reaproveitadas, em três níveis de carga: 1 conexão por vez, 4 conexões e 32 conexões, que satura o shell. Tudo rodou na mesma máquina de 16 núcleos, então os números servem para comparar as variantes, não como capacidade de produção.

### Resultados

| Caso | Rewrite | Gateway com `node:http` | Gateway com `fetch` |
|---|---|---|---|
| tempo de resposta com 1 conexão, mediana e p99 | 1,3 e 1,9 ms | 2,0 e 3,1 ms | 2,1 e 3,6 ms |
| tempo de resposta com 4 conexões, mediana e p99 | 1,3 e 3,3 ms | 5,0 e 11,3 ms | 6,1 e 13,5 ms |
| páginas por segundo com o shell saturado | 4.293 | 907 | 693 |
| arquivos JS por segundo com o shell saturado | 3.849 | 864 | 459 |
| CPU do shell por requisição | cerca de 0,3 ms | cerca de 1,3 ms | de 1,8 a 5,9 ms |
| tamanho da página que chega ao navegador | 4 KB | 4 KB | 75 KB |

### O que os números querem dizer

**1. O usuário não percebe a diferença com pouca carga.** Com uma conexão por vez, o gateway acrescenta cerca de 0,7 ms. Uma página de zona de verdade leva dezenas a centenas de milissegundos para renderizar e consultar os domínios, então o acréscimo fica entre 1% e 5% do tempo total.

**2. Com carga, a diferença aparece como fila.** Com 4 conexões ao mesmo tempo, a mediana do gateway sobe para 5 ms, contra 1,3 ms do rewrite. O shell é um processo JavaScript e usa um núcleo de CPU por vez. Como cada requisição pelo gateway ocupa esse núcleo por mais tempo, as requisições começam a esperar umas pelas outras mais cedo.

**3. O custo real é de capacidade, e capacidade vira número de instâncias.** No teste, um processo de shell aguentou cerca de 4.300 páginas por segundo pelo rewrite e cerca de 900 pelo gateway, quase 5 vezes menos. Para o mesmo tráfego, o gateway para tudo pede proporcionalmente mais instâncias do shell. Um exemplo ilustrativo, não medido: com 1.000 usuários ativos fazendo em média uma requisição de página por segundo, o rewrite atende com uma instância folgada; o gateway para tudo precisa de duas ou mais, já no limite.

**4. Em relação ao sistema inteiro, o acréscimo é pequeno.** O shell só repassa. O trabalho pesado é a renderização nas zonas, que costuma gastar de 10 a 50 ms de CPU por página (estimativa, não medida aqui). Somar cerca de 1 ms de CPU no shell por requisição representa poucos por cento do total. O ponto de atenção é o shell em si, porque todo o tráfego passa por ele.

**5. A compressão é uma armadilha que a medição revelou.** Com `fetch`, o Node descomprime a resposta da zona automaticamente, e o Next não volta a comprimir a resposta de um route handler. A página chegou ao navegador com 75 KB em vez de 4 KB, 18 vezes maior, o que pesa em rede lenta e em custo de tráfego. Por isso o gateway precisa usar `node:http` e repassar os bytes comprimidos como vieram. Isso também muda a exceção da checagem de saída de rede (N8), que hoje só aceita `fetch` no shell.

**6. O híbrido paga o custo só onde ele traz benefício.** A página de indisponível da base só importa quando o navegador pede um documento, isto é, quando o usuário abre ou recarrega uma página. Nesse caso o pedido passa pelo gateway. As outras requisições continuam no caminho rápido: os arquivos estáticos (que em produção vão para a CDN), as buscas de RSC que o Next faz a cada clique de navegação e as Server Actions. Se uma busca de RSC falhar porque a zona travou, o próprio roteador do Next transforma o clique numa navegação de documento (`fetch-server-response.js:143-148`), que passa pelo gateway e mostra a página da base. Assim, o custo extra fica restrito aos pedidos de documento, que são a minoria.

### O que ainda não foi medido

Estes pontos entram como teste na fatia do gateway, se o mecanismo for aprovado:

- resposta em streaming longa, para medir o corte por silêncio entre pedaços;
- envio de arquivos grandes do navegador para a zona;
- o cancelamento quando o usuário fecha a aba, para garantir que o shell solta a conexão com a zona;
- o custo medido contra as zonas de verdade, com renderização real, para confirmar a estimativa do item 4. Feito em 2026-10-07 com `task medir:gateway`; resultados no ADR-0015, seção "Medição contra as zonas reais". Em aberto: nenhum e2e afirma o 200 da navegação do cliente (RSC com o `_rsc` calculado pelo navegador) pelo shell; só o pedido é conferido.

### Outras questões das recomendações

- **H1, mapa relido a cada 30 s.** O custo é de uma leitura por instância a cada 30 segundos, desprezível. Com várias instâncias do shell, uma zona nova pode aparecer numa instância antes da outra, por até 30 segundos. Uma zona removida também leva até 30 segundos para sumir.
- **H2, híbrido.** Uma Server Action numa zona travada continua recebendo o erro cru do Next, porque vai pelo caminho rápido; a zona mostra a própria tela de erro. Fica declarado como limite. O código de proxy próprio cobre só documentos, cerca de metade dos cuidados com cabeçalhos do gateway completo.
- **H3.** Com a opção (i), o roteamento passa a depender da gestão de acesso, e o último mapa bom guardado no Redis cobre uma queda dela. Com a opção (iv), depende só do Redis, que o shell já exige para funcionar.
- **H4.** Só existe se o H3 for a opção (i).
- **Segurança.** O shell já repassa o cookie de sessão às zonas hoje, com os rewrites. O risco novo é só o endereço da zona vir de um registro em tempo de execução, e a lista de padrões no shell cobre esse risco.

## Formato da resposta

Uma linha por decisão, por exemplo `H1: i`, `H2: b`, `H3: i`, `H4: i`, `H5: i`, `H6: i`, mais o que quiser comentar. Se aceitar o pacote recomendado (H1 i, H2 h, H3 i, H4 i, H5 i, H6 i), basta "pacote recomendado" (o ADR-0015 passa a "aceito").

## Resposta

Pacote recomendado (humano, 2026-10-07): H1 i, H2 h (híbrido), H3 i, H4 i, H5 i, H6 i. O ADR-0015 passa a aceito.
