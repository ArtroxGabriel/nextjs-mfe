# Gestão de acesso v2 — modelo de referência da base

> **O que é este documento.** O modelo de gestão de acesso que a base adota como referência para
> evoluir o domínio de gestão de acesso atual (`erp-dominio-stub`, porta 4010). É desenho técnico da
> base, com dados fictícios, e **não** uma regra de negócio oficial de nenhuma organização: quem
> adotar a base ajusta papéis, prazos e categorias à própria realidade, por configuração.
>
> **Onde está:** mock da API em `repos/erp-dominio-stub/src/gestao-acesso-v2/` (porta 4020), contrato em
> `repos/erp-dominio-stub/contratos/gestao-acesso-v2.openapi.yaml`, dados em
> `repos/erp-dominio-stub/dados/semente/gestao-acesso-v2.json`, testes em `test/gestao-acesso-v2.test.mjs`.
> Para rodar só ele: `task acesso-v2`. Vocabulário básico (BFF, zona, módulo…): [`../RESPONSABILIDADES.md`](../RESPONSABILIDADES.md).

## 1. As peças

| Peça | O que é |
|---|---|
| **Unidade** | Grupo de pessoas com gestão própria (um órgão, uma empresa, um departamento). Tipo único; a `categoria` (`plataforma` ou `parceira`) só informa. Pode ter **convênio** com início e fim. |
| **Pessoa** | Quem usa a plataforma. Identificada pelo **CPF**, único e imutável. Tem **um vínculo ativo** por vez (unidade + e-mail funcional) e o histórico dos anteriores. |
| **Papel** (atribuição) | Responsabilidade transversal com **escopo**: `admin-geral` (plataforma), `gestor-unidade` (uma unidade), `gestor-modulo` (um módulo), `auditor-plataforma`, `auditor-modulo`. Papéis se acumulam, com exceções (seção 3). |
| **Módulo** | Uma área funcional da plataforma — na base, cada **zona**. O próprio módulo **declara** as funcionalidades (manifesto); a gestão de acesso só as distribui. |
| **Categoria do módulo** | `direto` (o gestor da unidade concede e vale na hora, com o perfil padrão) ou `validado` (o gestor da unidade **solicita** e o gestor do módulo **valida**, pessoa a pessoa). |
| **Perfil de módulo** | Conjunto de funcionalidades do módulo (`zona2.operador` = ver e concluir tarefas). |
| **Acesso** | Pessoa × módulo × perfil, com situação `pendente`, `ativo`, `recusado` ou `revogado`. |
| **Evento** | Registro de toda mudança; é a trilha de auditoria e o aviso para encerrar sessões. |

## 2. Acesso efetivo: tudo precisa valer ao mesmo tempo

Uma pessoa usa uma funcionalidade de um módulo **só se todas** estas condições valem agora; basta uma
falhar para negar, e a resposta diz qual (`POST /v2/decisoes`, `GET /v2/eu`):

1. a pessoa está `ativo` (nem `cadastrado` sem primeiro acesso, nem `suspenso`, `inativo` ou `desligado`);
2. a unidade dela está ativa e, se tiver convênio, dentro da vigência;
3. existe acesso `ativo` ao módulo;
4. o perfil desse acesso contém a funcionalidade.

**Nenhum papel administrativo entra nessa conta.** O administrador geral administra, mas só usa um módulo
se tiver acesso a ele como qualquer pessoa. Motivo: quem controla o acesso não deve ter, por isso, acesso
ao conteúdo; o erro possível de configuração fica sendo "acesso a menos", nunca "acesso a mais".

## 3. Regras de segregação (o que nunca se acumula)

| Regra | Por quê |
|---|---|
| Administração e auditoria não se acumulam na mesma pessoa | quem é fiscalizado não se fiscaliza |
| Ninguém atribui papel a si mesmo, nem retira o próprio | evita escalada silenciosa de privilégio |
| Só o administrador geral atribui papéis; gestor de unidade não cria outros gestores | o alcance de cada gestor fica sob controle central |
| Quem solicitou um acesso não o valida, e ninguém valida o próprio | a validação só tem valor se for de outra pessoa |
| Recusa de acesso exige justificativa | a decisão fica explicável e auditável |
| Mudar a categoria de um módulo exige justificativa, e só o administrador geral muda | tornar um módulo `direto` amplia o acesso de muita gente de uma vez |

## 4. Decisões de desenho (e o motivo de cada uma)

| Decisão | Motivo |
|---|---|
| **Módulo novo nasce `validado`** | se ninguém classificar, o módulo fica fechado; o erro por esquecimento é o conservador |
| **Unidade nasce de gestão exclusiva; a unidade-pai é só estrutura** | um gestor da unidade de cima não passa a gerir a de baixo por tabela; quem precisa de duas unidades recebe papel nas duas, de forma nominal e auditável |
| **Mínimo de dois gestores por unidade e por módulo validado** | cobre férias e ausências; o painel mostra `GESTORES_INSUFICIENTES` quando falta |
| **CPF único e imutável; um vínculo ativo por vez; histórico com datas** | a identidade não muda quando mudam unidade, nome de unidade ou padrão de e-mail |
| **Mudança de unidade cancela os acessos anteriores** (não transfere) | acesso é concedido para uma função numa unidade; mudou a unidade, a nova gestão decide |
| **Convênio vencido corta o acesso sem ninguém revogar** | revogação que depende de alguém lembrar costuma não acontecer |
| **Desligamento revoga tudo e publica evento para encerrar as sessões abertas** | impedir novos logins não basta; quem já está dentro tem de sair |
| **Confirmação periódica: quem o gestor não confirma fica suspenso** | substitui um aviso automático de desligamento quando não há fonte oficial dele |
| **Sem busca geral de pessoas** | a lista é sempre de uma unidade que quem pergunta administra; a única consulta ampla é "este CPF ou e-mail já tem conta?", no cadastro |
| **Primeiro acesso casa o CPF verificado pelo provedor de identidade com um pré-cadastro** | ninguém se cadastra sozinho; CPF sem pré-cadastro recebe a mesma resposta que qualquer recusa (não revela se o CPF existe) e a tentativa vira evento |
| **Contato íntegro com o segundo fator** | o e-mail funcional precisa ser o mesmo do provedor de segundo fator, senão o código não chega; o painel mostra a divergência antes de a pessoa tentar entrar |
| **Administrador geral agindo numa unidade parceira fica marcado como exceção** | a administração central pode atuar em emergência, mas o ato fica visível na auditoria |
| **Auditoria somente leitura; auditor de módulo vê só o próprio módulo** | quem audita não altera |

## 5. Onde cada coisa mora (e o que não vai para o provedor de identidade)

- **Provedor de identidade** (Keycloak no showcase): autentica, aplica segundo fator e sessão única, e chama
  `POST /v2/primeiro-acesso` para casar a identidade com o pré-cadastro.
- **Gestão de acesso v2**: unidades, pessoas, vínculos, papéis, módulos, acessos, validação, painel, auditoria.
  Mapa de funcionalidades, fluxo de validação, histórico e categoria dos módulos **não** vão para o provedor
  de identidade: são modelo da plataforma; o provedor autentica e carrega atributos.
- **BFF de cada zona**: pergunta `GET /v2/eu` (módulos e funcionalidades da pessoa) e esconde o que ela não pode.
- **Domínios**: decidem o dado; quando precisam da regra de acesso, perguntam `POST /v2/decisoes`.
- **Shell**: consome `GET /v2/eventos` para encerrar a sessão de quem foi desligado ou suspenso.

Como a base passa a usar a v2 (núcleo, BFFs, zonas, domínios e shell) é o item **G** do plano
(`.agents/orchestrator/RETOMADA.md`), a decidir com o `arquiteto-mfe` e registrar em ADR.

## 6. O que fica em aberto (configurável ou a decidir por quem adotar)

- Prazos: validade do pré-cadastro sem primeiro acesso, inatividade até suspensão, intervalo da confirmação periódica.
- Ambientes de trabalho colaborativo com recorte de funcionalidades (o ambiente **só restringe**, nunca amplia).
- Reconhecimento de dispositivo e rede confiáveis para dispensar o segundo fator.
- Prazo de retenção da auditoria e do histórico.
