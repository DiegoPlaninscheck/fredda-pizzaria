// Rótulos e formatação usados nas telas de pedidos (sem dependência do Prisma,
// para poder ser importado em Client Components).

export const STATUS_PEDIDO_LABEL: Record<string, string> = {
  PENDENTE: 'Aguardando confirmação',
  CONFIRMADO: 'Confirmado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

export const STATUS_PEDIDO_STYLE: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  CONFIRMADO: 'bg-blue-100 text-blue-700',
  ENTREGUE: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-red-100 text-red-700',
}

/** 5547999998888 → (47) 99999-8888; outros países ficam no formato internacional. */
export function formatarTelefone(telefone: string) {
  const m = telefone.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${telefone}`
}
