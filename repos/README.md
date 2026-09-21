# Repositórios da base MFE

Cada `erp-*` é um repositório git independente. `erp-contratos`, `erp-nucleo` e
`erp-dominio-stub` estão registrados como submódulos de nextjs-mfe. `erp-moldura`,
`erp-shell`, `erp-zona-1`, `erp-zona-2` e `erp-zona-acesso` ainda são **só locais**: falta
criar os remotos e registrá-los (decisão pendente). Até lá, um clone não reproduz a base.
`scripts/` e `verificacao/` são rastreados por nextjs-mfe.

    node scripts/registry.mjs up     # sobe o Verdaccio em :4873
    node scripts/registry.mjs down

Ordem de publicação, sempre: erp-contratos -> erp-nucleo -> consumidores.
