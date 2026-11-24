import crypto from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import * as pedidos from '@/app/api/pedidos/route'
import * as pedido from '@/app/api/pedidos/[id]/route'
import * as resumo from '@/app/api/pedidos/resumo/route'
import * as conversas from '@/app/api/conversas/route'
import * as conversa from '@/app/api/conversas/[id]/route'
import * as mensagens from '@/app/api/conversas/[id]/mensagens/route'
import * as simulador from '@/app/api/chatbot/simulador/route'
import * as webhook from '@/app/api/whatsapp/webhook/route'
import * as twilio from '@/app/api/whatsapp/twilio/route'
import { enfileirar } from '@/lib/whatsapp'
import { criarPedido } from '@/lib/pedidos'
import { logarComo } from '../helpers/auth'
import { lerResposta, params, requisicao } from '../helpers/http'
import { simularFetch } from '../helpers/fetch'
import { criarCliente, criarConversa, criarReceita, criarUsuario, decimal } from '../helpers/db'

const esperarFila = (telefone: string) => enfileirar(telefone, async () => undefined)
const ambiente = { ...process.env }
afterEach(() => {
  process.env = { ...ambiente }
  vi.restoreAllMocks()
})

/** Pedido de WhatsApp com cliente que conversou há pouco (dentro da janela de 24h). */
async function pedidoDoWhatsApp() {
  const u = await criarUsuario()
  const receita = await criarReceita({ nome: 'Margherita', estoque: 5 })
  const cliente = await criarCliente({ nome: 'Ana' })
  const conv = await criarConversa(cliente.id, { historico: [{ role: 'user', content: 'oi' }] })
  await prisma.mensagemWhatsApp.create({ data: { direcao: 'ENTRADA', texto: 'oi', conversaId: conv.id } })
  const p = await criarPedido({ clienteId: cliente.id, conversaId: conv.id, tipoEntrega: 'RETIRADA', itens: [{ receitaId: receita.id, quantidade: 2 }] })
  logarComo('OPERADOR', u.id)
  return { u, receita, cliente, conv, p }
}

describe('painel de pedidos', () => {
  it('lista os pedidos em aberto por padrão, filtra por status e recusa status inválido', async () => {
    const { p, cliente } = await pedidoDoWhatsApp()
    await prisma.pedido.create({ data: { clienteId: cliente.id, tipoEntrega: 'RETIRADA', valorTotal: 1, status: 'ENTREGUE' } })
    expect((await lerResposta(await pedidos.GET(requisicao('GET', '/api/pedidos')))).json.map((x: { id: number }) => x.id)).toEqual([p.id])
    expect((await lerResposta(await pedidos.GET(requisicao('GET', '/api/pedidos?status=TODOS')))).json).toHaveLength(2)
    expect((await lerResposta(await pedidos.GET(requisicao('GET', '/api/pedidos?status=ENTREGUE')))).json).toHaveLength(1)
    expect((await pedidos.GET(requisicao('GET', '/api/pedidos?status=XYZ'))).status).toBe(400)
  })

  it('detalhe traz itens e a conversa do WhatsApp', async () => {
    const { p } = await pedidoDoWhatsApp()
    const r = await lerResposta(await pedido.GET(requisicao('GET', '/x'), params({ id: String(p.id) })))
    expect(r.json.itens).toHaveLength(1)
    expect(r.json.conversa.mensagens[0]).toMatchObject({ direcao: 'ENTRADA', texto: 'oi' })
    expect((await pedido.GET(requisicao('GET', '/x'), params({ id: 'abc' }))).status).toBe(404)
  })

  it('confirmar gera as vendas e avisa o cliente pelo WhatsApp', async () => {
    const { p, cliente } = await pedidoDoWhatsApp()
    const chamadas = simularFetch()
    const r = await lerResposta(await pedido.PATCH(requisicao('PATCH', '/x', { status: 'CONFIRMADO' }), params({ id: String(p.id) })))

    expect(r).toMatchObject({ status: 200, json: { pedido: { status: 'CONFIRMADO' }, notificacao: 'enviada' } })
    expect(await prisma.venda.count({ where: { pedidoId: p.id } })).toBe(1)
    expect(chamadas[0].corpo).toMatchObject({ to: cliente.telefone })
    expect(chamadas[0].corpo.text.body).toMatch(new RegExp(`Pedido #${p.id} confirmado!`))
  })

  it('falha no WhatsApp não desfaz a mudança de status', async () => {
    const { p } = await pedidoDoWhatsApp()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    simularFetch({ status: 500, texto: 'erro' })
    const r = await lerResposta(await pedido.PATCH(requisicao('PATCH', '/x', { status: 'CANCELADO' }), params({ id: String(p.id) })))
    expect(r.json).toMatchObject({ pedido: { status: 'CANCELADO' }, notificacao: 'erro' })
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('CANCELADO')
  })

  it('pedido manual não envia aviso; transição inválida → 409; status desconhecido → 400', async () => {
    const { p, cliente, receita } = await pedidoDoWhatsApp()
    const manual = await prisma.pedido.create({
      data: { clienteId: cliente.id, tipoEntrega: 'RETIRADA', valorTotal: 42, canal: 'MANUAL', itens: { create: [{ receitaId: receita.id, quantidade: 1, precoUnitario: 42 }] } },
    })
    const chamadas = simularFetch()
    expect((await lerResposta(await pedido.PATCH(requisicao('PATCH', '/x', { status: 'CONFIRMADO' }), params({ id: String(manual.id) })))).json.notificacao).toBe('nao_aplicavel')
    expect(chamadas).toHaveLength(0)
    expect((await pedido.PATCH(requisicao('PATCH', '/x', { status: 'ENTREGUE' }), params({ id: String(p.id) }))).status).toBe(409)
    expect((await pedido.PATCH(requisicao('PATCH', '/x', { status: 'PENDENTE' }), params({ id: String(p.id) }))).status).toBe(400)
  })

  it('resumo do badge conta pedidos pendentes e conversas aguardando atendente', async () => {
    const { cliente } = await pedidoDoWhatsApp()
    await criarConversa(cliente.id, { status: 'HUMANO' })
    expect((await lerResposta(await resumo.GET())).json).toEqual({ pendentes: 1, conversasAguardando: 1 })
  })
})

describe('conversas com a equipe', () => {
  it('lista quem aguarda atendente, mostra o detalhe e permite assumir e devolver ao bot', async () => {
    const { conv } = await pedidoDoWhatsApp()
    expect((await lerResposta(await conversas.GET())).json).toEqual([])

    expect((await conversa.PATCH(requisicao('PATCH', '/x', { status: 'ENCERRADA' }), params({ id: conv.id }))).status).toBe(400)
    expect((await lerResposta(await conversa.PATCH(requisicao('PATCH', '/x', { status: 'HUMANO' }), params({ id: conv.id })))).json.status).toBe('HUMANO')
    const lista = await lerResposta(await conversas.GET())
    expect(lista.json[0]).toMatchObject({ id: conv.id, cliente: { nome: 'Ana' }, mensagens: [{ texto: 'oi' }] })

    const detalhe = await lerResposta(await conversa.GET(requisicao('GET', '/x'), params({ id: conv.id })))
    expect(detalhe.json.pedidos).toHaveLength(1)
    expect((await conversa.PATCH(requisicao('PATCH', '/x', { status: 'BOT' }), params({ id: conv.id }))).status).toBe(200)
    expect((await conversa.GET(requisicao('GET', '/x'), params({ id: 'nao-existe' }))).status).toBe(404)
    expect((await conversa.PATCH(requisicao('PATCH', '/x', { status: 'BOT' }), params({ id: 'nao-existe' }))).status).toBe(404)
  })

  it('conversa encerrada não pode ser reaberta', async () => {
    const cliente = await criarCliente()
    const conv = await criarConversa(cliente.id, { status: 'ENCERRADA' })
    logarComo('OPERADOR')
    expect((await conversa.PATCH(requisicao('PATCH', '/x', { status: 'HUMANO' }), params({ id: conv.id }))).status).toBe(409)
  })

  it('resposta manual da equipe vai pelo WhatsApp; fora da janela de 24h é recusada (422)', async () => {
    const { conv } = await pedidoDoWhatsApp()
    simularFetch()
    expect((await mensagens.POST(requisicao('POST', '/x', { texto: ' ' }), params({ id: conv.id }))).status).toBe(400)
    expect((await mensagens.POST(requisicao('POST', '/x', { texto: 'Olá!' }), params({ id: 'nao-existe' }))).status).toBe(404)
    expect(await lerResposta(await mensagens.POST(requisicao('POST', '/x', { texto: ' Olá, Ana! ' }), params({ id: conv.id })))).toEqual({ status: 200, json: { ok: true } })

    await prisma.mensagemWhatsApp.updateMany({ data: { createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000) } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await mensagens.POST(requisicao('POST', '/x', { texto: 'Oi de novo' }), params({ id: conv.id }))).status).toBe(422)
  })
})

describe('simulador do WhatsApp no painel', () => {
  it('só aceita telefones de teste (000…) e atende como o webhook, sem enviar nada', async () => {
    logarComo('OPERADOR')
    const chamadas = simularFetch()
    expect((await simulador.POST(requisicao('POST', '/x', { telefone: '5547999990000', texto: 'oi' }))).status).toBe(400)
    expect((await simulador.POST(requisicao('POST', '/x', { telefone: '000abc', texto: 'oi' }))).status).toBe(400)
    expect((await simulador.POST(requisicao('POST', '/x', { telefone: '000111', texto: ' ' }))).status).toBe(400)

    const r = await lerResposta(await simulador.POST(requisicao('POST', '/x', { telefone: '000111', texto: 'oi' })))
    expect(r.json.saidas[0].texto).toMatch(/Olá, Cliente! Bem-vindo/)
    expect(r.json.iaDisponivel).toBe(false)
    expect(chamadas).toHaveLength(0)

    expect((await lerResposta(await simulador.POST(requisicao('POST', '/x', { telefone: '000111', novaConversa: true })))).json.saidas).toEqual([])
    expect((await prisma.conversa.findFirstOrThrow()).status).toBe('ENCERRADA')
  })
})

describe('webhook da Meta', () => {
  const assinar = (corpo: string) => 'sha256=' + crypto.createHmac('sha256', 'segredo-app-dos-testes').update(corpo).digest('hex')

  it('verificação do webhook devolve o challenge só com o token certo', async () => {
    const ok = await webhook.GET(requisicao('GET', '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verificacao-dos-testes&hub.challenge=123'))
    expect([ok.status, await ok.text()]).toEqual([200, '123'])
    expect((await webhook.GET(requisicao('GET', '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1'))).status).toBe(403)
  })

  it('recusa corpo sem assinatura válida e JSON inválido', async () => {
    expect((await webhook.POST(requisicao('POST', '/x', '{}', { 'x-hub-signature-256': 'sha256=000' }))).status).toBe(401)
    expect((await webhook.POST(requisicao('POST', '/x', 'nao-json', { 'x-hub-signature-256': assinar('nao-json') }))).status).toBe(400)
  })

  it('mensagem assinada: responde 200 na hora e atende em segundo plano, respondendo ao cliente', async () => {
    const chamadas = simularFetch()
    const corpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: {
      contacts: [{ wa_id: '5547988887777', profile: { name: 'Bia' } }],
      messages: [{ id: 'wamid.X', from: '5547988887777', type: 'text', text: { body: 'oi' } }],
    } }] }] })

    const res = await webhook.POST(requisicao('POST', '/api/whatsapp/webhook', corpo, { 'x-hub-signature-256': assinar(corpo) }))
    expect(await lerResposta(res)).toEqual({ status: 200, json: { ok: true } })
    await esperarFila('5547988887777')

    expect(await prisma.mensagemWhatsApp.findUnique({ where: { waMessageId: 'wamid.X' } })).not.toBeNull()
    expect(chamadas.map((c) => c.corpo.status ?? c.corpo.type)).toEqual(['read', 'interactive'])
  })
})

describe('webhook da Twilio', () => {
  const URL_WEBHOOK = 'http://localhost/api/whatsapp/twilio'
  const assinar = (p: Record<string, string>) =>
    crypto.createHmac('sha1', 'token-twilio-dos-testes').update(URL_WEBHOOK + Object.keys(p).sort().map((k) => k + p[k]).join('')).digest('base64')
  const form = (p: Record<string, string>) => new URLSearchParams(p).toString()

  it('recusa assinatura inválida e atende a mensagem assinada (resposta em TwiML vazio)', async () => {
    process.env.WHATSAPP_PROVEDOR = 'twilio'
    const p = { MessageSid: 'SM77', From: 'whatsapp:+5547977776666', WaId: '5547977776666', Body: 'oi' }
    expect((await twilio.POST(requisicao('POST', '/api/whatsapp/twilio', form(p), { 'x-twilio-signature': 'errada' }))).status).toBe(401)

    const chamadas = simularFetch()
    const res = await twilio.POST(requisicao('POST', '/api/whatsapp/twilio', form(p), { 'x-twilio-signature': assinar(p) }))
    expect(res.headers.get('content-type')).toBe('text/xml')
    expect(await res.text()).toContain('<Response></Response>')
    await esperarFila('5547977776666')
    expect(await prisma.mensagemWhatsApp.findUnique({ where: { waMessageId: 'twilio:SM77' } })).not.toBeNull()
    expect(chamadas[0].corpo.Body).toMatch(/1️⃣ 🍕 Fazer pedido/)
  })

  it('atrás do proxy usa a URL pública dos cabeçalhos X-Forwarded para validar a assinatura', async () => {
    const p = { MessageSid: 'SM78', WaId: '5547977775555', Body: 'oi' }
    const publica = 'https://pizzafredda.com.br/api/whatsapp/twilio'
    const assinatura = crypto.createHmac('sha1', 'token-twilio-dos-testes').update(publica + Object.keys(p).sort().map((k) => k + p[k as keyof typeof p]).join('')).digest('base64')
    simularFetch()
    const res = await twilio.POST(requisicao('POST', '/api/whatsapp/twilio', form(p), {
      'x-twilio-signature': assinatura, 'x-forwarded-proto': 'https', 'x-forwarded-host': 'pizzafredda.com.br',
    }))
    expect(res.status).toBe(200)
    await esperarFila('5547977775555')
  })
})

describe('dados persistidos pelos pedidos', () => {
  it('o valor total do pedido é calculado no servidor', async () => {
    const { p } = await pedidoDoWhatsApp()
    expect(decimal((await prisma.pedido.findUniqueOrThrow({ where: { id: p.id } })).valorTotal)).toBe(90)
  })
})
