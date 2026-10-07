# Achados da re-revisão da Task 4 (final)

Veredito: Approved. Por leitura; nada foi executado.

1. Important resolvido: F7 lê a versão de t-4 em GET /v1/tarefas do domínio C (showcase.test.mjs:266-272), sem teto de tentativas. As três provas seguem (atual passa, repetida recusada com o toast "Este registro mudou", seguinte passa). Com o domínio ignorando If-Match, a repetida passaria e o teste reprovaria.
2. Leitura direta: token dev.ana.<uuid> ou tokenDoKeycloak('ana') (mesmo helper de base.test.mjs:1526); o token não aparece em mensagem, saída ou arquivo; a leitura serve só para a versão e a mutação passa pela Server Action. Origem em DOMINIO_C_URL com padrão 4003 (documentada em CONFIGURACAO.md).
3. Menores: F5 compara o <nav> inteiro (menos aria-current) entre zona 1 e zona 2, e a abertura e a marcação dos links em /acesso; F6 e o comentário do toast estão honestos; linha F7 do roteiro curta e sem caracteres proibidos.
4. Nada quebrado nas outras F.

Ressalva sem bloqueio: o comparativo de F5 em /acesso não foi executado; se o menu de /acesso tiver classe própria, o teste reprovaria (o que é o desejado).
