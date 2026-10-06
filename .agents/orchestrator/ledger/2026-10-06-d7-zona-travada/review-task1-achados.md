# Achados Task 1 D7 (final)

Spec: conforme (diff literal ao brief; padrão 5000/60000 do destino batem com repos/erp-nucleo/src/interno/configuracao.ts:40).
Qualidade: aprovada.

Critical: nenhum. Important: nenhum.
Minor:
- lib/configuracao.ts (lerTetoDaZona): 5_000/60_000 duplicados do núcleo, que não exporta o leitor; deriva silenciosamente se o núcleo mudar. Sem teste de paridade.
- Testes de 'proxyTimeout' no next.config.ts não existem (ligação só provada por build e subida manual, não por teste automatizado).
- ⚠️ docs/CONFIGURACAO.md §2 e ponteiro do submódulo: Task 2 (fora do diff).
