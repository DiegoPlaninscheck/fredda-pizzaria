// Rótulos e formatação usados nas telas de pedidos (sem dependência do Prisma,
// para poder ser importado em Client Components).

export const STATUS_PEDIDO_LABEL: Record<string, string> = {
  PENDENTE: 'Aguardando confirmação',
  CONFIRMADO: 'Confirmado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

export const STATUS_PEDIDO_STYLE: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-900',
  CONFIRMADO: 'bg-brand-50 text-brand-700',
  ENTREGUE: 'bg-brand-900 text-creme-100',
  CANCELADO: 'bg-red-50 text-red-700',
}

/**
 * Complemento do aviso depois de mudar o status, conforme o resultado da
 * notificação do cliente (campo `notificacao` do PATCH /api/pedidos/[id]).
 */
export const AVISO_NOTIFICACAO: Record<string, string> = {
  enviada: 'O cliente foi avisado no WhatsApp.',
  nao_aplicavel: '',
  nao_configurado: 'O WhatsApp não está configurado neste ambiente: o aviso ficou só registrado na conversa.',
  fora_da_janela: 'O cliente não foi avisado: já se passaram mais de 24h desde a última mensagem dele.',
  sem_conversa: 'O cliente não tem conversa no WhatsApp para ser avisado.',
  erro: 'Houve um erro ao avisar o cliente pelo WhatsApp. Veja os logs do servidor.',
}

/** Resultados em que não há nada para a equipe resolver. */
export const NOTIFICACAO_OK = ['enviada', 'nao_aplicavel']

/** 5547999998888 → (47) 99999-8888; outros países ficam no formato internacional. */
export function formatarTelefone(telefone: string) {
  if (telefone.startsWith('000')) return `Simulador ${telefone.slice(3)}`
  const m = telefone.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${telefone}`
}
