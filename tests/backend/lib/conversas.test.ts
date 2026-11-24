import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { obterConversaAtiva, registrarMensagemDaEquipe, registrarSaida } from '@/lib/chatbot/conversas'
import { notificarCliente } from '@/lib/chatbot/notificar'
import { criarCliente, criarConversa } from '../helpers/db'
import { simularFetch } from '../helpers/fetch'

const HORA = 60 * 60 * 1000
const ambiente = { ...process.env }
afterEach(() => {
  process.env = { ...ambiente }
  vi.restoreAllMocks()
})

describe('conversa ativa do cliente', () => {
  it('reaproveita a conversa recente', async () => {
    const cliente = await criarCliente()
    const conversa = await criarConversa(cliente.id, { ultimaMensagemEm: new Date(Date.now() - 2 * HORA) })
    expect((await obterConversaAtiva(cliente.id)).id).toBe(conversa.id)
  })

  it('depois de 24h sem mensagens encerra a antiga e abre uma nova', async () => {
    const cliente = await criarCliente()
    const antiga = await criarConversa(cliente.id, { ultimaMensagemEm: new Date(Date.now() - 25 * HORA) })
    const nova = await obterConversaAtiva(cliente.id)
    expect(nova.id).not.toBe(antiga.id)
    expect((await prisma.conversa.findUniqueOrThrow({ where: { id: antiga.id } })).status).toBe('ENCERRADA')
  })

  it('conversa com histórico longo demais também é renovada (limita o custo da IA)', async () => {
    const cliente = await criarCliente()
    const longa = await criarConversa(cliente.id, { historico: Array.from({ length: 81 }, () => ({ role: 'user', content: 'x' })) })
    expect((await obterConversaAtiva(cliente.id)).id).not.toBe(longa.id)
  })

  it('cliente sem conversa ganha uma nova, sem histórico', async () => {
    const cliente = await criarCliente()
    const conversa = await obterConversaAtiva(cliente.id)
    expect(conversa).toMatchObject({ clienteId: cliente.id, status: 'BOT', historico: [] })
  })
})

describe('mensagens da equipe', () => {
  it('entram na transcrição e no histórico da IA quando a conversa já começou', async () => {
    const cliente = await criarCliente()
    const conversa = await criarConversa(cliente.id, { historico: [{ role: 'user', content: [{ type: 'text', text: 'oi' }] }] })
    await registrarMensagemDaEquipe(conversa.id, 'Seu pedido saiu para entrega')

    const atual = await prisma.conversa.findUniqueOrThrow({ where: { id: conversa.id } })
    expect(atual.historico).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'oi' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Seu pedido saiu para entrega' }] },
    ])
    expect(await prisma.mensagemWhatsApp.findFirst({ where: { conversaId: conversa.id } })).toMatchObject({ direcao: 'SAIDA', texto: 'Seu pedido saiu para entrega' })
  })

  it('com histórico vazio fica só na transcrição (o histórico da IA deve começar pelo cliente)', async () => {
    const cliente = await criarCliente()
    const conversa = await criarConversa(cliente.id)
    await registrarMensagemDaEquipe(conversa.id, 'Aviso')
    expect((await prisma.conversa.findUniqueOrThrow({ where: { id: conversa.id } })).historico).toEqual([])
    expect(await prisma.mensagemWhatsApp.count({ where: { conversaId: conversa.id } })).toBe(1)
  })

  it('conversa inexistente é ignorada', async () => {
    await expect(registrarMensagemDaEquipe('nao-existe', 'x')).resolves.toBeUndefined()
  })

  it('registrarSaida grava a mensagem enviada', async () => {
    const cliente = await criarCliente()
    const conversa = await criarConversa(cliente.id)
    await registrarSaida(conversa.id, 'olá')
    expect(await prisma.mensagemWhatsApp.count({ where: { conversaId: conversa.id, direcao: 'SAIDA' } })).toBe(1)
  })
})

describe('aviso ao cliente pelo WhatsApp (janela de 24h)', () => {
  async function clienteComMensagem(horasAtras: number) {
    const cliente = await criarCliente()
    const conversa = await criarConversa(cliente.id, { historico: [{ role: 'user', content: 'oi' }] })
    await prisma.mensagemWhatsApp.create({
      data: { direcao: 'ENTRADA', texto: 'oi', conversaId: conversa.id, createdAt: new Date(Date.now() - horasAtras * HORA) },
    })
    return { cliente, conversa }
  }

  it('dentro da janela envia e registra na conversa', async () => {
    const { cliente, conversa } = await clienteComMensagem(1)
    const chamadas = simularFetch()
    expect(await notificarCliente(cliente.id, 'Pedido confirmado')).toBe('enviada')
    expect(chamadas[0].corpo).toMatchObject({ to: cliente.telefone, text: { body: 'Pedido confirmado' } })
    expect(await prisma.mensagemWhatsApp.count({ where: { conversaId: conversa.id, direcao: 'SAIDA' } })).toBe(1)
  })

  it('fora da janela de 24h não envia (exigiria template aprovado pela Meta)', async () => {
    const { cliente } = await clienteComMensagem(30)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chamadas = simularFetch()
    expect(await notificarCliente(cliente.id, 'x')).toBe('fora_da_janela')
    expect(chamadas).toHaveLength(0)
  })

  it('sem conversa não há para quem avisar', async () => {
    const cliente = await criarCliente()
    expect(await notificarCliente(cliente.id, 'x')).toBe('sem_conversa')
  })

  it('sem WhatsApp configurado registra na conversa e informa', async () => {
    const { cliente } = await clienteComMensagem(1)
    delete process.env.WHATSAPP_TOKEN
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await notificarCliente(cliente.id, 'x')).toBe('nao_configurado')
  })
})
