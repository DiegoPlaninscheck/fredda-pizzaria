export const FORMAS_PAGAMENTO = ['PIX NA CONTA', 'PIX NA MÁQUINA', 'DINHEIRO', 'DÉBITO', 'CRÉDITO', 'PERMUTA']

/** Formas de pagamento que o cliente pode escolher sozinho no chatbot. */
export const FORMAS_PAGAMENTO_CLIENTE = ['PIX', 'DINHEIRO', 'DÉBITO', 'CRÉDITO'] as const

/** Limite de unidades por pedido feito pelo chatbot (pedidos maiores vão para um atendente). */
export const MAX_UNIDADES_POR_PEDIDO = 30
