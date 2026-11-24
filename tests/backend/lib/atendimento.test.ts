import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { atenderMensagem } from '@/lib/chatbot/atendimento'
import { metricas } from '@/lib/metricas'
import { criarCliente, criarConversa, criarReceita } from '../helpers/db'

// A IA é testada em agente.test.ts; aqui ela é simulada para testar a orquestração.
const { responderComIA } = vi.hoisted(() => ({ responderComIA: vi.fn() }))
vi.mock('@/lib/chatbot/agente', () => ({ responderComIA }))

const origem = async (o: string) => (await metricas.chatbotMensagens.get()).values.find((v) => v.labels.origem === o)?.value ?? 0
const textoDe = (saidas: { texto: string }[]) => saidas.map((s) => s.texto).join('\n')

afterEach(() => responderComIA.mockReset())

describe('atendimento de uma mensagem do cliente', () => {
  it('cliente novo: cria cliente e conversa, responde pelo menu e grava a transcrição e o estado', async () => {
    const antes = await origem('fluxo')
    const saidas = await atenderMensagem({ telefone: '5547999990001', texto: 'Oi', waMessageId: 'w1', nomePerfil: 'Ana' })

    expect(textoDe(saidas)).toMatch(/Olá, Ana! Bem-vindo\(a\)/)
    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { telefone: '5547999990001' }, include: { conversas: { include: { mensagens: { orderBy: { createdAt: 'asc' } } } } } })
    const [conversa] = cliente.conversas
    expect(conversa.mensagens.map((m) => m.direcao)).toEqual(['ENTRADA', 'SAIDA'])
    expect(conversa.estadoFluxo).toEqual({ etapa: 'MENU', carrinho: [] })
    expect(await origem('fluxo')).toBe(antes + 1)
    expect(responderComIA).not.toHaveBeenCalled()
  })

  it('reenvio do webhook com o mesmo id é ignorado (não responde duas vezes)', async () => {
    await atenderMensagem({ telefone: '5547999990002', texto: 'Oi', waMessageId: 'w-dup' })
    expect(await atenderMensagem({ telefone: '5547999990002', texto: 'Oi', waMessageId: 'w-dup' })).toEqual([])
    expect(await prisma.mensagemWhatsApp.count({ where: { waMessageId: 'w-dup' } })).toBe(1)
  })

  it('conversa com a equipe: o bot fica em silêncio, mas a mensagem é registrada', async () => {
    const cliente = await criarCliente({ telefone: '5547999990003' })
    const conversa = await criarConversa(cliente.id, { status: 'HUMANO' })
    expect(await atenderMensagem({ telefone: '5547999990003', texto: 'alguém aí?' })).toEqual([])
    expect(await prisma.mensagemWhatsApp.count({ where: { conversaId: conversa.id, direcao: 'ENTRADA' } })).toBe(1)
    expect(await prisma.mensagemWhatsApp.count({ where: { conversaId: conversa.id, direcao: 'SAIDA' } })).toBe(0)
  })

  it('pedir atendente pelo menu passa a conversa para a equipe', async () => {
    await atenderMensagem({ telefone: '5547999990004', texto: 'oi' })
    await atenderMensagem({ telefone: '5547999990004', texto: '', respostaId: 'menu:atendente' })
    const conversa = await prisma.conversa.findFirstOrThrow({ where: { cliente: { telefone: '5547999990004' } } })
    expect(conversa.status).toBe('HUMANO')
  })

  it('menu não entendeu e a IA está indisponível: pede desculpas e repete as opções da etapa', async () => {
    responderComIA.mockResolvedValue(null)
    const antes = await origem('fallback')
    await atenderMensagem({ telefone: '5547999990005', texto: 'oi' })
    const saidas = await atenderMensagem({ telefone: '5547999990005', texto: 'vocês abrem no feriado de amanhã?' })

    expect(saidas[0].texto).toBe('Desculpe, não entendi 🤔 Escolha uma das opções abaixo:')
    expect(saidas[1]).toMatchObject({ tipo: 'botoes' })
    expect(await origem('fallback')).toBe(antes + 1)
  })

  it('menu não entendeu: a IA responde com o contexto da etapa e oferece voltar ao pedido', async () => {
    const s = await criarReceita({ nome: 'Margherita', estoque: 5 })
    responderComIA.mockResolvedValue({ texto: 'Abrimos sim, das 18h às 22h.', criouPedido: false, chamouAtendente: false })
    const antes = await origem('ia')
    await atenderMensagem({ telefone: '5547999990006', texto: 'oi' })
    await atenderMensagem({ telefone: '5547999990006', texto: '', respostaId: 'menu:pedir' })
    await atenderMensagem({ telefone: '5547999990006', texto: '', respostaId: `sabor:${s.id}` })
    const saidas = await atenderMensagem({ telefone: '5547999990006', texto: 'vocês abrem no feriado?' })

    expect(responderComIA.mock.calls[0][0]).toMatchObject({ texto: 'vocês abrem no feriado?', situacaoMenu: 'Etapa do menu: escolhendo a quantidade de Margherita' })
    expect(saidas).toEqual([{
      tipo: 'botoes', texto: 'Abrimos sim, das 18h às 22h.',
      botoes: [{ id: 'nav:continuar', titulo: '▶️ Continuar pedido' }, { id: 'nav:menu', titulo: '📋 Menu' }],
    }])
    expect(await origem('ia')).toBe(antes + 1)
  })

  it('resposta longa da IA vai em texto separado dos botões (limite de 1024 caracteres)', async () => {
    responderComIA.mockResolvedValue({ texto: 'x'.repeat(1500), criouPedido: false, chamouAtendente: false })
    await atenderMensagem({ telefone: '5547999990007', texto: 'oi' })
    const saidas = await atenderMensagem({ telefone: '5547999990007', texto: 'me conta a história da fermentação natural' })
    expect(saidas.map((s) => s.tipo)).toEqual(['texto', 'botoes'])
    expect(saidas[1].texto).toBe('Quer continuar por aqui?')
  })

  it('quando a IA cria o pedido ou chama a equipe, o estado do menu acompanha', async () => {
    await atenderMensagem({ telefone: '5547999990008', texto: 'oi' })
    responderComIA.mockResolvedValue({ texto: 'Pedido registrado!', criouPedido: true, chamouAtendente: false })
    await atenderMensagem({ telefone: '5547999990008', texto: 'quero 2 margheritas para retirar, pago no pix' })
    const conversa = await prisma.conversa.findFirstOrThrow({ where: { cliente: { telefone: '5547999990008' } } })
    expect(conversa.estadoFluxo).toEqual({ etapa: 'MENU', carrinho: [] })

    responderComIA.mockResolvedValue({ texto: 'Vou chamar a equipe.', criouPedido: false, chamouAtendente: true })
    const saidas = await atenderMensagem({ telefone: '5547999990008', texto: 'preciso de nota fiscal com CNPJ da empresa' })
    expect(saidas).toEqual([{ tipo: 'texto', texto: 'Vou chamar a equipe.' }])
  })
})
