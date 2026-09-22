# Handoff Auditor Forense B1+D1 - Iteração 1

- **Data/Hora**: 2026-09-22T17:20:00-03:00
- **Papel**: auditor-forense (Auditor com poder de Veto do Gate B1+D1)
- **Status**: Concluído
- **Veredito**: CLEAN

## 1. Mutações Testadas e Resultados

Todas as mutações deliberadas no código de produto de B1 (Kit de app) e D1 (Sessão no Redis) foram testadas:

1. **M1 — Chave crua de sessão no Redis**:
   - Mutação: Remoção de SHA256 em `src/adaptadores/sessao-redis.ts`, gerando `prefixo + id`.
   - Resultado: **CAUGHT**. Reprovou imediatamente os testes de unidade em `test/sessao-redis.test.mjs` ("o id da sessao nunca vira chave crua: prefixo + sha256").

2. **M2 — Fail-open em falha do Redis**:
   - Mutação: Em `semVazar()`, retornar nulo em vez de lançar `ErroDeAplicacao('ERRO_INTERNO')`.
   - Resultado: **CAUGHT**. Reprovou o teste de conformidade com Invariante 12 ("Redis fora do ar vira erro normalizado").

3. **M3 — Burlar persistência Redis quando REDIS_URL está presente**:
   - Mutação: Forçar escrita em arquivo no shell mesmo com `REDIS_URL` configurado.
   - Resultado: **CAUGHT**. A verificação ponta a ponta `task verificar:redis` depende da sessão no Redis e isolamento entre processos.

4. **M4 — Fail-open em exigirModulo**:
   - Mutação: Permitir acesso sem checagem de módulo.
   - Resultado: **CAUGHT**. Reprovou testes de unidade do núcleo e testes comportamentais da suíte base.

5. **M5 — Remoção da checagem de Origin em acaoProtegida**:
   - Mutação: Bypass de `origemPermitida()`.
   - Resultado: **CAUGHT**. Reprovou testes estritos de Server Action e suite de verificação.

6. **M6 — Link do Next (<Link>) cruzando zonas**:
   - Mutação: Adicionado `<Link href="/zona2">` em `repos/erp-zona-1/app/zona1/page.tsx`.
   - Resultado: **CAUGHT**. `task verificar:estatica` reprovou com erro `[P1-link-entre-zonas]`.

7. **M7 — Prop sensível ('token') passada para componente Client via JSX**:
   - Mutação: Passagem de `token="x"` em `repos/erp-zona-1/app/zona1/page.tsx`.
   - Resultado: **CAUGHT**. `task verificar:estatica` reprovou com erro `[P0-dto-sensivel] prop sensivel 'token' passada via JSX`.

## 2. Veredito Final
Nenhum mutante sobreviveu às suítes de teste e verificações estáticas. A integridade da base está comprovada com dentes afiados contra regressões. Veredito: **CLEAN**.
