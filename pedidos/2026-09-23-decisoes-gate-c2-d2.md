# Decisões pendentes: critério do gate, fase C2 e medição do D2

**Estado:** respondido em 2026-09-23 · **Quem respondeu:** humano responsável pela base.
**Aberto em:** 2026-09-23

Este documento reúne três decisões que só o humano pode tomar. Cada uma vem com o contexto
necessário para decidir sem ler o resto do repositório, as opções, o que acontece em cada uma
e a recomendação. A resposta vai no fim (§5), num formato curto.

---

## 1. Contexto em uma página

A base é uma aplicação dividida em **zonas** (cada módulo de negócio é uma aplicação Next.js
independente) atrás de um **shell** (a porta de entrada: o navegador só fala com ele). Cada zona
é também um **BFF**: o servidor dela fala com os domínios em nome do usuário, e o navegador
nunca recebe credencial.

O trabalho é conduzido em **fatias**. Cada fatia passa por um **gate** com três verificadores
independentes:

| Verificador | O que faz | Pode reprovar? |
|---|---|---|
| **Revisor** | lê o código contra as regras (invariantes) do `AGENTS.md` | sim |
| **Challenger** | sobe a base de verdade e a ataca como um usuário mal-intencionado | sim |
| **Auditor forense** | **muda o código de propósito** (mutação) e vê se algum teste percebe; se nenhum percebe, o teste "não tem dentes" | sim, com **veto**: basta ele reprovar |

O gate atual cobre a sessão no Redis, o kit comum das zonas e a gestão de acesso v2. Ele já
rodou quatro vezes:

| Iteração | Revisor | Challenger | Auditor | Mutações que os testes **não** pegaram |
|---|---|---|---|---|
| 2 | — | — | reprovou (V1–V8) | — |
| 3 | aprovou | aprovou | reprovou (V1–V7) | 55 de 127 |
| 4 | aprovou | aprovou | reprovou (V1–V5) | 55 de 127 |

Entre a 3 e a 4, a fatia **K2** corrigiu todos os vetos da iteração 3. O auditor da 4 confirmou:
tudo o que tinha sobrevivido antes agora é pego. Mesmo assim ele achou **cinco problemas novos**.

---

## 2. Decisão A — o que deve reprovar o gate daqui para frente

### 2.1 O que o auditor achou na iteração 4

| # | Em palavras simples | É o quê |
|---|---|---|
| **V1** | A zona **recebe** no ambiente a senha de escrita do Redis (onde ficam as sessões), mesmo sem usá-la. Um código malicioso na zona usou essa senha para gravar uma sessão falsa de uma administradora e entrou como ela. Todos os 88 testes passaram. | **Defeito real de configuração.** A zona nunca deveria ter essa senha. |
| **V3** | A regra que impede mandar dado sensível para o navegador aceita `x.campo` sem saber se o valor é um texto ou um objeto inteiro. `extra={envio.lista}` levou o custo interno de um recurso até o HTML. | **Erro plausível de quem escreve a tela**: qualquer um pode achar que `envio.lista` é um texto. |
| **V5** | No arquivo de configuração do Next, escrever `config.env = {...}` (atribuição, em vez de declarar dentro do objeto) colocou um endereço interno no JavaScript entregue ao navegador. | **Erro plausível.** |
| **V2** | Uma função nova que só "embrulha" a função que grava sessão escapa do teste que proíbe as zonas de gravar sessão. | **Contorno deliberado**: ninguém escreve isso sem querer burlar. |
| **V4** | Um parâmetro chamado `fetch` numa função esconde o `fetch` real do analisador de saída de rede; pastas `test/` dentro de `lib/` não são varridas; um cliente WebSocket interno do Next estava liberado. | **Contorno deliberado** (em parte, bem fácil de fechar). |

Além disso, cinco **lacunas sem veto**. A mais relevante: o teste do `If-Match` prova que o valor
não está fixo em "1", mas um valor fixo em "3" (a versão atual da semente) passaria.

### 2.2 O problema de fundo

Os verificadores que o auditor ataca são **analisadores estáticos**: leem o código-fonte procurando
padrões proibidos (mandar objeto para o navegador, abrir conexão de rede por fora, gravar sessão fora
do shell). Um analisador estático **nunca pega todo contorno feito de propósito**. Sempre existe outro
jeito de escrever a mesma coisa (um apelido, uma função intermediária, um nome montado em tempo de
execução). Cada iteração fecha os contornos da anterior, e o auditor acha os seguintes. É por isso que
o número de sobreviventes não cai: **55 e 55**.

A pergunta que decide o critério é: **contra quem esses analisadores protegem?**

| Ameaça | Defesa certa | Os analisadores servem? |
|---|---|---|
| **Erro de quem escreve de boa-fé** (passar um objeto achando que é texto, esquecer um import) | analisador estático + teste ponta a ponta | **sim**, é exatamente para isso |
| **Alguém burlando de propósito** (código malicioso dentro de uma zona) | barreiras no ambiente: a zona **não recebe** a credencial, a rede de produção **bloqueia** saída não autorizada | **não resolvem**: fechar um contorno só adia o próximo |

### 2.3 As opções

| Opção | O que acontece |
|---|---|
| **A1. Manter o critério atual** (qualquer mutação ou contorno sobrevivente é veto) | Faço a K3 com todos os cinco vetos. A iteração 5 provavelmente reprova por outro contorno. O gate não fecha em prazo previsível, e as fases seguintes (login pelo Keycloak, tempo real, showcase) esperam. |
| **A2. Mudar o critério** (recomendada) | **Veto** só para (a) defeito de comportamento do produto e (b) erro plausível de boa-fé que passa pelos testes. **Contorno deliberado** de um analisador vira **limite declarado**: registrado, com a defesa real apontada, sem veto. |
| **A3. Encerrar o gate como está** | Registrar os cinco vetos como riscos aceitos e seguir. Não recomendo: V1, V3 e V5 são problemas reais. |

### 2.4 O que a fatia K3 faria com a opção A2

1. **Corrigir de verdade V1, V3 e V5:**
   - **V1:** a zona deixa de receber `REDIS_URL` (a senha de escrita) em qualquer ambiente: script de
     subida, showcase e Taskfile. Um teste lê o ambiente de cada processo de zona e exige que a variável
     não esteja lá. Isso é uma **barreira**, não um analisador: sem a senha, não há o que burlar.
   - **V3:** a regra passa a usar o **verificador de tipos do TypeScript**: prop enviada ao navegador
     precisa ter tipo escalar (texto, número, booleano). O ponta a ponta passa a procurar o custo interno
     no HTML da zona 1.
   - **V5:** o `next.config` fica fechado (nada de `env` por atribuição, chave calculada ou configuração
     trazida de outro arquivo), e um teste procura endereços internos no JavaScript entregue ao navegador.
2. **Fechar os contornos baratos de V2 e V4** (parâmetro `fetch`, pastas `test/` aninhadas, lista explícita
   dos pacotes do Next permitidos, regra de fronteira para as funções do shell). **Declarar o resto** como
   limite do analisador, apontando a defesa real: a zona sem a credencial e o bloqueio de saída de rede no deploy.
3. **Fechar as lacunas** que custam pouco (N4 concluindo a tarefa com o `If-Match` que a página mandou,
   cache mínimo de zona "fora", `router.push` com variável, `rewrites`/`assetPrefix` com endereço interno).
4. **Iteração 5** com o critério novo escrito no despacho do auditor.

---

## 3. Decisão B — fase C2 (tempo real no shell)

### 3.1 O que é a fase C2

Hoje, se outra pessoa conclui uma tarefa, a sua tela só mostra isso quando você recarrega. O C2
cria o **tempo real**: o servidor **avisa** a tela ("a tarefa t-1 mudou") e a tela se atualiza sozinha.

- **Tecnologia já decidida (ADR-0004):** **SSE**, uma conexão HTTP que fica aberta só para o servidor
  mandar avisos. O aviso é pequeno: `{tipo, id, versão, escopo, motivo}`. A tela decide se busca o dado
  de novo; o aviso nunca carrega o dado.
- **A conexão mora no shell**, em `/api/stream`, e não nas zonas. Ao ir da zona 1 para a zona 2, o
  navegador troca o documento inteiro (é assim que zonas funcionam); uma conexão aberta por uma zona
  morreria a cada navegação.
- Um **`SharedWorker`** (um processo leve do navegador que sobrevive à troca de página) mantém **uma única
  conexão por navegador** e a divide entre abas e zonas. Cada zona só se inscreve nos avisos que lhe
  interessam.

### 3.2 A decisão pendente: quanto tempo o shell espera por uma zona

O navegador fala só com o shell; o shell pede cada página à zona e repassa a resposta, como uma
recepção que encaminha ligações para os ramais.

- Zona **caída** (o processo morreu): o shell percebe em até 1 s e mostra "serviço indisponível". Isso
  já funciona.
- Zona **travada** (atende e não responde): o shell fica esperando. Hoje espera **cerca de 30 segundos**
  e depois mostra um erro 500 cru, sem a página de erro da base. Para o usuário, é uma tela girando
  por meio minuto. Esse é o item **D7** de `.agents/orchestrator/DEFERRED.md`.

A alavanca é a configuração `proxyTimeout` do Next.js: o tempo máximo que o shell espera por **qualquer**
resposta de **qualquer** zona.

| Opção | Zona travada | Custo |
|---|---|---|
| **B1. Baixo — 10 s** (recomendada), em variável de ambiente documentada | vira "indisponível" em ~10 s | nenhuma tela, action ou download de zona pode demorar mais que 10 s. Algo pesado (um relatório grande) vira **pedido assíncrono**: "pedir" agora e "baixar quando ficar pronto" |
| **B2. Alto — 30 a 60 s** | o usuário espera até 1 minuto | telas lentas continuam possíveis |
| **B3. Manter o padrão** | continua o 500 cru depois de ~30 s | nenhum |

**Por que só agora:** esse limite corta qualquer resposta longa repassada a uma zona. Enquanto não
estava decidido onde o tempo real moraria, um valor baixo poderia cortar a conexão de avisos. Com ela
no shell, e não repassada a uma zona, o limite passa a valer só para as páginas e ações das zonas.

### 3.3 Três propostas que acompanham o C2

1. **Quem gera avisos no showcase:** um domínio falso emite um aviso quando uma tarefa é concluída. É o
   caso mais simples de demonstrar: duas abas abertas, conclui numa, a outra atualiza.
2. **Mais de um servidor do shell:** se o shell rodar em várias cópias, um aviso nascido numa cópia
   precisa chegar a quem está conectado em outra. Proposta: usar o **Redis pub/sub** (o Redis já existe),
   **mas só quando houver mais de uma cópia**; o showcase roda com uma.
3. **Meta de latência:** o aviso aparece na tela em **até 2 s** (já está no desenho). O teste ponta a ponta
   passa a medir isso.

---

## 4. Decisão C — medições do D2 (login pelo Keycloak)

### 4.1 Contexto

No D2 o login passa a ser feito pelo Keycloak (o provedor de identidade). Ele entrega ao shell:

- um **crachá** (access token), que vale **5 minutos**;
- um **vale-renovação** (refresh token), que troca o crachá vencido por um novo. Por segurança, cada vale
  **só pode ser usado uma vez**: ao usar, vem outro no lugar.

O shell troca o crachá sozinho, pouco antes de vencer, e só uma requisição por vez faz a troca (um
**lock** no Redis). O ADR-0013, aceito, descreve isso.

### 4.2 Medição 1 — duas renovações ao mesmo tempo (precisa da sua liberação)

Se o usuário tem duas abas e as duas tentam renovar juntas, as duas usam **o mesmo vale**. A primeira
consegue. Não se sabe o que o Keycloak 26 faz com a segunda:

- **cenário bom:** a segunda só é recusada, e o usuário segue logado;
- **cenário ruim:** o Keycloak entende o reuso como **roubo de token** e **encerra a sessão inteira**.

**Por que importa:** no cenário ruim, o lock deixa de ser otimização e vira **requisito de segurança
da experiência**. Uma falha no lock desloga a pessoa, e o teste de corrida precisa ser muito mais
rigoroso. Melhor saber antes de escrever o código.

**Como seria:** um script no `base/showcase/` faz o login da ana, dispara as duas renovações simultâneas
e observa se a sessão sobrevive. **Não instala nada**, leva uns 15 minutos e só fala com o Keycloak do
showcase, que já está no ar. Não conflita com nenhum verificador: o gate não usa o Keycloak.

**Opções:** rodar **agora** (enquanto a K3 é feita) ou **no início do D2**.

### 4.3 Medição 2 — identificador fixo dos usuários (só informativo; não precisa de decisão)

A gestão de acesso reconhece a pessoa pelo identificador (`sub`) que o Keycloak dá a ela. Hoje o realm
não fixa esse identificador; o Keycloak inventa um novo a cada vez que é recriado, e a ligação com os
dados de teste quebra. A medição importa o realm com identificadores fixos e vê se o Keycloak aceita um
identificador legível (como `ana`) ou exige UUID; se exigir, usamos UUIDs fixos. Precisa recriar o
container do Keycloak, então roda **no início do D2**, com nenhum outro trabalho usando o Keycloak.

---

## 5. Resposta

Preencha as três linhas (basta a letra e o número; comentários são bem-vindos):

```
A (critério do gate): A1 / A2 / A3      comentário:
B (fase C2):          B1 (valor: __ s) / B2 / B3 · propostas 1-3: ok / ajustes:
C (medição 1 do D2):  agora / no início do D2
```

**Recomendação do agente:** `A2`, `B1 (10 s)` com as três propostas, `C agora`.

### Resposta do humano

```
A (critério do gate): A2 (veto para defeito de produto ou erro plausível de boa-fé; contorno deliberado vira limite declarado)
B (fase C2):          B1 (valor: 10 s) · propostas 1-3: ok
C (medição 1 do D2):  agora (verificar tolerância a concorrência de refresh token no Keycloak vs lock de enfileiramento no shell)
```
