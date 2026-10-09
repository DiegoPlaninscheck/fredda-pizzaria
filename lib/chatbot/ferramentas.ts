import * as z from 'zod/v4'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool'
import { prisma } from '@/lib/prisma'
import { FORMAS_PAGAMENTO_CLIENTE, MAX_UNIDADES_POR_PEDIDO } from '@/lib/constantes'
import { cancelarPedido, criarPedido, formatarMoeda, PedidoError, ROTULO_STATUS } from '@/lib/pedidos'

export interface ContextoFerramentas {
  clienteId: string
  conversaId: string
}

const json = (dados: unknown) => JSON.stringify(dados)
const erro = (mensagem: string) => json({ erro: mensagem })

/**
 * Ferramentas do chatbot. O cliente e a conversa vêm do servidor (telefone do
 * WhatsApp), nunca do modelo — assim uma mensagem maliciosa não consegue
 * ler ou alterar pedidos de outra pessoa.
 */
export function criarFerramentas({ clienteId, conversaId }: ContextoFerramentas) {
  const verCardapio = betaZodTool({
    name: 'ver_cardapio',
    description:
      'Lista os sabores à venda com id, descrição, preço unitário e quantas unidades estão disponíveis agora. ' +
      'Use sempre antes de falar de preços ou disponibilidade e para obter os ids usados em criar_pedido.',
    inputSchema: z.object({}),
    run: async () => {
      const receitas = await prisma.receita.findMany({
        where: { ativo: true, precoVenda: { not: null } },
        orderBy: { nome: 'asc' },
      })
      return json(
        receitas.map((r) => ({
          id: r.id,
          sabor: r.nome,
          descricao: r.descricao,
          preco: formatarMoeda(r.precoVenda!),
          disponivel: Math.floor(Number(r.estoqueAtual)),
        }))
      )
    },
  })

  const obterCliente = betaZodTool({
    name: 'obter_cliente',
    description: 'Retorna o nome e o endereço salvos deste cliente (podem estar vazios se for o primeiro pedido).',
    inputSchema: z.object({}),
    run: async () => {
      const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } })
      return json({ nome: cliente.nome, endereco: cliente.endereco })
    },
  })

  const salvarCliente = betaZodTool({
    name: 'salvar_cliente',
    description: 'Salva o nome e, opcionalmente, o endereço de entrega do cliente para este e os próximos pedidos.',
    inputSchema: z.object({
      nome: z.string().min(2).describe('Nome do cliente'),
      endereco: z.string().optional().describe('Endereço completo: rua, número, complemento, bairro e cidade'),
    }),
    run: async ({ nome, endereco }) => {
      await prisma.cliente.update({
        where: { id: clienteId },
        data: { nome: nome.trim(), endereco: endereco?.trim() || undefined },
      })
      return json({ ok: true })
    },
  })

  const criarPedidoTool = betaZodTool({
    name: 'criar_pedido',
    description:
      'Registra o pedido e reserva as pizzas no estoque. Só use depois de mostrar o resumo ao cliente e ele concordar. ' +
      'O preço é sempre o do cardápio. Retorna o número do pedido e o total.',
    inputSchema: z.object({
      itens: z
        .array(
          z.object({
            receitaId: z.string().describe('id do sabor, vindo de ver_cardapio'),
            quantidade: z.number().int().min(1),
          })
        )
        .min(1),
      tipoEntrega: z.enum(['RETIRADA', 'ENTREGA']),
      endereco: z.string().optional().describe('Endereço de entrega; se omitido, usa o endereço salvo do cliente'),
      formaPagamento: z.enum(FORMAS_PAGAMENTO_CLIENTE),
      dataEntregaDesejada: z.string().optional().describe('Data desejada no formato AAAA-MM-DD, se o cliente informou'),
      observacoes: z.string().optional(),
    }),
    run: async (input) => {
      const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } })
      if (!cliente.nome) return erro('Nome do cliente não informado. Pergunte o nome e salve com salvar_cliente.')

      const totalUnidades = input.itens.reduce((t, i) => t + i.quantidade, 0)
      if (totalUnidades > MAX_UNIDADES_POR_PEDIDO) {
        return erro(`Pedidos acima de ${MAX_UNIDADES_POR_PEDIDO} unidades precisam ser feitos com um atendente.`)
      }

      let dataEntregaDesejada: Date | null = null
      if (input.dataEntregaDesejada) {
        dataEntregaDesejada = new Date(`${input.dataEntregaDesejada}T12:00:00`)
        if (isNaN(dataEntregaDesejada.getTime())) return erro('Data inválida, use AAAA-MM-DD.')
      }

      try {
        const pedido = await criarPedido({
          clienteId,
          conversaId,
          itens: input.itens,
          tipoEntrega: input.tipoEntrega,
          enderecoEntrega: input.endereco || cliente.endereco,
          formaPagamento: input.formaPagamento,
          dataEntregaDesejada,
          observacoes: input.observacoes,
        })
        return json({
          numero: pedido.id,
          itens: pedido.itens.map((i) => ({ sabor: i.receita.nome, quantidade: Number(i.quantidade) })),
          total: formatarMoeda(pedido.valorTotal),
          status: ROTULO_STATUS[pedido.status],
        })
      } catch (e) {
        if (e instanceof PedidoError) return erro(e.message)
        throw e
      }
    },
  })

  const meusPedidos = betaZodTool({
    name: 'meus_pedidos',
    description: 'Lista os 5 pedidos mais recentes deste cliente com número, data, itens, total e status.',
    inputSchema: z.object({}),
    run: async () => {
      const pedidos = await prisma.pedido.findMany({
        where: { clienteId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { itens: { include: { receita: { select: { nome: true } } } } },
      })
      return json(
        pedidos.map((p) => ({
          numero: p.id,
          data: p.createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          itens: p.itens.map((i) => `${Number(i.quantidade)}x ${i.receita.nome}`),
          total: formatarMoeda(p.valorTotal),
          status: ROTULO_STATUS[p.status],
        }))
      )
    },
  })

  const cancelarPedidoTool = betaZodTool({
    name: 'cancelar_pedido',
    description:
      'Cancela um pedido deste cliente que ainda está aguardando confirmação. Confirme com o cliente antes de usar.',
    inputSchema: z.object({ numero: z.number().int().describe('Número do pedido') }),
    run: async ({ numero }) => {
      const pedido = await prisma.pedido.findFirst({ where: { id: numero, clienteId } })
      if (!pedido) return erro(`Pedido #${numero} não encontrado para este cliente.`)
      if (pedido.status !== 'PENDENTE') {
        return erro(`Pedido #${numero} está ${ROTULO_STATUS[pedido.status].toLowerCase()} e não pode ser cancelado por aqui. Chame um atendente.`)
      }
      try {
        await cancelarPedido(numero, { apenasPendente: true })
        return json({ ok: true, numero })
      } catch (e) {
        if (e instanceof PedidoError) return erro(e.message)
        throw e
      }
    },
  })

  const chamarAtendente = betaZodTool({
    name: 'chamar_atendente',
    description:
      'Passa a conversa para uma pessoa da equipe. Depois disso o atendimento automático fica pausado até a equipe devolver.',
    inputSchema: z.object({ motivo: z.string().describe('Resumo curto do que o cliente precisa') }),
    run: async ({ motivo }) => {
      await prisma.conversa.update({ where: { id: conversaId }, data: { status: 'HUMANO' } })
      console.info(`[chatbot] conversa ${conversaId} encaminhada para atendente: ${motivo}`)
      return json({ ok: true })
    },
  })

  const ferramentas: BetaRunnableTool[] = [
    verCardapio, obterCliente, salvarCliente, criarPedidoTool, meusPedidos, cancelarPedidoTool, chamarAtendente,
  ]
  return ferramentas.map(paraStrict)
}

/**
 * Ativa o `strict` (o modelo sempre gera argumentos válidos pelo schema).
 * Restrições que o modo strict não aceita (ex.: `minimum`) viram texto na
 * descrição; o Zod continua validando tudo quando a ferramenta é executada.
 */
function paraStrict(tool: BetaRunnableTool): BetaRunnableTool {
  if (!('input_schema' in tool) || tool.type !== 'custom') return tool
  return { ...tool, input_schema: limparSchema(tool.input_schema) as typeof tool.input_schema, strict: true }
}

const RESTRICOES_SEM_SUPORTE = [
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minLength', 'maxLength', 'pattern', 'maxItems', 'uniqueItems',
]

// O `transformJSONSchema` do SDK também remove `enum`, que o modo strict aceita —
// por isso esta versão própria, que só tira o que realmente não é suportado.
function limparSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema
  const { $schema: _ignorado, ...resto } = schema as Record<string, unknown>

  const limpo: Record<string, unknown> = {}
  const notas: string[] = []
  for (const [chave, valor] of Object.entries(resto)) {
    if (RESTRICOES_SEM_SUPORTE.includes(chave) || (chave === 'minItems' && Number(valor) > 1)) {
      // .int() do Zod gera limites de inteiro seguro, que não dizem nada ao modelo
      if (Math.abs(Number(valor)) !== Number.MAX_SAFE_INTEGER) notas.push(`${chave}: ${JSON.stringify(valor)}`)
    } else if (chave === 'properties' || chave === '$defs') {
      limpo[chave] = Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([nome, sub]) => [nome, limparSchema(sub)])
      )
    } else if (chave === 'items') {
      limpo[chave] = limparSchema(valor)
    } else if (chave === 'anyOf' || chave === 'allOf') {
      limpo[chave] = (valor as unknown[]).map(limparSchema)
    } else {
      limpo[chave] = valor
    }
  }

  if (limpo.type === 'object') limpo.additionalProperties = false
  if (notas.length) limpo.description = [limpo.description, `(${notas.join(', ')})`].filter(Boolean).join(' ')
  return limpo
}
