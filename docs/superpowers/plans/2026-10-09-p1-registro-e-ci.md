# P1: registro compartilhado e CI

**Retomada autorizada em 2026-10-12.** Worker executou autenticação real e mutações em cópia isolada. Registro e commits bloqueados pelas montagens somente leitura de `.agents/` e `.git/`; tasks não fechadas. Relatório e provas em `docs/superpowers/reports/2026-10-12-p1-retomada/`.

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
| M4 | seguir redirect do registro | servidor de destino não recebe chamada nem token |
| M5 | aceitar registro HTTP externo | configuração recusa antes de qualquer processo ou rede |
| M6 | omitir `--frozen-lockfile` | teste observa argumentos reais da instalação em fixture |
| M7 | publicar direto do pacote com publishConfig local | fixture observa tarball preparado sem destino local e com origem do commit |
| M8 | manter permissão dev em build/start | teste dos scripts e guarda de subida reprovam |
| M9 | permitir identidade dev implícita na subida de produção | guarda recusa ausência do IdP, mas aceita a autorização explícita do showcase |
| M10 | permitir núcleo ausente no lockfile | lockstep recusa lockfile sem resolução do núcleo |

## Critério de conclusão

O código e os testes locais podem ser concluídos sem credencial externa. P1 operacional só fecha após configurar registro, migrar os tarballs já publicados sem trocar bytes, sincronizar integridades canônicas e obter uma execução verde do CI remoto. D14, D17, cabeçalhos da borda e limite de taxa de login pertencem ao deploy da aplicação e não são fechados por uma mudança de CI de pacotes.

## Evidência da retomada (2026-10-12)

As Tasks continuam abertas: os commits e os documentos de `.agents/` estão bloqueados por montagem somente leitura. Autenticação real e M1–M10 executados; resultados brutos e logs em `docs/superpowers/reports/2026-10-12-p1-retomada/`. Nenhum gate aprovado nesta rodada.

Achado na regressão: headless-shell Docker inicia sem página; o cliente CDP esperava uma. Correção: abrir `about:blank` como no navegador local. Autoteste real do navegador passou (1 pass, 0 fail, 0 skip). Mutação adicional exigida: retirar `about:blank` do comando Docker; o autoteste de navegador deve reprovar. Não modifica arquitetura ou autorização de produto.
