import crypto from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { assinaturaTwilioValida, enviarMensagensTwilio, extrairMensagemTwilio, twilioConfigurado } from '@/lib/twilio'
import { enviarMensagens, whatsappConfigurado } from '@/lib/whatsapp'
import { botoes, lista, texto } from '@/lib/chatbot/mensagens'
import { simularFetch } from '../helpers/fetch'

const ambiente = { ...process.env }
afterEach(() => { process.env = { ...ambiente } })

/** Assinatura como a Twilio calcula: HMAC-SHA1 (base64) da URL + parâmetros em ordem alfabética. */
const assinar = (url: string, params: Record<string, string>) =>
  crypto.createHmac('sha1', 'token-twilio-dos-testes')
    .update(url + Object.keys(params).sort().map((k) => k + params[k]).join(''))
    .digest('base64')

describe('assinatura do webhook da Twilio (X-Twilio-Signature)', () => {
  const url = 'https://pizzafredda.com.br/api/whatsapp/twilio'
  const params = { MessageSid: 'SM1', From: 'whatsapp:+5547999990000', Body: 'oi' }

  it('aceita a assinatura calculada com o Auth Token', () => {
    expect(assinaturaTwilioValida(url, params, assinar(url, params))).toBe(true)
  })

  it('recusa se a URL, um parâmetro ou o token forem diferentes', () => {
    expect(assinaturaTwilioValida(url + '?x=1', params, assinar(url, params))).toBe(false)
    expect(assinaturaTwilioValida(url, { ...params, Body: 'tchau' }, assinar(url, params))).toBe(false)
    expect(assinaturaTwilioValida(url, params, null)).toBe(false)
    delete process.env.TWILIO_AUTH_TOKEN
    expect(assinaturaTwilioValida(url, params, assinar(url, params))).toBe(false)
  })
})

describe('envio pela Twilio (sem botões: opções numeradas)', () => {
  it('junta as mensagens num texto só, com as opções numeradas em sequência', async () => {
    const chamadas = simularFetch({ json: { sid: 'SM' } })
    await enviarMensagensTwilio('5547000000001', [
      texto('Olá!'),
      botoes('O que deseja?', [{ id: 'menu:pedir', titulo: 'Fazer pedido' }, { id: 'menu:meus', titulo: 'Meus pedidos' }]),
      lista('Sabores', 'Ver', [{ id: 's1', titulo: 'Margherita', descricao: 'R$ 42,00' }]),
    ])

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACteste/Messages.json')
    expect(chamadas[0].cabecalhos.authorization).toBe('Basic ' + Buffer.from('ACteste:token-twilio-dos-testes').toString('base64'))
    expect(chamadas[0].corpo).toMatchObject({ From: 'whatsapp:+14155238886', To: 'whatsapp:+5547000000001' })
    expect(chamadas[0].corpo.Body).toBe(
      'Olá!\n\nO que deseja?\n\n1️⃣ Fazer pedido\n2️⃣ Meus pedidos\n\nSabores\n\n3️⃣ Margherita — R$ 42,00\n\n_Responda com o número da opção._'
    )
  })

  it('a resposta com o número (ou o nome) da opção vira a opção escolhida', async () => {
    simularFetch()
    await enviarMensagensTwilio('5547000000002', [botoes('?', [{ id: 'pag:pix', titulo: 'PIX' }, { id: 'pag:dinheiro', titulo: 'Dinheiro' }])])

    expect(extrairMensagemTwilio({ MessageSid: 'SM2', WaId: '5547000000002', Body: '2' }))
      .toMatchObject({ texto: 'Dinheiro', respostaId: 'pag:dinheiro' })
    expect(extrairMensagemTwilio({ MessageSid: 'SM3', WaId: '5547000000002', Body: ' pix ' }))
      .toMatchObject({ texto: 'PIX', respostaId: 'pag:pix' })
    // Número fora da lista segue como texto comum para o fluxo
    expect(extrairMensagemTwilio({ MessageSid: 'SM4', WaId: '5547000000002', Body: '9' }))
      .toMatchObject({ texto: '9', respostaId: undefined })
  })

  it('pelo adaptador do WhatsApp com WHATSAPP_PROVEDOR=twilio', async () => {
    process.env.WHATSAPP_PROVEDOR = 'twilio'
    expect(whatsappConfigurado()).toBe(twilioConfigurado())
    const chamadas = simularFetch()
    await enviarMensagens('5547000000003', [texto('a'.repeat(2000))])
    expect(chamadas.map((c) => c.corpo.Body.length)).toEqual([1600, 400])
  })

  it('erro da Twilio vira exceção', async () => {
    simularFetch({ status: 401, texto: 'Authenticate' })
    await expect(enviarMensagensTwilio('5547000000004', [texto('oi')])).rejects.toThrow('Twilio respondeu 401: Authenticate')
  })
})

describe('mensagem recebida da Twilio', () => {
  it('converte o formulário do webhook, com prefixo no id para não colidir com a Meta', () => {
    expect(extrairMensagemTwilio({ MessageSid: 'SM9', From: 'whatsapp:+5547999990000', Body: 'Oi', ProfileName: 'Ana' }))
      .toEqual({ waMessageId: 'twilio:SM9', telefone: '5547999990000', nomePerfil: 'Ana', texto: 'Oi', respostaId: undefined })
  })

  it('mídia sem texto vira aviso; formulário sem id ou telefone é ignorado', () => {
    expect(extrairMensagemTwilio({ MessageSid: 'SM10', WaId: '5547', Body: '', NumMedia: '1' })?.texto).toMatch(/\(mídia\)/)
    expect(extrairMensagemTwilio({ WaId: '5547', Body: 'oi' })).toBeNull()
    expect(extrairMensagemTwilio({ MessageSid: 'SM11', Body: 'oi' })).toBeNull()
  })
})
