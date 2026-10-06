# Achados Task 1 (final)

Spec: APROVADO. Qualidade: APROVADA.

Verificado: código idêntico ao brief; exigirModulo com dois argumentos (criarNucleo.ts:168 lança NaoEncontrado -> 204 no helper, fail-closed);
destino `dominio-c` GET `/v1/tarefas` está no registro da zona 2 (lib/nucleo.ts:16); só título escapado no HTML (sem token/grupo);
`/zona2` no link é do próprio prefixo; `server-only` presente; sem rodapé de coautoria nos commits; arquivos fora de commit intactos.

Critical: nenhum. Important: nenhum.
Minor:
1. C1a não cobre o ramo "nada pendente" (200 com "Nenhuma tarefa pendente.") nem o escape de título (`<`, `&`); só unidade/manual poderiam provar.
2. C1a não afirma que o 200 traz título de tarefa real (só cabeçalho e marcador), então regressão que sempre devolvesse lista vazia passaria.
3. Falha do domínio (ErroDeAplicacao) vira 204 igual a negado: intencional (ADR-0011), mas sem teste que a distinga.
