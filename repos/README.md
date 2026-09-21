# Repositórios da base MFE

Cada `erp-*` é um repositório git independente registrado como submódulo
de nextjs-mfe (`erp-contratos`, `erp-nucleo`, `erp-moldura`, `erp-shell`, `erp-zona-1`,
`erp-zona-2`, `erp-zona-acesso` e `erp-dominio-stub`).
`scripts/` e `verificacao/` são rastreados por nextjs-mfe.

    node scripts/registry.mjs up     # sobe o Verdaccio em :4873
    node scripts/registry.mjs down

Ordem de publicação, sempre: erp-contratos -> erp-nucleo -> consumidores.
