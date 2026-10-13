# Preparação do Package Registry do GitLab

**Autorização e decisão:** humano, 2026-10-13. GitLab self-hosted será o registro oficial;
endereço e credenciais ainda não existem. Preparar sem ativar, publicar externamente ou
alterar submódulos. O gate local anterior do P1 não certifica esta mudança nem o CI remoto.

## Etapas

1. Conferir endpoints, escopo, metadata, duplicados, forwarding, object storage e tokens na
   documentação oficial. Registrar fontes em `docs/REGISTRO-E-CI.md`.
2. Consultar metadata do pacote e selecionar `versions[versao]`; falha de estrutura não é
   ausência. Separar registro de publicação, preservando prefixo e auth privada temporária.
   Como GitLab pode omitir SHA-512 e campos próprios, calcular SHA-512 dos bytes do tarball
   em endereço explicitamente configurado, sem redirects; origem do commit fica no tarball.
   Migração GitLab fixa URL validada de tarball no lock, sem trocar SHA-512; instalação
   congelada recusa lock GitLab sem URL, porque pnpm infere caminho convencional incorreto.
3. Testar registro falso com caminho GitLab e npm pack/publish reais em loopback efêmero.
   Adaptar fixtures anteriores ao contrato de metadata; preservar provas de sinais e D34.
4. Preparar GitLab CI opt-in, verificações equivalentes às do GitHub e publicação manual
   serializada em branch protegido, token de escrita limitado ao ambiente de publicação.
5. Documentar ativação humana e adendo aceito do ADR-0016. Rodar mutações em cópia isolada,
   `task scripts:test`, `task verificar:estatica` e `task lockstep`. Principal fica sem commit.

## Mutações declaradas

A revisão humana na retomada exige G9 a G13 além do lote original G1 a G8; substitui
o teto original de oito. G9/G10 exercitam comportamento; G11/G12 conferem documentos;
G13 confere a presença da contagem completa no relatório, com estado pendente explícito
quando a sandbox bloquear a família.

| ID | Mutação | Teste exigido (`pacotes-gitlab.test.mjs`) |
|---|---|---|
| G1 | GET por versão que GitLab não tem | versão existente na metadata nunca chega ao build |
| G2 | aceitar 403 de PUT duplicado como sucesso | PUT duplicado HTTP 403 interrompe e remove auth |
| G3 | perder prefixo `/api/v4/...` na URL de metadata | versão existente na metadata nunca chega ao build |
| G4 | perder prefixo no `_authToken` | instalação por grupo autentica projeto do tarball |
| G5 | publicar no registro de instalação apesar do endereço de publicação | publica por PUT no projeto |
| G6 | aceitar HTTP externo | preserva prefixos e valida HTTPS em ambos os endereços |
| G7 | seguir redirect de metadata | redirect de metadata não é seguido nem amplia credencial |
| G8 | aceitar SHA-1 sem provar SHA-512 dos bytes | shasum SHA-1 não substitui SHA-512 canônico |

Cada mutação roda antes do término, com baseline verde, detector identificado e restauração
por descarte da cópia. Sobrevivente exige teste novo. Logs e executor ficam no scratchpad;
o resumo final e as contagens vão ao handoff. Somente servidores loopback com porta efêmera.

| ID | Mutação da revisão | Detector |
|---|---|---|
| G9 | aceitar origem ausente em registro não GitLab | origem obrigatória fora do GitLab |
| G10 | escrever token nos dois endpoints | auth somente no endpoint da operação |
| G11 | dispensar espelhos na ativação | roteiro exige espelhos na mesma instância |
| G12 | acrescentar travessão ao texto novo | textos novos sem travessão |
| G13 | omitir contagem da família scripts completa no relatório | validação do relatório no scratchpad |

Retomada: a sandbox bloqueou listen em loopback com EPERM. Parar as execuções com
sockets, não reutilizar os resultados anteriores como aprovação das correções. Baseline
loopback, G1 a G8 e scripts completos ficam pendentes para ambiente que permita sockets.
Fixtures AM3 e zona demo passam a selecionar porta efêmera; não usar portas do orquestrador.
