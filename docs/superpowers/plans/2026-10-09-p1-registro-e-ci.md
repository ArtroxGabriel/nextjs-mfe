# P1: registro compartilhado e CI

**Correção da iteração 2 em 2026-10-12.** Gate reprovado por dist antigo, material descartável e cleanup em sinal. Worker p1_3 corrige o publicador e acrescenta testes permanentes. Tasks e gate continuam abertos; o orquestrador aplica as propostas do ledger e commita o principal. Evidência bruta somente no scratchpad do worker.

**Autorização:** em 2026-10-09, o humano pediu continuar sem confirmações. Seguir a ordem recomendada no pedido de 2026-10-07: P1, G5 e depois G4. A implementação não administra o projeto `sisbin-planejamento-local` nem seus processos.

**Objetivo:** instalar os oito repositórios com lockfiles congelados contra um registro npm configurável, recusar substituição de versão publicada e executar as verificações no GitHub Actions. A ativação do registro depende de endereço e credenciais reais, que não estão disponíveis neste checkout. Não declarar essa ativação como concluída.

**Desenho:** ADR-0016. Manter os nomes `@erp/*`. GitHub Actions acompanha o remoto real; não exigir GitLab CI só porque as atividades são acompanhadas no GitLab. Um registro npm compartilhado é escolhido por `ERP_NPM_REGISTRY`; somente o ambiente local tem padrão de loopback. Credenciais ficam em arquivo temporário privado durante a operação e nunca entram nos argumentos dos processos. Publicação verifica a ausência da versão, usa um tarball preparado uma vez e recusa qualquer resposta diferente de 404. O registro também deve proibir sobrescrita e exclusão.

## Tasks

- [ ] 1. Implementar instalação e publicação pelo registro configurável, preflight de integridades dos lockfiles, testes e mutações. Corrigir a dependência inexistente de `task preparar`. Não alinhar hashes automaticamente.
- [ ] 2. Fechar D18: scripts de build e start não autorizam identidade dev. Manter a autorização explícita do showcase e da verificação. Provar a recusa na subida do shell.
- [ ] 3. Adicionar CI de unidades, segurança estática, scripts, lockstep e commits dos submódulos. Publicação manual em workflow separado com credencial de escrita somente nessa etapa. Documentar configuração e limitações de ativação.
- [ ] 4. Reconciliar documentos de retomada e GitLab. Rodar regressão apropriada, revisão independente e gate. Registrar os resultados sem afirmar execução remota nem registro provisionado. Commitar os passos e enviar submódulo antes do principal.

## Mutações declaradas

| ID | Mutação | Prova exigida |
|---|---|---|
| M1 | aceitar versão já publicada | publicação com versão existente não chega ao empacotamento nem ao publish |
| M2 | tratar 401 ou 500 como versão ausente | erro de autenticação/servidor interrompe publicação |
| M3 | aceitar integrity diferente | preflight falha e não instala nem reescreve o lockfile |
| M4 | seguir redirect na consulta de metadata | preflight recusa 3xx; servidor de destino não recebe chamada nem token. Não cobre o downloader do pnpm; limite em docs/REGISTRO-E-CI.md |
| M5 | aceitar registro HTTP externo | configuração recusa antes de qualquer processo ou rede |
| M6 | omitir `--frozen-lockfile` | teste observa argumentos reais da instalação em fixture |
| M7 | publicar direto do pacote com publishConfig local | fixture observa tarball preparado sem destino local e com origem do commit |
| M8 | manter permissão dev em build/start | teste dos scripts e guarda de subida reprovam |
| M9 | permitir identidade dev implícita na subida de produção | guarda recusa ausência do IdP, mas aceita a autorização explícita do showcase |
| M10 | permitir núcleo ausente no lockfile | lockstep recusa lockfile sem resolução do núcleo |
| M11 | omitir limpeza de dist antes do build | teste planta .js/.d.ts órfãos e inspeciona npm pack real; nenhum órfão pode estar no tarball |
| M12 | omitir handlers de SIGINT/SIGTERM | processos reais de install e publish interrompidos nos dois sinais removem auth.ini e encerram os filhos próprios |
| M13 | omitir cleanup em exit | saída explícita durante autenticação não deixa auth.ini |
| M14 | esperar os filhos antes de apagar credenciais no sinal | filho resistente a SIGTERM continua vivo, auth já sumiu; controlador aguarda e aplica SIGKILL no teto configurado |

## Critério de conclusão

O código e os testes locais podem ser concluídos sem credencial externa. P1 operacional só fecha após configurar registro, migrar os tarballs já publicados sem trocar bytes, sincronizar integridades canônicas e obter uma execução verde do CI remoto. D14, D17, cabeçalhos da borda e limite de taxa de login pertencem ao deploy da aplicação e não são fechados por uma mudança de CI de pacotes.

## Evidência da retomada (2026-10-12)

As Tasks continuam abertas. Autenticação real e M1 a M10 foram executados na retomada anterior. Seus logs e executores foram retirados do repositório e preservados no scratchpad. As contagens essenciais e decisões ficam no ledger e GATE_STATUS; nenhum gate aprovado nesta rodada.

Achado na regressão: headless-shell Docker inicia sem página; o cliente CDP esperava uma. Correção: abrir `about:blank` como no navegador local. Autoteste real do navegador passou (1 pass, 0 fail, 0 skip). Mutação adicional exigida: retirar `about:blank` do comando Docker; o autoteste de navegador deve reprovar. Não modifica arquitetura ou autorização de produto.


## Correções exigidas pela iteração 2

A publicação limpa `dist` antes do build e conserva as dependências já instaladas no checkout. O teste com `npm pack` real verifica os membros do tarball, não somente os argumentos. SIGINT/SIGTERM removem temporários sincronamente, terminam grupos próprios e aguardam `close`, com teto documentado em `ERP_NPM_ENCERRAMENTO_MS`. `exit` tem limpeza síncrona adicional.

M11 a M14 devem ser reaplicadas em cópia isolada, com baseline verde e identificação do teste que detecta cada mutação. Os executores particulares ficam no scratchpad. As famílias exigidas são scripts, estática e lockstep; `task test` também se houver mudança de submódulo.

O pnpm 12.5.1 segue redirect de tarball: caso entre origens distintas em loopback sem Authorization no destino, bytes canônicos aceitos e adulteração recusada pelo hash congelado. Sem opção pública de recusa identificada, esse comportamento é limite declarado. O registro oficial deve servir bytes diretamente; a ativação continua pendente. A observação `Ready` antes da recusa do shell, sem resposta HTTP servida, é registrada sem mudança de produto.


## Resultado do worker p1_3

Scripts 60 pass, 0 fail, 0 skip; estática 52 pass, 0 fail, 0 skip; lockstep 0.10.4 nas quatro apps, saída 0. Nenhum submódulo alterado, portanto task test não foi repetido nesta correção.
M1 a M14 detectadas em cópia isolada, zero sobreviventes. Baselines: 43 pass, 0 fail, 0 skip. Execuções com mutações: 123 testes, 103 pass, 20 falhas esperadas, 0 skip, 0 cancelled.

M11 foi detectada por `dist orfao nao entra no tarball real da publicacao` em `base/scripts/pacotes.test.mjs`. M12 foi detectada pelas quatro interrupções reais em `base/scripts/pacotes-processos.test.mjs`; M13 pelo caso `exit explicito durante autenticacao remove auth sincronamente`; M14 por `sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento`. Logs por mutação no scratchpad; tabela completa no progress.md proposto ao orquestrador. Novo gate independente pendente.
