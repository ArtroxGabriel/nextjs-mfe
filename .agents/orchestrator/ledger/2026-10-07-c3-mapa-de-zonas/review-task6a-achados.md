# Revisão Task 6a, medição do gateway (final)

## Spec Compliance
- ✅ `base/scripts/medir-gateway.mjs` sem dependência nova (só `node:*` e helpers do repositório).
- ✅ Tarefa `medir:gateway` com `desc` no `Taskfile.yml` (Taskfile.yml:114-119), com as mesmas variáveis de Redis da `medir:proxy`.
- ✅ Cenários documento pelo gateway, RSC e ativo pelo caminho rápido, 1 e 4 conexões; p50, p99, req/s, bytes e CPU por requisição saem no script.
- ✅ Tabela e interpretação no ADR-0015 (seção "Medição contra as zonas reais") e uma linha no pedido.
- ✅ Estilo: nenhum travessão, `·`, `→` ou `×` nas linhas adicionadas; um parágrafo por linha. Nenhum cookie ou JWT nos arquivos commitados (o cookie vem de `entrar('ana')` em tempo de execução, e o script não o imprime).
- ⚠️ "gzip confirmado": o script só imprime `content-encoding` (medir-gateway.mjs:73); não falha se não for gzip. O ADR afirma gzip só para o documento; RSC e ativo não são checados.
- ⚠️ O desvio `?_rsc` vazio está documentado no ADR, mas deixa de testar o URL que o App Router realmente envia (`?_rsc=<hash>`). Ver Important 2.

## Strengths
- Medição simples e reproduzível, com aquecimento, keep-alive, validação prévia (status 200, ativo extraído do HTML da própria página) e `finally` que derruba o ambiente.
- A CPU é medida só no shell (grupo de processos), o que isola o custo que importa; o texto avisa que os números valem na mesma rodada.
- O ADR registra a restrição do 307 em vez de escondê-la.

## Issues

### Critical
Nenhum.

### Important
1. Interpretação afirma mais do que os dados mostram. docs/adr/0015-mapa-de-zonas-vivo-e-gateway.md:76.
   - "o gateway acrescentou cerca de 7,5 ms no p50" subtrai a latência do RSC da do documento (25,9 menos 18,4). Os dois cenários diferem em três coisas ao mesmo tempo: o caminho (gateway contra caminho rápido), o que a zona renderiza (HTML completo com layout e scripts, contra payload RSC) e o tamanho (3263 contra 2703 bytes). A diferença é um limite superior misturado do custo do gateway com a diferença de renderização; o gateway pode custar menos, ou mais se a renderização do documento for mais barata. Não há cenário que isole o gateway (por exemplo, a mesma rota com zona falsa de resposta fixa, ou o documento direto na zona).
   - "porque a renderização real da zona domina o tempo e o gateway só repassa" é explicação, não medida; nada na rodada separa tempo de zona de tempo de shell.
   - A comparação "bem menos que as 2 a 4,5 vezes da medição sintética" compara grandezas diferentes: o sintético era gateway contra acesso direto (sem shell) com zona falsa; aqui é documento (gateway) contra RSC (caminho rápido), ambos já pagando o shell. A razão real de CPU é 7,48 / 5,33 = 1,4 vez, mas contra um denominador que já inclui custo de shell. Não confirma nem refuta a estimativa.
   - O dado mais limpo é a CPU do shell (não inclui a renderização da zona): cerca de 2,15 ms a mais por documento (1 conexão) e cerca de 1 ms a mais com 4 conexões (4,39 contra 3,41), e mesmo assim contaminada pelos bytes e pelo tipo de resposta. Com 4 conexões o texto cita só a diferença com 1 conexão e ignora que a diferença de CPU cai pela metade.
   - Correção sugerida: reescrever como "o documento pelo gateway ficou 7,5 ms (p50, 1 conexão) e 2,2 ms de CPU do shell acima do RSC da mesma página; a diferença inclui o que a zona renderiza em cada formato, portanto é um teto para o custo do gateway, não o custo medido; não houve cenário que o isolasse". Retirar "o gateway só repassa" ou marcá-lo como hipótese. Trocar a comparação com o sintético por "não comparável diretamente".
2. ADR :76 e script :70. "O custo fixo de passar pelo shell é o do ativo estático (cerca de 2 ms de CPU)" também é inferência: o ativo é pequeno (662 bytes) e a CPU por requisição depende de bytes e do tipo de resposta; serve como piso aproximado, não como "custo fixo". Dizer "ordem de grandeza do piso".
3. `?_rsc` vazio (script :71, ADR :74). O 307 com `?_rsc=valor` é um achado que pode importar: se o navegador real envia `?_rsc=<hash>`, o caminho de RSC pelo shell pode estar redirecionando na prática. Ou está explicado (comportamento do Next da zona para a rota `/zona1` sem barra final etc.) e deve ser dito, ou virar item aberto no ADR/pedido. Hoje fica só como nota de rodapé de metodologia, e o cenário b mede um pedido que o navegador talvez não faça.

### Minor
1. Uma única rodada, sem repetição nem dispersão; p99 vem de cerca de 300 amostras (1 conexão) e as diferenças de p99 (39,6 contra 37,2) estão dentro do ruído. O texto não conclui sobre p99, mas a tabela convida; vale uma frase "uma rodada, sem variância".
2. medir-gateway.mjs:73: gzip só é impresso. Fazer o script lançar erro se o documento não vier com gzip, já que o requisito é "gzip confirmado".
3. medir-gateway.mjs:61 e :75: a regex aceita `.js` ou `.css`, mas o rótulo diz "CSS"; o ativo medido pode ser JS. Imprimir o tipo ou ajustar o rótulo.
4. medir-gateway.mjs:23-34: a latência de requisições com erro entra em `lat` (e em p99) junto com as boas; as respostas não-200 deveriam ser excluídas ou contadas à parte. Hoje erros = 0, sem efeito prático.
5. `pids` é capturado antes da carga: se o shell reiniciar um filho, a CPU fica subcontada (falha silenciosa no `catch`). Aceitável, mas dizer no cabeçalho.
6. O relatório (task-6-report.md) repete a conclusão sem a ressalva; atualizar junto com o ADR.

## Assessment
Needs fixes. O script, a tarefa e a tabela cumprem o pedido, mas a interpretação (ADR-0015 :76) atribui ao gateway 7,5 ms e uma explicação causal que os dados não separam do formato de renderização, e compara com a medição sintética sem que sejam comparáveis; reescrever como teto, com a CPU do shell como evidência principal, e tratar o 307 de `?_rsc=valor` como ponto aberto.
