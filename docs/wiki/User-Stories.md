# User Stories

As histórias estão agrupadas por persona. Cada uma referencia os [requisitos](Requisitos) que a atendem.

## Personas

| Persona | Quem é | Objetivo principal |
|---|---|---|
| **Administrador** | Dono da pizzaria | Planejar a produção da semana, controlar custos e ter visão do negócio |
| **Operador** | Equipe de cozinha e atendimento | Executar as ordens de produção, registrar vendas e confirmar pedidos |
| **Cliente** | Quem compra pizzas congeladas pelo WhatsApp | Fazer um pedido rápido, a qualquer hora, sem esperar atendimento |

## Administrador

**US01 — Planejar a produção da semana** (RF32–RF34)
> Como administrador, quero ver quantas pizzas de cada sabor devo produzir para uma semana futura, para começar a fermentação no dia certo sem sobrar nem faltar massa.
- A tela mostra, por sabor, a previsão de venda com faixa de 80%, o estoque projetado e a quantidade sugerida.
- Posso planejar pelo limite superior da faixa para reduzir o risco de faltar.
- Posso ajustar o planejado, salvar o plano e gerar a ordem de produção com essas quantidades.
- Se o serviço de previsão estiver fora do ar, a tela avisa e permite planejar à mão.

**US02 — Avaliar se a previsão está acertando** (RF35)
> Como administrador, quero comparar o que foi previsto, planejado, produzido e vendido em cada semana, para saber se posso confiar na sugestão.
- Cada semana com plano salvo mostra previsão, planejado, produzido (ordens concluídas) e vendido.
- Os indicadores mostram o erro médio, a % de vendas dentro da faixa prevista e a % do planejado que foi produzida.

**US03 — Retreinar o modelo** (RF36)
> Como administrador, quero retreinar o modelo com as vendas mais recentes, para que a previsão acompanhe mudanças no cardápio e na demanda.
- Só o ADMIN vê o botão; um segundo treino simultâneo é recusado.

**US04 — Manter o cadastro** (RF03–RF06, RF11)
> Como administrador, quero cadastrar fornecedores, insumos e fichas técnicas e ser o único a excluí-los, para manter os dados confiáveis.
- O CNPJ inválido é recusado.
- O OPERADOR não vê nem consegue chamar as ações de exclusão (a API responde 403).

**US05 — Acompanhar o negócio** (RF37)
> Como administrador, quero um dashboard com faturamento, vendas, produção e alertas de estoque, para decidir o dia a dia sem montar planilhas.

## Operador

**US06 — Produzir um lote com rastreio da fermentação** (RF13–RF18)
> Como operador, quero criar uma ordem com os sabores do dia e acompanhar cada etapa com timer, para não errar o tempo de fermentação.
- A ordem só é criada se houver insumos suficientes; os insumos são baixados na criação.
- As etapas seguem a ordem padrão, e só uma pode estar em andamento.
- Posso pausar uma etapa e registrar temperatura e umidade.
- Ao concluir a ordem, o estoque de pizzas prontas de cada sabor aumenta; ao cancelar, os insumos voltam.

**US07 — Registrar entradas e saídas de insumos** (RF07–RF10)
> Como operador, quero registrar a chegada de insumos com lote e validade, para rastrear o que foi usado em cada produção.
- Uma saída maior que o saldo é recusada.
- Insumos abaixo do mínimo aparecem em destaque.

**US08 — Registrar uma venda de balcão** (RF19, RF20, RF22)
> Como operador, quero registrar a venda informando cliente, sabor, quantidade e pagamento, para que o estoque e o faturamento fiquem corretos.
- A venda é recusada se não houver pizzas prontas suficientes.
- Posso marcar depois como paga e entregue.

**US09 — Confirmar pedidos do WhatsApp** (RF27–RF29)
> Como operador, quero ver os pedidos que chegaram pelo WhatsApp e confirmá-los, para que o cliente saiba que o pedido foi aceito.
- O painel atualiza sozinho e a navegação mostra quantos pedidos estão pendentes.
- Confirmar gera as vendas; entregar marca as vendas como entregues; cancelar devolve o estoque.
- O cliente recebe uma mensagem a cada mudança de status.

**US10 — Atender um cliente que pediu um humano** (RF30)
> Como operador, quero assumir uma conversa do bot e responder pelo painel, para resolver o que o bot não resolve.
- Enquanto a conversa está com a equipe, o bot fica em silêncio; ao devolver, o bot volta a atender.

**US11 — Testar o atendimento sem WhatsApp** (RF31)
> Como operador, quero simular um cliente no painel, para treinar a equipe e testar o cardápio sem enviar mensagens reais.

## Cliente

**US12 — Fazer um pedido pelo WhatsApp** (RF24, RF27)
> Como cliente, quero escolher sabores e quantidades tocando em botões, para pedir sem precisar digitar.
- Só aparecem sabores com preço e estoque disponível.
- No primeiro pedido o nome é pedido; nos seguintes, o último endereço é oferecido.
- No fim vejo o resumo com o total e confirmo.

**US13 — Tirar uma dúvida no meio do pedido** (RF25)
> Como cliente, quero escrever perguntas livres ("vocês entregam em Blumenau?") sem perder o carrinho, para não começar de novo.
- A IA responde com base nas regras da pizzaria e oferece "Continuar pedido".
- Se não souber a resposta, chama um atendente em vez de inventar.
- Sem IA disponível, o menu repete as opções da etapa atual.

**US14 — Acompanhar e cancelar meu pedido** (RF26, RF29)
> Como cliente, quero ver o status dos meus pedidos e cancelar um que ainda não foi confirmado.
- Só vejo os pedidos do meu telefone.
- Depois de confirmado, o cancelamento só pode ser feito pela equipe.
