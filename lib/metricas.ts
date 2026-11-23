import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'
import { prisma } from '@/lib/prisma'

/**
 * Métricas no formato do Prometheus, expostas em /api/metrics (protegida por METRICS_TOKEN)
 * e coletadas pelo Prometheus do docker-compose (perfil "observabilidade").
 *
 * O registry fica em globalThis (como o PrismaClient em lib/prisma.ts) para não ser
 * registrado de novo a cada recarga do `next dev`, o que geraria erro de métrica duplicada.
 */
/**
 * Atualiza um gauge com uma contagem do banco. Se o banco falhar, a métrica fica sem
 * valor nesta coleta (NaN) em vez de derrubar o /api/metrics inteiro: a queda do banco
 * aparece no /api/health e no alerta, e as demais métricas continuam chegando.
 */
async function medirDoBanco(gauge: Gauge, contar: () => Promise<number>) {
  try {
    gauge.set(await contar())
  } catch {
    gauge.set(Number.NaN)
  }
}

function criarMetricas() {
  const registry = new Registry()
  registry.setDefaultLabels({ app: 'fredda-app' })
  collectDefaultMetrics({ register: registry, prefix: 'fredda_node_' })

  return {
    registry,

    pedidos: new Counter({
      name: 'fredda_pedidos_total',
      help: 'Pedidos criados e mudanças de status, por canal e status de destino',
      labelNames: ['canal', 'status'] as const,
      registers: [registry],
    }),

    chatbotMensagens: new Counter({
      name: 'fredda_chatbot_mensagens_total',
      help: 'Mensagens de clientes atendidas, por quem respondeu (fluxo guiado, IA ou menu de novo)',
      labelNames: ['origem'] as const,
      registers: [registry],
    }),

    chatbotIaDuracao: new Histogram({
      name: 'fredda_chatbot_ia_duracao_seconds',
      help: 'Tempo de resposta da IA (Claude) no atendimento',
      buckets: [0.5, 1, 2, 4, 8, 15, 30, 60],
      registers: [registry],
    }),

    chatbotIaErros: new Counter({
      name: 'fredda_chatbot_ia_erros_total',
      help: 'Falhas ao gerar resposta com a IA, por tipo',
      labelNames: ['tipo'] as const,
      registers: [registry],
    }),

    previsaoRequisicoes: new Counter({
      name: 'fredda_previsao_requisicoes_total',
      help: 'Chamadas ao microsserviço de previsão de demanda, por rota e resultado',
      labelNames: ['rota', 'resultado'] as const,
      registers: [registry],
    }),

    webhookRequisicoes: new Counter({
      name: 'fredda_webhook_requisicoes_total',
      help: 'Requisições recebidas nos webhooks do WhatsApp, por provedor e resultado',
      labelNames: ['provedor', 'resultado'] as const,
      registers: [registry],
    }),

    // Calculadas na hora da coleta, direto do banco
    pedidosPendentes: new Gauge({
      name: 'fredda_pedidos_pendentes',
      help: 'Pedidos aguardando confirmação da equipe',
      registers: [registry],
      async collect() {
        await medirDoBanco(this, () => prisma.pedido.count({ where: { status: 'PENDENTE' } }))
      },
    }),

    insumosAbaixoMinimo: new Gauge({
      name: 'fredda_insumos_abaixo_minimo',
      help: 'Insumos ativos com estoque abaixo do mínimo',
      registers: [registry],
      async collect() {
        await medirDoBanco(this, () => prisma.insumo.count({
          where: { ativo: true, estoqueAtual: { lt: prisma.insumo.fields.estoqueMinimo } },
        }))
      },
    }),
  }
}

type Metricas = ReturnType<typeof criarMetricas>

const globalParaMetricas = globalThis as unknown as { metricas: Metricas | undefined }

export const metricas = globalParaMetricas.metricas ?? criarMetricas()
globalParaMetricas.metricas = metricas
