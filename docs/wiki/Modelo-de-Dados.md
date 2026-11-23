# Modelo de Dados

Banco relacional MySQL 8, acessado pelo Prisma. A definição completa está em [`prisma/schema.prisma`](https://github.com/DiegoPlaninscheck/fredda-pizzaria/blob/main/prisma/schema.prisma), e o histórico de mudanças, em `prisma/migrations/`. São 20 models em quatro áreas.

```mermaid
erDiagram
    User ||--o{ MovimentacaoEstoque : registra
    User ||--o{ OrdemProducao : cria
    User ||--o{ Venda : registra
    User ||--o{ PlanoProducao : salva

    Categoria ||--o{ Insumo : agrupa
    Fornecedor |o--o{ Insumo : fornece
    Fornecedor |o--o{ MovimentacaoEstoque : "origem da entrada"
    Insumo ||--o{ MovimentacaoEstoque : movimenta
    Insumo ||--o{ ReceitaInsumo : "compõe"

    Receita ||--o{ ReceitaInsumo : "ficha técnica"
    Receita ||--o{ OrdemReceita : "produzida em"
    Receita ||--o{ Venda : "vendida em"
    Receita ||--o{ PedidoItem : "pedida em"
    Receita ||--o{ PlanoProducaoItem : "planejada em"

    OrdemProducao ||--o{ OrdemReceita : contém
    OrdemProducao ||--o{ EtapaFermentacao : "passa por"
    OrdemProducao |o--o{ MovimentacaoEstoque : "baixa/estorna"
    EtapaFermentacao ||--o{ RegistroCondicoes : registra

    Cliente ||--o{ Pedido : faz
    Cliente ||--o{ Conversa : conversa
    Conversa ||--o{ MensagemWhatsApp : contém
    Conversa |o--o{ Pedido : origina
    Pedido ||--o{ PedidoItem : contém
    Pedido |o--o{ Venda : "gera ao confirmar"

    PlanoProducao ||--o{ PlanoProducaoItem : contém

    User {
        string id PK
        string email UK
        string senha "bcrypt"
        enum role "ADMIN | OPERADOR"
        bool ativo
    }
    Insumo {
        string id PK
        string nome
        string unidade
        decimal estoqueAtual
        decimal estoqueMinimo
        decimal precoUnitario
    }
    MovimentacaoEstoque {
        string id PK
        enum tipo "ENTRADA | SAIDA"
        decimal quantidade
        string lote
        datetime dataVencimento
    }
    Receita {
        string id PK
        string nome
        decimal rendimento
        decimal estoqueAtual "produto pronto"
        decimal precoVenda "cardápio"
        bool ativo
    }
    OrdemProducao {
        string id PK
        enum status "PLANEJADA | EM_ANDAMENTO | PAUSADA | CONCLUIDA | CANCELADA"
        datetime dataPrevista
    }
    EtapaFermentacao {
        string id PK
        enum nome "MISTURA ... CONGELAMENTO"
        int ordem
        enum status
        int duracaoMinutos
        int minutosDecorridos
    }
    RegistroCondicoes {
        string id PK
        decimal temperatura
        decimal umidade
    }
    Venda {
        string id PK
        decimal quantidade
        decimal valorTotal
        string formaPagamento
        bool pago
        bool entregue
    }
    Cliente {
        string id PK
        string telefone UK "wa_id"
        string nome
        string endereco
    }
    Pedido {
        int id PK "número do pedido"
        enum status "PENDENTE | CONFIRMADO | ENTREGUE | CANCELADO"
        enum canal "WHATSAPP | MANUAL"
        enum tipoEntrega "RETIRADA | ENTREGA"
        decimal valorTotal
    }
    Conversa {
        string id PK
        enum status "BOT | HUMANO | ENCERRADA"
        json historico "mensagens da IA"
        json estadoFluxo "etapa e carrinho"
    }
    MensagemWhatsApp {
        string id PK
        string waMessageId UK "evita reprocessar reenvios"
        enum direcao
    }
    PlanoProducao {
        string id PK
        date semana UK "segunda-feira"
        string modeloAtivo
    }
    PlanoProducaoItem {
        string id PK
        decimal previsao
        decimal limiteInferior
        decimal limiteSuperior
        decimal sugerido
        decimal planejado
    }
```

## Regras de integridade importantes

| Regra | Como é garantida |
|---|---|
| Estoque (de insumo e de produto pronto) nunca negativo | `updateMany` com condição `estoqueAtual >= quantidade` dentro da transação (`lib/estoque.ts`); se nenhuma linha é afetada, a operação é desfeita |
| Pedido/ordem não muda de status duas vezes | O UPDATE filtra pelo status esperado (`transicionar()` em `lib/pedidos.ts`, `finalizar()` em `lib/ordens.ts`) |
| Mensagem do WhatsApp processada uma única vez | `MensagemWhatsApp.waMessageId` é único; o reenvio da Meta cai na violação de unicidade e é ignorado |
| Preço do pedido congelado no momento da compra | `PedidoItem.precoUnitario` copia o `precoVenda` atual; mudanças no cardápio não alteram pedidos antigos |
| Um plano por semana | `PlanoProducao.semana` é único (sempre a segunda-feira, no horário de Brasília) |
| Ingrediente aparece uma vez por receita | `unique(receitaId, insumoId)` em `ReceitaInsumo`; o mesmo vale para `OrdemReceita` |
| Exclusão lógica | Cadastros usam `ativo = false` em vez de apagar, preservando o histórico de vendas e produção |
