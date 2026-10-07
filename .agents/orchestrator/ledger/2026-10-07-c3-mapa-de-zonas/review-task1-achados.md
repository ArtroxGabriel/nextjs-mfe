# Achados da tarefa 1 (final)

Veredito: spec atendida; tarefa aprovada, só Minor.

## Conformidade com a spec: ✅
- POST/DELETE `/v2/zonas/{id}/rota` e GET `/v2/zonas` conforme o brief: status, códigos `{ codigo }`, auditoria (`registrar` também persiste), semente `zonas: []`, OpenAPI com as 3 rotas.
- Marcador generalizado; só as 5 rotas esperadas o usam (v1 manifesto, v2 manifesto, 3 do mapa). Risco nomeado (token de serviço em rota antiga no modo JWT): conferido por grep em `src/`, `servicoAdmitido` só admite quando `rotaDeServico` está nas opções da rota; nenhuma rota antiga ganhou o marcador. Aberto: nada.
- Mutações M1-M8 declaradas no relatório com teste que reprova; ⚠️ não reexecutadas (fora do escopo pedido).
- ⚠️ Não verificável pelo diff: push não concluído (relatório admite).

## Os 4 pontos do implementador
1. Renomeação com alias: correto. O alias `REGISTRO_DE_MANIFESTO` não tem nenhum importador no repositório (grep); é código morto, Minor.
2. Varredura JWT pulando as 3 rotas: aceitável, há teste dedicado por rota em modo JWT; mas o conjunto continua chamado `MANIFESTO` e o título do teste diz "menos o registro de manifesto". Minor (nome enganoso).
3. Origem normalizada sem "/": correto, o contrato e o teste fixam isso; evita duas formas para a mesma origem.
4. 422 de id antes de 403: aceitável (formato do id não é segredo). Ids com dígito inicial ou > 32 caracteres: nenhum `svc` grava; registro válido mas inalcançável. Minor; alinhar o regex do id ao do token (`^[a-z][a-z0-9-]{0,31}$`) ou documentar.

## Pontos fortes
- Handler confere quem é o serviço; marcador só abre a porta.
- Testes cobrem negativos (outro svc, pessoa admin, sem credencial, JWT com pessoa).
- Persistência e auditoria via `registrar`; `e.zonas ??=` tolera estado antigo.

## Problemas
### Critical / Important: nenhum.
### Minor
- `src/base.mjs:70`: alias morto; remover.
- `test/jwt-verificacao.test.mjs` (const `MANIFESTO`): renomear para algo como `ROTAS_DE_SERVICO`, ajustar título do teste.
- `src/gestao-acesso-v2/servidor.mjs` (`zonaValida`): regex de id mais frouxo que o do token (ver ponto 4).
- DELETE e POST registram `autor: null`; aparece ao auditor, só observação (consistente com o manifesto).

## Avaliação
**Qualidade da tarefa:** Approved
**Raciocínio:** comportamento, autorização e auditoria seguem o brief, e o marcador generalizado não abriu nenhuma rota antiga ao token de serviço em modo JWT; restam só polimentos de nomes e código morto.
