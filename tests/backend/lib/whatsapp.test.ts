import crypto from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assinaturaValida, ehTelefoneSimulado, enfileirar, enviarMensagens, enviarTexto,
  extrairMensagens, marcarComoLida, registrarFalhasDeEntrega, whatsappConfigurado,
} from '@/lib/whatsapp'
import { botoes, lista, texto } from '@/lib/chatbot/mensagens'
import { simularFetch } from '../helpers/fetch'

const assinar = (corpo: string, segredo = 'segredo-app-dos-testes') =>
  'sha256=' + crypto.createHmac('sha256', segredo).update(corpo).digest('hex')

const ambiente = { ...process.env }
afterEach(() => {
  process.env = { ...ambiente }
  vi.restoreAllMocks()
})

describe('assinatura do webhook da Meta (X-Hub-Signature-256)', () => {
  const corpo = '{"entry":[]}'

  it('aceita o HMAC-SHA256 do corpo feito com o App Secret', () => {
    expect(assinaturaValida(corpo, assinar(corpo))).toBe(true)
  })

  it('recusa assinatura de outro segredo, de outro corpo, ausente ou fora do formato', () => {
    expect(assinaturaValida(corpo, assinar(corpo, 'outro-segredo'))).toBe(false)
    expect(assinaturaValida(corpo + ' ', assinar(corpo))).toBe(false)
    expect(assinaturaValida(corpo, null)).toBe(false)
    expect(assinaturaValida(corpo, 'md5=abc')).toBe(false)
  })

  it('sem App Secret configurado recusa tudo (falha fechada)', () => {
    delete process.env.WHATSAPP_APP_SECRET
    expect(assinaturaValida(corpo, assinar(corpo))).toBe(false)
  })
})

describe('mensagens recebidas pelo webhook', () => {
  const payload = (messages: unknown[], extra: object = {}) => ({
    entry: [{ changes: [{ field: 'messages', value: { contacts: [{ wa_id: '5547999990000', profile: { name: 'Ana' } }], messages, ...extra } }] }],
  })

  it('extrai texto, botão, item de lista e o nome do perfil', () => {
    const msgs = extrairMensagens(payload([
      { id: 'w1', from: '5547999990000', type: 'text', text: { body: 'oi' } },
      { id: 'w2', from: '5547999990000', type: 'interactive', interactive: { button_reply: { id: 'menu:pedir', title: 'Fazer pedido' } } },
      { id: 'w3', from: '5547999990000', type: 'interactive', interactive: { list_reply: { id: 'sabor:abc', title: 'Margherita' } } },
    ]))
    expect(msgs).toEqual([
      { waMessageId: 'w1', telefone: '5547999990000', nomePerfil: 'Ana', texto: 'oi', respostaId: undefined },
      { waMessageId: 'w2', telefone: '5547999990000', nomePerfil: 'Ana', texto: 'Fazer pedido', respostaId: 'menu:pedir' },
      { waMessageId: 'w3', telefone: '5547999990000', nomePerfil: 'Ana', texto: 'Margherita', respostaId: 'sabor:abc' },
    ])
  })

  it('mensagem que não é texto (áudio, foto) vira um aviso para o bot pedir texto', () => {
    const [msg] = extrairMensagens(payload([{ id: 'w4', from: '5547999990000', type: 'audio' }]))
    expect(msg.texto).toMatch(/tipo "audio", que não consigo ler/)
  })

  it('ignora atualizações de status e outros campos', () => {
    expect(extrairMensagens({ entry: [{ changes: [{ field: 'messages', value: { statuses: [] } }] }] })).toEqual([])
    expect(extrairMensagens({ entry: [{ changes: [{ field: 'account_update', value: {} }] }] })).toEqual([])
    expect(extrairMensagens({})).toEqual([])
  })

  it('registra no log as mensagens que a Meta não conseguiu entregar', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registrarFalhasDeEntrega({
      entry: [{ changes: [{ value: { statuses: [
        { id: 's1', status: 'delivered', recipient_id: '5547' },
        { id: 's2', status: 'failed', recipient_id: '5548', errors: [{ code: 131047, title: 'Re-engagement message', error_data: { details: 'mais de 24h' } }] },
      ] } }] }],
    })
    expect(aviso).toHaveBeenCalledTimes(1)
    expect(aviso.mock.calls[0][0]).toMatch(/5548 não foi entregue: \(#131047\) Re-engagement message mais de 24h/)
  })
})

describe('envio pela Cloud API da Meta', () => {
  it('envia botões e listas como mensagens interativas', async () => {
    const chamadas = simularFetch({ json: { messages: [{ id: 'x' }] } })
    await enviarMensagens('5547999990000', [
      botoes('Escolha', [{ id: 'a', titulo: 'Sim' }, { id: 'b', titulo: 'Não' }]),
      lista('Sabores', 'Ver sabores', [{ id: 's1', titulo: 'Margherita', descricao: 'R$ 42,00' }]),
    ])

    expect(chamadas).toHaveLength(2)
    expect(chamadas[0].url).toBe('https://graph.facebook.com/v23.0/123456/messages')
    expect(chamadas[0].cabecalhos.authorization).toBe('Bearer token-whatsapp-dos-testes')
    expect(chamadas[0].corpo).toMatchObject({
      messaging_product: 'whatsapp', to: '5547999990000', type: 'interactive',
      interactive: { type: 'button', body: { text: 'Escolha' }, action: { buttons: [{ type: 'reply', reply: { id: 'a', title: 'Sim' } }, { type: 'reply', reply: { id: 'b', title: 'Não' } }] } },
    })
    expect(chamadas[1].corpo.interactive).toMatchObject({
      type: 'list', action: { button: 'Ver sabores', sections: [{ rows: [{ id: 's1', title: 'Margherita', description: 'R$ 42,00' }] }] },
    })
  })

  it('quebra textos maiores que o limite da API (4096) em várias mensagens', async () => {
    const chamadas = simularFetch()
    await enviarTexto('5547999990000', 'a'.repeat(5000))
    expect(chamadas.map((c) => c.corpo.text.body.length)).toEqual([4096, 904])
  })

  it('nunca envia para telefones do simulador (000…)', async () => {
    const chamadas = simularFetch()
    expect(ehTelefoneSimulado('000123')).toBe(true)
    await enviarMensagens('000123', [texto('oi'), botoes('?', [{ id: 'a', titulo: 'A' }])])
    expect(chamadas).toHaveLength(0)
  })

  it('sem token configurado não envia e avisa no log', async () => {
    delete process.env.WHATSAPP_TOKEN
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chamadas = simularFetch()
    expect(whatsappConfigurado()).toBe(false)
    await enviarTexto('5547999990000', 'oi')
    expect(chamadas).toHaveLength(0)
    expect(aviso).toHaveBeenCalled()
  })

  it('erro da API vira exceção com o status e a resposta', async () => {
    simularFetch({ status: 400, texto: '{"error":"invalid"}' })
    await expect(enviarTexto('5547999990000', 'oi')).rejects.toThrow('WhatsApp API respondeu 400: {"error":"invalid"}')
  })

  it('marcar como lida não derruba o atendimento se a API falhar', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chamadas = simularFetch({ status: 500, texto: 'erro' })
    await expect(marcarComoLida('wamid.1')).resolves.toBeUndefined()
    expect(chamadas[0].corpo).toMatchObject({ status: 'read', message_id: 'wamid.1' })
  })
})

describe('fila por cliente', () => {
  it('processa as tarefas de um mesmo telefone em ordem, sem bloquear outros telefones', async () => {
    const ordem: string[] = []
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

    await Promise.all([
      enfileirar('5547-a', async () => { await espera(30); ordem.push('a1') }),
      enfileirar('5547-a', async () => { ordem.push('a2') }),
      enfileirar('5547-b', async () => { ordem.push('b1') }),
    ])
    expect(ordem).toEqual(['b1', 'a1', 'a2'])
  })

  it('uma tarefa que falha não trava as próximas do mesmo cliente', async () => {
    const falha = enfileirar('5547-c', async () => { throw new Error('boom') })
    await expect(falha).rejects.toThrow('boom')
    await expect(enfileirar('5547-c', async () => 'ok')).resolves.toBe('ok')
  })
})
