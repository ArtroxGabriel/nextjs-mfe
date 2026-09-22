# Handoff Challenger B1+D1 - Iteração 1

- **Data/Hora**: 2026-09-22T17:17:00-03:00
- **Papel**: simulador-condicoes (Challenger do Gate B1+D1)
- **Status**: Concluído
- **Veredito**: APPROVE

## 1. Verificações Executadas

- [x] Verificação e inicialização do Redis (6379 com sub-rede Docker não conflitante 172.28.0.0/16)
- [x] Execução da suíte `task verificar:redis` (60/60 testes passando em 32 s)
- [x] Teste de condições adversas D1 (Redis inacessível -> lança `ErroDeAplicacao('ERRO_INTERNO')` normalizado sem vazamento de stacktrace ou credenciais - Invariante 12)
- [x] Inspeção de chaves criadas no Redis (prefixo `erp:sessao:`, hash SHA256 de 64 caracteres hexadecimais, nenhum ID de sessão cru, TTL ~1800 s configurado de acordo com a inatividade da sessão)
- [x] Validação B1 (navegação entre shell e 3 zonas, erro global e indisponibilidade com kit de aplicação `@erp/nucleo/app` e `@erp/moldura/servidor`)
- [x] Execução de `task verificar:estatica` (16/16 passando)
- [x] Execução de `task test` (todos os repositórios passando com 100% de sucesso)
- [x] Limpeza total de processos e servidores Node (portas 3000-3003, 4001-4004, 4010 livres)

## 2. Evidências de Execução

### 2.1. Execução `task verificar:redis`
```
✔ camada 1: sem cookie, shell e zonas mandam para o login do shell, com Location relativo (1783.521015ms)
✔ N3: o shell grava a sessao e o navegador recebe so um id opaco, HttpOnly e __Host- (88.016709ms)
✔ login nao vira redirecionamento aberto (37.274893ms)
...
✔ o navegador navega, executa JS, envia cookie __Host- e registra respostas com corpo; limpa tudo (1492.441215ms)
...
✔ as quatro aplicacoes reais passam 100% nas regras estaticas de seguranca (102.003717ms)
ℹ tests 60
ℹ suites 0
ℹ pass 60
ℹ fail 0
ℹ duration_ms 32128.816109
```

### 2.2. Inspeção de Chaves no Redis
- Formato da chave: `erp:sessao:bda5839a9296f323bff7b4638d7d45b97cea9f2a7ca21ac7f011a3c99b95b1d4`
- TTL: `1336 s`
- Conteúdo: payload estruturado com `{ sub, nome, accessToken, expiraEm, tokenExpiraEm }`. O identificador de sessão de 36 caracteres recebido pelo navegador não aparece em texto puro.

### 2.3. Verificações Estáticas e Testes Unitários
- `task test`: 39 testes em erp-dominio-stub + 38 testes em erp-shell + 109 em erp-nucleo + 25 em erp-moldura + 16 em erp-contratos = todos passando.
- `task verificar:estatica`: 16/16 passando.

## 3. Conclusão
Todas as provas de robustez do simulador de condições foram satisfeitas sem nenhuma regressão ou violação de invariantes. Ambiente liberado com veredito **APPROVE**.
