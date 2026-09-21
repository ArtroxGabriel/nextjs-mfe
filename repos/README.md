# repos/ — os repositórios da base

Cada `erp-*` é um repositório git independente, registrado como submódulo, com o próprio
README (o que é, porta, comandos, dependências):

| Repositório | Papel |
|---|---|
| `erp-contratos` | `@erp/contratos`: códigos de erro e manifesto de acesso |
| `erp-nucleo` | `@erp/nucleo`: sessão, destinos, acesso, proxy, fragmentos |
| `erp-moldura` | `@erp/moldura`: moldura visual e toast |
| `erp-shell` | o shell (`:3000`) |
| `erp-zona-1`, `erp-zona-2`, `erp-zona-acesso` | as zonas (`:3001`–`:3003`) |
| `erp-dominio-stub` | domínios falsos (`:4001`–`:4004`, `:4010`) |

As ferramentas que operam a base inteira (subir, verificar ponta a ponta, Verdaccio) ficam em
`../base/`. Ordem de publicação: `erp-contratos` → `erp-nucleo` → `erp-moldura` → aplicações.
