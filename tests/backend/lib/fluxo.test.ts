import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { descreverEstado, estadoInicial, normalizar, processarFluxo, promptEtapa, type EstadoFluxo } from '@/lib/chatbot/fluxo'
import type { MensagemSaida } from '@/lib/chatbot/mensagens'
import { criarCliente, criarConversa, criarReceita, decimal } from '../helpers/db'

/** Simula uma conversa: guarda o estado entre as mensagens, como o atendimento faz no banco. */
async function conversa(opcoesCliente: Parameters<typeof criarCliente>[0] = {}) {
  const cliente = await criarCliente(opcoesCliente)
  const conv = await criarConversa(cliente.id)
  const ctx = { clienteId: cliente.id, conversaId: conv.id }
  let estado: EstadoFluxo | null = null
  let ultima: Awaited<ReturnType<typeof processarFluxo>>

  const enviar = async (texto: string, respostaId?: string) => {
    ultima = await processarFluxo(estado, { texto, respostaId }, ctx)
    estado = ultima.estado
    return ultima
  }
  return { cliente, ctx, enviar, tocar: (id: string) => enviar('', id), get estado() { return estado! } }
}

const textoDe = (saidas: MensagemSaida[]) => saidas.map((m) => m.texto).join('\n')
const opcoesDe = (saidas: MensagemSaida[]) =>
  saidas.flatMap((m) => (m.tipo === 'botoes' ? m.botoes : m.tipo === 'lista' ? m.opcoes : []))

describe('fluxo guiado de pedidos pelo WhatsApp', () => {
  it('pedido completo pelos botões: menu → sabor → quantidade → carrinho → nome → entrega → endereço → pagamento → confirmar', async () => {
    const margherita = await criarReceita({ nome: 'Margherita', estoque: 5, preco: 42 })
    const c = await conversa({ nome: null })

    let r = await c.enviar('Oi')
    expect(textoDe(r.saidas)).toMatch(/Bem-vindo\(a\) à \*Fredda Pizzaria\*/)
    expect(opcoesDe(r.saidas).map((o) => o.id)).toEqual(['menu:pedir', 'menu:meus', 'menu:atendente'])

    r = await c.tocar('menu:pedir')
    expect(c.estado.etapa).toBe('SABOR')
    expect(opcoesDe(r.saidas)).toEqual([{ id: `sabor:${margherita.id}`, titulo: 'Margherita', descricao: expect.stringMatching(/R\$\s42,00 · 5 disponíveis/) }])

    r = await c.tocar(`sabor:${margherita.id}`)
    expect(c.estado.etapa).toBe('QUANTIDADE')
    expect(textoDe(r.saidas)).toMatch(/Posso separar até 5\.\nPara mais de 3, digite o número/)

    r = await c.tocar('qtd:2')
    expect(c.estado.carrinho).toEqual([{ receitaId: margherita.id, nome: 'Margherita', preco: 42, quantidade: 2 }])
    expect(textoDe(r.saidas)).toMatch(/Adicionei 2x Margherita[\s\S]*Total: R\$\s84,00/)

    await c.tocar('carrinho:finalizar')
    expect(c.estado.etapa).toBe('NOME') // primeiro pedido: pede o nome

    r = await c.enviar('ana souza')
    expect(textoDe(r.saidas)).toMatch(/^Prazer, ana!/)
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.cliente.id } })).nome).toBe('ana souza')

    r = await c.tocar('entrega:ENTREGA')
    expect(c.estado.etapa).toBe('ENDERECO')
    expect(textoDe(r.saidas)).toMatch(/Qual é o endereço de entrega/)

    r = await c.enviar('Rua das Flores, 123 - Centro')
    expect(c.estado.etapa).toBe('PAGAMENTO')
    expect(opcoesDe(r.saidas).map((o) => o.titulo)).toEqual(['PIX', 'DINHEIRO', 'DÉBITO', 'CRÉDITO'])

    r = await c.tocar('pag:PIX')
    expect(c.estado.etapa).toBe('CONFIRMAR')
    expect(textoDe(r.saidas)).toMatch(/2x Margherita[\s\S]*Total: R\$\s84,00[\s\S]*Entrega em: Rua das Flores, 123 - Centro[\s\S]*Pagamento: PIX/)

    r = await c.tocar('confirmar:sim')
    const pedido = await prisma.pedido.findFirstOrThrow({ include: { itens: true } })
    expect(textoDe(r.saidas)).toContain(`Pedido *#${pedido.id}* registrado!`)
    expect(pedido).toMatchObject({ status: 'PENDENTE', tipoEntrega: 'ENTREGA', enderecoEntrega: 'Rua das Flores, 123 - Centro', formaPagamento: 'PIX', conversaId: c.ctx.conversaId })
    expect(decimal(pedido.valorTotal)).toBe(84)
    expect(decimal((await prisma.receita.findUniqueOrThrow({ where: { id: margherita.id } })).estoqueAtual)).toBe(3)
    expect(c.estado).toEqual(estadoInicial()) // carrinho zerado para o próximo pedido
  })

  it('entende texto digitado no lugar dos botões ("calabrese", "3", "retirar", "pix", "sim")', async () => {
    const calabrese = await criarReceita({ nome: 'Calabrese', estoque: 10, preco: 48 })
    await criarReceita({ nome: 'Quattro Formaggi', estoque: 10, preco: 50 })
    const c = await conversa({ nome: 'Bruno' })

    await c.enviar('oi')
    await c.enviar('quero pedir')
    expect(c.estado.etapa).toBe('SABOR')
    await c.enviar('calabrese')
    expect(c.estado.saborEmEscolha?.receitaId).toBe(calabrese.id)
    await c.enviar('3 por favor')
    expect(c.estado.carrinho[0].quantidade).toBe(3)
    await c.enviar('finalizar')
    expect(c.estado.etapa).toBe('ENTREGA') // já tem nome: pula para a entrega
    await c.enviar('retirar')
    await c.enviar('Pix')
    const r = await c.enviar('sim')
    expect(textoDe(r.saidas)).toMatch(/registrado/)
    expect(await prisma.pedido.findFirstOrThrow()).toMatchObject({ tipoEntrega: 'RETIRADA', enderecoEntrega: null, formaPagamento: 'PIX' })
  })

  it('oferece o último endereço usado e permite trocar', async () => {
    await criarReceita({ nome: 'Margherita', estoque: 5 })
    const c = await conversa({ nome: 'Ana', endereco: 'Rua Antiga, 1' })
    await c.enviar('oi')
    await c.tocar('menu:pedir')
    await c.tocar(opcoesDe((await c.enviar('margherita')).saidas)[0]?.id ?? 'qtd:1')
    await c.tocar('qtd:1')
    await c.tocar('carrinho:finalizar')

    let r = await c.tocar('entrega:ENTREGA')
    expect(textoDe(r.saidas)).toMatch(/endereço que já temos\?\n📍 Rua Antiga, 1/)
    r = await c.tocar('endereco:outro')
    expect(textoDe(r.saidas)).toMatch(/Qual é o endereço/)
    r = await c.enviar('rua?')
    expect(r.naoEntendido).toBe(true) // não parece endereço: a IA tenta ajudar
    await c.enviar('Avenida Nova, 500 apto 2')
    expect(c.estado.endereco).toBe('Avenida Nova, 500 apto 2')
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.cliente.id } })).endereco).toBe('Avenida Nova, 500 apto 2')
  })

  it('não deixa pedir mais do que há em estoque', async () => {
    const pouco = await criarReceita({ nome: 'Portuguesa', estoque: 2 })
    const c = await conversa()
    await c.tocar('menu:pedir')
    let r = await c.tocar(`sabor:${pouco.id}`)
    expect(opcoesDe(r.saidas).map((o) => o.id)).toEqual(['qtd:1', 'qtd:2'])
    r = await c.enviar('5')
    expect(textoDe(r.saidas)).toMatch(/Posso separar de 1 a 2 unidade/)
    await c.tocar('qtd:2')

    // Com as 2 no carrinho, o sabor some da lista; sem outros sabores, volta ao carrinho
    r = await c.tocar('carrinho:mais')
    expect(textoDe(r.saidas)).toMatch(/não temos mais sabores disponíveis/)
    expect(c.estado.etapa).toBe('CARRINHO')
  })

  it('se o sabor esgotar antes de confirmar, avisa e volta ao carrinho sem criar pedido', async () => {
    const r1 = await criarReceita({ nome: 'Margherita', estoque: 2 })
    const c = await conversa({ nome: 'Ana' })
    await c.tocar('menu:pedir')
    await c.tocar(`sabor:${r1.id}`)
    await c.tocar('qtd:2')
    await c.tocar('carrinho:finalizar')
    await c.tocar('entrega:RETIRADA')
    await c.tocar('pag:DINHEIRO')
    await prisma.receita.update({ where: { id: r1.id }, data: { estoqueAtual: 1 } }) // outra venda levou uma

    const r = await c.tocar('confirmar:sim')
    expect(textoDe(r.saidas)).toMatch(/Não consegui registrar: Estoque insuficiente de Margherita/)
    expect(c.estado.etapa).toBe('CARRINHO')
    expect(await prisma.pedido.count()).toBe(0)
  })

  it('pagina a lista quando há mais de 10 sabores (9 por página + "ver mais")', async () => {
    for (let i = 1; i <= 12; i++) await criarReceita({ nome: `Sabor ${String(i).padStart(2, '0')}`, estoque: 5 })
    const c = await conversa()

    let r = await c.tocar('menu:pedir')
    let opcoes = opcoesDe(r.saidas)
    expect(opcoes).toHaveLength(10)
    expect(opcoes[8].titulo).toBe('Sabor 09')
    expect(opcoes[9]).toMatchObject({ id: 'sabores:1', titulo: '➡️ Ver mais sabores' })

    r = await c.tocar('sabores:1')
    opcoes = opcoesDe(r.saidas)
    expect(opcoes.map((o) => o.titulo)).toEqual(['Sabor 10', 'Sabor 11', 'Sabor 12', '⬅️ Voltar ao início'])
  })

  it('esvaziar o carrinho e descartar o pedido voltam ao menu', async () => {
    const s = await criarReceita({ estoque: 5 })
    const c = await conversa({ nome: 'Ana' })
    await c.tocar('menu:pedir')
    await c.tocar(`sabor:${s.id}`)
    await c.tocar('qtd:1')
    let r = await c.tocar('carrinho:limpar')
    expect(textoDe(r.saidas)).toMatch(/Carrinho esvaziado/)
    expect(c.estado).toEqual(estadoInicial())

    await c.tocar('menu:pedir')
    await c.tocar(`sabor:${s.id}`)
    await c.tocar('qtd:1')
    await c.tocar('carrinho:finalizar')
    await c.tocar('entrega:RETIRADA')
    await c.tocar('pag:PIX')
    await c.tocar('confirmar:alterar')
    expect(c.estado.etapa).toBe('CARRINHO')
    await c.tocar('carrinho:finalizar')
    await c.tocar('entrega:RETIRADA')
    await c.tocar('pag:PIX')
    r = await c.tocar('confirmar:cancelar')
    expect(textoDe(r.saidas)).toMatch(/Pedido descartado/)
  })

  it('"Meus pedidos" mostra o histórico do próprio cliente e permite cancelar o pendente', async () => {
    const s = await criarReceita({ nome: 'Margherita', estoque: 5 })
    const c = await conversa({ nome: 'Ana' })
    const outro = await criarCliente()
    const pedidoAna = await prisma.pedido.create({
      data: { clienteId: c.cliente.id, tipoEntrega: 'RETIRADA', valorTotal: 42, itens: { create: [{ receitaId: s.id, quantidade: 1, precoUnitario: 42 }] } },
    })
    const pedidoOutro = await prisma.pedido.create({ data: { clienteId: outro.id, tipoEntrega: 'RETIRADA', valorTotal: 10 } })

    await c.enviar('oi')
    let r = await c.enviar('meus pedidos')
    expect(textoDe(r.saidas)).toMatch(new RegExp(`\\*#${pedidoAna.id}\\*[\\s\\S]*1x Margherita[\\s\\S]*Aguardando confirmação`))
    expect(textoDe(r.saidas)).not.toContain(`#${pedidoOutro.id}`)
    expect(opcoesDe(r.saidas)[0].id).toBe(`cancelarpedido:${pedidoAna.id}`)

    // Não consegue cancelar o pedido de outro cliente digitando o id
    r = await c.tocar(`cancelarpedido:${pedidoOutro.id}`)
    expect(textoDe(r.saidas)).toMatch(/não está mais disponível/)

    r = await c.tocar(`cancelarpedido:${pedidoAna.id}`)
    expect(textoDe(r.saidas)).toMatch(`Quer mesmo cancelar o pedido *#${pedidoAna.id}*?`)
    r = await c.enviar('sim')
    expect(textoDe(r.saidas)).toMatch(`Pedido #${pedidoAna.id} cancelado`)
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoAna.id } })).status).toBe('CANCELADO')
  })

  it('pedido já confirmado não pode ser cancelado pelo cliente', async () => {
    const c = await conversa()
    const pedido = await prisma.pedido.create({ data: { clienteId: c.cliente.id, tipoEntrega: 'RETIRADA', valorTotal: 42, status: 'CONFIRMADO' } })
    await c.enviar('oi')
    const r = await c.tocar(`cancelarpedido:${pedido.id}`)
    expect(textoDe(r.saidas)).toMatch(/está confirmado e não pode mais ser cancelado por aqui/)
  })

  it('desistir do cancelamento mantém o pedido', async () => {
    const c = await conversa()
    const pedido = await prisma.pedido.create({ data: { clienteId: c.cliente.id, tipoEntrega: 'RETIRADA', valorTotal: 42 } })
    await c.enviar('oi')
    await c.tocar(`cancelarpedido:${pedido.id}`)
    const r = await c.enviar('não')
    expect(textoDe(r.saidas)).toMatch(/continua de pé/)
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } })).status).toBe('PENDENTE')
  })

  it('cliente sem pedidos recebe aviso', async () => {
    const c = await conversa()
    await c.enviar('oi')
    const r = await c.tocar('menu:meus')
    expect(textoDe(r.saidas)).toMatch(/ainda não fez nenhum pedido/)
  })

  it('pedir atendente sinaliza para chamar a equipe', async () => {
    const c = await conversa()
    await c.enviar('oi')
    const r = await c.enviar('quero falar com um atendente')
    expect(r.chamarAtendente).toBe(true)
  })

  it('texto livre fora do roteiro fica para a IA (naoEntendido)', async () => {
    const c = await conversa()
    expect((await c.enviar('quero 2 calabresas pra sábado de manhã')).naoEntendido).toBe(true) // primeira mensagem longa
    await c.enviar('oi')
    expect((await c.enviar('vocês entregam em Blumenau?')).naoEntendido).toBe(true)
  })

  it('botão de uma etapa que já passou não quebra o fluxo', async () => {
    const c = await conversa()
    await c.enviar('oi')
    const r = await c.tocar('confirmar:sim') // botão antigo
    expect(textoDe(r.saidas)).toMatch(/Essa opção não está mais disponível/)
    expect(await prisma.pedido.count()).toBe(0)
  })

  it('digitar "menu" no meio do pedido sai da etapa: o próximo texto não é gravado como nome', async () => {
    const s = await criarReceita({ nome: 'Calabrese', estoque: 5 })
    const c = await conversa({ nome: null })
    await c.tocar('menu:pedir')
    await c.tocar(`sabor:${s.id}`)
    await c.tocar('qtd:1')
    await c.tocar('carrinho:finalizar')
    expect(c.estado.etapa).toBe('NOME')

    await c.enviar('menu')
    expect(c.estado.etapa).toBe('MENU')
    await c.enviar('calabrese')
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.cliente.id } })).nome).toBeNull()
  })

  it('"menu" volta ao início guardando o carrinho e "continuar" repete a pergunta da etapa', async () => {
    const s = await criarReceita({ nome: 'Margherita', estoque: 5 })
    const c = await conversa()
    await c.tocar('menu:pedir')
    await c.tocar(`sabor:${s.id}`)
    await c.tocar('qtd:1')
    let r = await c.enviar('menu')
    expect(textoDe(r.saidas)).toMatch(/Seu carrinho continua guardado/)
    await c.tocar('menu:pedir')
    expect(c.estado.etapa).toBe('CARRINHO')
    r = await c.tocar('nav:continuar')
    expect(textoDe(r.saidas)).toMatch(/Seu carrinho:\n- 1x Margherita/)
  })
})

describe('apoio ao fluxo', () => {
  it('normaliza acentos, emoji e pontuação', () => {
    expect(normalizar('  Olá!! Quattro Formággi 🍕 ')).toBe('ola quattro formaggi')
  })

  it('descreve para a IA onde o cliente parou', () => {
    expect(descreverEstado({
      etapa: 'PAGAMENTO', carrinho: [{ receitaId: 'r', nome: 'Margherita', quantidade: 2, preco: 42 }],
      tipoEntrega: 'ENTREGA', endereco: 'Rua A, 1', formaPagamento: 'PIX',
    })).toBe('Etapa do menu: escolhendo a forma de pagamento\nCarrinho em montagem: 2x Margherita\nEscolheu: entrega em Rua A, 1\nPagamento: PIX')
    expect(descreverEstado(estadoInicial())).toBe('Etapa do menu: no menu principal')
  })

  it('repete a pergunta de cada etapa', async () => {
    const cliente = await criarCliente({ endereco: null })
    const ctx = { clienteId: cliente.id, conversaId: 'x' }
    const pergunta = async (estado: EstadoFluxo) => textoDe(await promptEtapa(estado, ctx))
    expect(await pergunta({ etapa: 'NOME', carrinho: [] })).toMatch(/qual é o seu nome/)
    expect(await pergunta({ etapa: 'ENTREGA', carrinho: [] })).toMatch(/retirar na pizzaria ou prefere entrega/)
    expect(await pergunta({ etapa: 'ENDERECO', carrinho: [] })).toMatch(/Qual é o endereço/)
    expect(await pergunta({ etapa: 'PAGAMENTO', carrinho: [] })).toMatch(/Como você prefere pagar/)
    expect(await pergunta({ etapa: 'CANCELAR_PEDIDO', carrinho: [], pedidoACancelar: 7 })).toMatch(/cancelar o pedido \*#7\*/)
    expect(await pergunta({ etapa: 'MENU', carrinho: [] })).toBe('Como posso ajudar?')
  })
})
