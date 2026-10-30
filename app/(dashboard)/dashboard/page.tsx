import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarSugestao } from '@/lib/planejamento'
import { adicionarSemanas, intervaloUtc, segundaDaSemana } from '@/lib/semanas'
import GraficoFaturamentoSemanal, { type PontoSemana } from '@/components/dashboard/GraficoFaturamentoSemanal'
import { Card, CardTitulo } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/components/ui/cn'

export const dynamic = 'force-dynamic'

const FUSO = 'America/Sao_Paulo'
const FUSO_HORAS = 3 // Brasil sem horário de verão desde 2019
const SEMANAS_GRAFICO = 12

const moeda = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inteiro = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

/** Meia-noite do dia 1 do mês (horário da pizzaria), deslocado `meses` a partir do mês atual. */
function inicioDoMes(agora: Date, meses = 0) {
  const local = new Date(agora.getTime() - FUSO_HORAS * 3_600_000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + meses, 1, FUSO_HORAS))
}

function saudacao(agora: Date) {
  const hora = Number(agora.toLocaleString('pt-BR', { hour: 'numeric', hour12: false, timeZone: FUSO }))
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
}

/** Variação percentual; null quando não há base de comparação. */
function variacao(atual: number, anterior: number) {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null
}

function Variacao({ valor, base }: { valor: number | null; base: string }) {
  if (valor === null) return <p className="text-xs text-gray-500">sem base em {base}</p>
  const subiu = valor >= 0
  const Icone = subiu ? ArrowUpRight : ArrowDownRight
  return (
    <p className={cn('text-xs font-semibold inline-flex items-center gap-1', subiu ? 'text-brand-700' : 'text-red-700')}>
      <Icone className="w-3.5 h-3.5" aria-hidden="true" />
      {subiu ? '+' : ''}{valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mesmo período de {base}
    </p>
  )
}

const CORES_PAGAMENTO = ['#0f231a', '#3d8563', '#c9a85a', '#e9dcb4', '#8bc4a5', '#b9b096']

/** Previsão da próxima semana; fica num Suspense porque depende do microsserviço de IA. */
async function PrevisaoProximaSemana() {
  const alvo = adicionarSemanas(segundaDaSemana(), 1)
  const sugestao = await gerarSugestao(alvo).catch(() => null)
  const itens = (sugestao?.itens ?? [])
    .filter((i) => i.previsao !== null)
    .sort((a, b) => (b.previsao ?? 0) - (a.previsao ?? 0))
    .slice(0, 6)

  return (
    <Card className="lg:col-span-2">
      <CardTitulo acao={<Link href="/planejamento" className="text-sm font-semibold text-brand-700 hover:text-brand-900">Abrir planejamento →</Link>}>
        Próxima semana · previsão da IA
      </CardTitulo>
      {!sugestao || itens.length === 0 ? (
        <p className="text-sm text-gray-500">
          {sugestao?.aviso ?? 'Previsão indisponível no momento. Confira o microsserviço de IA ou o histórico de vendas.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="py-2 pr-3 font-semibold">Sabor</th>
                <th className="py-2 pr-3 font-semibold">Previsto</th>
                <th className="py-2 pr-3 font-semibold">Estoque projetado</th>
                <th className="py-2 font-semibold">Produzir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efeadb]">
              {itens.map((i) => (
                <tr key={i.receitaId}>
                  <td className="py-2.5 pr-3 font-medium text-gray-900">{i.nome}</td>
                  <td className="py-2.5 pr-3">
                    {inteiro(i.previsao ?? 0)}
                    {i.limiteInferior !== null && i.limiteSuperior !== null && (
                      <span className="text-gray-500"> ({inteiro(i.limiteInferior)}–{inteiro(i.limiteSuperior)})</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">{inteiro(i.estoqueProjetado)}</td>
                  <td className="py-2.5">
                    <span className="font-bold text-brand-900 bg-brand-50 rounded-full px-2.5 py-0.5">{inteiro(i.sugerido)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const agora = new Date()
  const inicioMes = inicioDoMes(agora)
  const inicioMesAnterior = inicioDoMes(agora, -1)
  // Compara o mês até hoje com o mesmo número de dias do mês anterior
  const fimComparacao = new Date(inicioMesAnterior.getTime() + (agora.getTime() - inicioMes.getTime()))
  const semanaAtual = segundaDaSemana(agora)
  const primeiraSemana = adicionarSemanas(semanaAtual, -(SEMANAS_GRAFICO - 1))
  const doMes = { dataVenda: { gte: inicioMes } }

  const [
    mesAtual, mesAnterior, vendasSemanas, porSabor, porPagamento, pedidosWhatsApp, vendasBalcao,
    prontas, pedidosPendentes, conversasAguardando, insumos,
  ] = await Promise.all([
    prisma.venda.aggregate({ where: doMes, _sum: { valorTotal: true, quantidade: true } }),
    prisma.venda.aggregate({
      where: { dataVenda: { gte: inicioMesAnterior, lt: fimComparacao } },
      _sum: { valorTotal: true, quantidade: true },
    }),
    prisma.venda.findMany({
      where: { dataVenda: { gte: intervaloUtc(primeiraSemana).inicio } },
      select: { dataVenda: true, valorTotal: true },
    }),
    prisma.venda.groupBy({
      by: ['receitaId'], where: doMes, _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: 'desc' } }, take: 6,
    }),
    prisma.venda.groupBy({ by: ['formaPagamento'], where: doMes, _sum: { valorTotal: true } }),
    prisma.pedido.count({ where: { createdAt: { gte: inicioMes }, canal: 'WHATSAPP', status: { not: 'CANCELADO' } } }),
    prisma.venda.count({ where: { ...doMes, pedidoId: null } }),
    prisma.receita.aggregate({ where: { ativo: true, precoVenda: { not: null } }, _sum: { estoqueAtual: true }, _count: true }),
    prisma.pedido.count({ where: { status: 'PENDENTE' } }),
    prisma.conversa.count({ where: { status: 'HUMANO' } }),
    prisma.insumo.findMany({
      where: { ativo: true },
      select: { estoqueAtual: true, estoqueMinimo: true, nome: true, unidade: true, id: true },
    }),
  ])

  const faturamento = Number(mesAtual._sum.valorTotal ?? 0)
  const unidades = Number(mesAtual._sum.quantidade ?? 0)
  const faturamentoAnterior = Number(mesAnterior._sum.valorTotal ?? 0)
  const unidadesAnterior = Number(mesAnterior._sum.quantidade ?? 0)
  const ticket = unidades > 0 ? faturamento / unidades : 0
  const ticketAnterior = unidadesAnterior > 0 ? faturamentoAnterior / unidadesAnterior : 0
  const nomeMesAnterior = inicioMesAnterior.toLocaleString('pt-BR', { month: 'long', timeZone: FUSO })
  const nomeMes = inicioMes.toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: FUSO })

  // Faturamento por semana (segunda a domingo, horário da pizzaria)
  const totalPorSemana = new Map<string, number>()
  for (const v of vendasSemanas) {
    const s = segundaDaSemana(v.dataVenda)
    totalPorSemana.set(s, (totalPorSemana.get(s) ?? 0) + Number(v.valorTotal))
  }
  const semanas: PontoSemana[] = Array.from({ length: SEMANAS_GRAFICO }, (_, i) => {
    const semana = adicionarSemanas(primeiraSemana, i)
    const [, m, d] = semana.split('-')
    return { semana, rotulo: `${d}/${m}`, valor: Math.round((totalPorSemana.get(semana) ?? 0) * 100) / 100 }
  })

  const receitas = await prisma.receita.findMany({
    where: { id: { in: porSabor.map((s) => s.receitaId) } },
    select: { id: true, nome: true },
  })
  const sabores = porSabor.map((s) => ({
    nome: receitas.find((r) => r.id === s.receitaId)?.nome ?? '—',
    qtd: Number(s._sum.quantidade ?? 0),
  }))
  const maiorSabor = Math.max(1, ...sabores.map((s) => s.qtd))

  const totalPagamentos = porPagamento.reduce((t, p) => t + Number(p._sum.valorTotal ?? 0), 0)
  const pagamentos = porPagamento
    .map((p) => ({ forma: p.formaPagamento || 'Não informado', valor: Number(p._sum.valorTotal ?? 0) }))
    .sort((a, b) => b.valor - a.valor)
    .map((p, i) => ({ ...p, pct: totalPagamentos > 0 ? (p.valor / totalPagamentos) * 100 : 0, cor: CORES_PAGAMENTO[i % CORES_PAGAMENTO.length] }))

  const alertas = insumos.filter((i) => i.estoqueAtual.lt(i.estoqueMinimo))
  const primeiroNome = session?.user?.name?.split(' ')[0]

  const kpis = [
    { rotulo: 'Faturamento do mês', valor: moeda(faturamento), variacao: variacao(faturamento, faturamentoAnterior), href: '/vendas' },
    { rotulo: 'Pizzas vendidas', valor: inteiro(unidades), variacao: variacao(unidades, unidadesAnterior), href: '/vendas' },
    { rotulo: 'Preço médio por pizza', valor: moeda(ticket), variacao: variacao(ticket, ticketAnterior), href: '/vendas' },
  ]

  return (
    <div className="max-w-7xl">
      <PageHeader
        titulo={`${saudacao(agora)}${primeiroNome ? `, ${primeiroNome}` : ''}`}
        subtitulo={`Resumo de ${nomeMes}`}
        acoes={<Link href="/vendas/nova" className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-brand-900 text-creme-100 hover:bg-brand-800">Nova venda</Link>}
      />

      {(pedidosPendentes > 0 || conversasAguardando > 0) && (
        <Link
          href="/pedidos"
          className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 text-amber-900 hover:border-amber-300"
        >
          <span className="flex items-center gap-2.5 text-sm">
            <Clock className="w-5 h-5 flex-none" aria-hidden="true" />
            <span className="font-semibold">
              {pedidosPendentes > 0 && `${pedidosPendentes} ${pedidosPendentes === 1 ? 'pedido aguardando' : 'pedidos aguardando'} confirmação`}
              {pedidosPendentes > 0 && conversasAguardando > 0 && ' · '}
              {conversasAguardando > 0 && `${conversasAguardando} ${conversasAguardando === 1 ? 'cliente aguardando' : 'clientes aguardando'} atendente`}
            </span>
          </span>
          <span className="text-sm font-semibold">Abrir pedidos →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <Link key={k.rotulo} href={k.href} className="bg-white border border-[#e7e1cf] rounded-2xl p-5 hover:border-brand-200 transition-colors">
            <p className="text-sm text-gray-500">{k.rotulo}</p>
            <p className="font-display text-3xl font-bold text-brand-900 mt-1">{k.valor}</p>
            <div className="mt-2"><Variacao valor={k.variacao} base={nomeMesAnterior} /></div>
          </Link>
        ))}
        <Link href="/receitas" className="bg-white border border-[#e7e1cf] rounded-2xl p-5 hover:border-brand-200 transition-colors">
          <p className="text-sm text-gray-500">Prontas em estoque</p>
          <p className="font-display text-3xl font-bold text-brand-900 mt-1">{inteiro(Number(prontas._sum.estoqueAtual ?? 0))}</p>
          <p className="text-xs text-gray-500 mt-2">{prontas._count} {prontas._count === 1 ? 'sabor à venda' : 'sabores à venda'}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardTitulo acao={<span className="text-xs text-gray-500">últimas {SEMANAS_GRAFICO} semanas</span>}>Faturamento por semana</CardTitulo>
          <GraficoFaturamentoSemanal dados={semanas} />
        </Card>

        <Card>
          <CardTitulo>Mais vendidas no mês</CardTitulo>
          {sabores.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma venda registrada neste mês.</p>
          ) : (
            <ul className="space-y-3">
              {sabores.map((s) => (
                <li key={s.nome}>
                  <div className="flex justify-between text-sm mb-1.5"><span>{s.nome}</span><span className="font-semibold">{inteiro(s.qtd)}</span></div>
                  <div className="h-2 rounded-full bg-[#efeadb]">
                    <div className="h-2 rounded-full bg-brand-700" style={{ width: `${(s.qtd / maiorSabor) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Suspense fallback={<Card className="lg:col-span-2 h-56 animate-pulse" aria-label="Carregando previsão" />}>
          <PrevisaoProximaSemana />
        </Suspense>

        <div className="space-y-5">
          <Card>
            <CardTitulo>Formas de pagamento</CardTitulo>
            {pagamentos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma venda registrada neste mês.</p>
            ) : (
              <>
                <div
                  role="img"
                  aria-label={pagamentos.map((p) => `${p.forma} ${Math.round(p.pct)}%`).join(', ')}
                  className="flex h-3.5 rounded-full overflow-hidden"
                >
                  {pagamentos.map((p) => <div key={p.forma} style={{ width: `${p.pct}%`, background: p.cor }} />)}
                </div>
                <ul className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  {pagamentos.map((p) => (
                    <li key={p.forma} className="flex items-center gap-2 min-w-0">
                      <span className="flex-none w-2.5 h-2.5 rounded-sm border border-black/10" style={{ background: p.cor }} />
                      <span className="truncate">{p.forma} · {Math.round(p.pct)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="border-t border-[#efeadb] mt-4 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Pedidos pelo WhatsApp</span><strong>{pedidosWhatsApp}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Vendas no balcão</span><strong>{vendasBalcao}</strong></div>
            </div>
          </Card>

          <Card>
            <CardTitulo acao={<Link href="/estoque" className="text-sm font-semibold text-brand-700 hover:text-brand-900">Ver estoque →</Link>}>
              Estoque baixo
            </CardTitulo>
            {alertas.length === 0 ? (
              <p className="text-sm text-brand-700">Todos os insumos acima do mínimo.</p>
            ) : (
              <ul className="space-y-2">
                {alertas.map((insumo) => (
                  <li key={insumo.id}>
                    <Link href={`/estoque/${insumo.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-red-50 text-red-800 px-3 py-2 text-sm hover:bg-red-100">
                      <span className="flex items-center gap-2 min-w-0"><AlertTriangle className="w-4 h-4 flex-none" aria-hidden="true" /><span className="truncate">{insumo.nome}</span></span>
                      <span className="font-semibold whitespace-nowrap">
                        {Number(insumo.estoqueAtual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} / mín. {Number(insumo.estoqueMinimo).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumo.unidade}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
