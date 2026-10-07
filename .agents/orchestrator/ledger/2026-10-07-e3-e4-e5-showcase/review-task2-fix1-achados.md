# Achados da re-revisão da Task 2 (final)

Veredito: Approved. Nenhum achado bloqueante.

1. Important resolvido (zona-demo.mjs:32-39): remover lança se status >= 300 e != 404; o finally fecha o servidor. zona.remover() devolve o status (zona-de-teste.mjs:65-72, .then(r => r.status)). Erro de rede também propaga, com o finally fechando. O comando (linhas 47-56) imprime a falha, define codigo=1 e não imprime "Rota removida".
2. Textos: prazo único via `prazo`; ms inválido/NaN/<=0 omite o parêntese. Após derrubar não manda esperar. SIGHUP e unhandledRejection chamam sair, com guarda `saindo`.
3. Task 4: remover lança só em falha real; 404 aceito. Sem regressão.
4. Texto sem travessão, ·, →, × ou emoji (grep limpo). `Bearer svc.demo` é o identificador fictício do showcase (mesmo padrão svc.{id} de zona-de-teste.mjs:67), não segredo: concordo.

Observações (Minor, sem ação exigida): a dica "Remova à mão" fixa `demo` em vez de `id` (principal só usa o id padrão); o padrão 127.0.0.1:4020 coincide com zona-de-teste.mjs:14.
