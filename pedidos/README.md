# Pedidos

Pedidos de elucidação, pesquisa na web ou raciocínio que outra IA pode responder.
O agente escreve o pedido aqui e **para** o processo que depende dele; o humano faz o
pedido, cola a resposta no mesmo arquivo e só então o agente continua.

Um arquivo por pedido: `AAAA-MM-DD-<assunto>.md`, com as seções
**Contexto**, **Pergunta** (autocontida, sem depender deste repositório), **Formato da resposta**
e **Resposta** (vazia até o humano preencher). Estado no topo: `aberto` ou `respondido`.
