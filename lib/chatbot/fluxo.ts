import { prisma } from '@/lib/prisma'
import { FORMAS_PAGAMENTO_CLIENTE, MAX_UNIDADES_POR_PEDIDO } from '@/lib/constantes'
import { cancelarPedido, criarPedido, formatarMoeda, PedidoError, ROTULO_STATUS } from '@/lib/pedidos'
import { botoes, lista, texto, LIMITES, type MensagemSaida, type Opcao } from '@/lib/chatbot/mensagens'

// Fluxo guiado de pedidos: cada mensagem do cliente avança uma etapa. É o caminho
// principal do atendimento; quando o cliente escreve algo que o fluxo não entende,
// o resultado volta com `naoEntendido` e o atendimento aciona a IA (plano B).

export type Etapa =
  | 'MENU' | 'SABOR' | 'QUANTIDADE' | 'CARRINHO' | 'NOME'
  | 'ENTREGA' | 'ENDERECO' | 'PAGAMENTO' | 'CONFIRMAR' | 'CANCELAR_PEDIDO'

export interface ItemCarrinho {
  receitaId: string
  nome: string
  quantidade: number
  preco: number
}

export interface EstadoFluxo {
  etapa: Etapa
  carrinho: ItemCarrinho[]
  saborEmEscolha?: { receitaId: string; nome: string; preco: number }
  tipoEntrega?: 'RETIRADA' | 'ENTREGA'
  endereco?: string
  digitandoEndereco?: boolean
  formaPagamento?: string
  pedidoACancelar?: number
}

export const estadoInicial = (): EstadoFluxo => ({ etapa: 'MENU', carrinho: [] })

/** Volta ao menu descartando carrinho, entrega e pagamento. */
function resetar(estado: EstadoFluxo) {
  for (const chave of Object.keys(estado)) delete estado[chave as keyof EstadoFluxo]
  Object.assign(estado, estadoInicial())
}

export interface EntradaFluxo {
  texto: string
  respostaId?: string
}

export interface ContextoFluxo {
  clienteId: string
  conversaId: string
  nomePerfil?: string
}

export interface ResultadoFluxo {
  estado: EstadoFluxo
  saidas: MensagemSaida[]
  /** o fluxo não entendeu a mensagem — a IA pode tentar ajudar */
  naoEntendido?: boolean
  /** o cliente pediu para falar com uma pessoa */
  chamarAtendente?: boolean
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Minúsculas, sem acentos, sem emoji e sem pontuação. */
export function normalizar(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const contarPalavras = (s: string) => (s ? s.split(' ').length : 0)
const SAUDACAO = /^(oi+|ola|opa|eai|e ai|bom dia|boa tarde|boa noite|hey|hello|tudo bem|menu|inicio)\b/
const SIM = /^(sim|s|ok|pode|pode ser|confirmo|confirmar|isso|certo|claro)$/
const NAO = /^(nao|n|nope|deixa|deixa pra la)$/

const totalCarrinho = (c: ItemCarrinho[]) => c.reduce((t, i) => t + i.preco * i.quantidade, 0)
const unidadesCarrinho = (c: ItemCarrinho[]) => c.reduce((t, i) => t + i.quantidade, 0)
const linhasCarrinho = (c: ItemCarrinho[]) =>
  c.map((i) => `- ${i.quantidade}x ${i.nome} (${formatarMoeda(i.preco)})`).join('\n')

async function carregarCliente(ctx: ContextoFluxo) {
  return prisma.cliente.findUniqueOrThrow({ where: { id: ctx.clienteId } })
}

/** Sabores à venda agora, já descontando o que está no carrinho. */
async function saboresDisponiveis(carrinho: ItemCarrinho[]) {
  const receitas = await prisma.receita.findMany({
    where: { ativo: true, precoVenda: { not: null } },
    orderBy: { nome: 'asc' },
  })
  return receitas
    .map((r) => {
      const noCarrinho = carrinho.find((i) => i.receitaId === r.id)?.quantidade ?? 0
      return {
        receitaId: r.id,
        nome: r.nome,
        descricao: r.descricao,
        preco: Number(r.precoVenda),
        disponivel: Math.floor(Number(r.estoqueAtual)) - noCarrinho,
      }
    })
    .filter((s) => s.disponivel > 0)
}

// ─── Mensagens de cada etapa ─────────────────────────────────────────────────

const BOTOES_MENU: Opcao[] = [
  { id: 'menu:pedir', titulo: '🍕 Fazer pedido' },
  { id: 'menu:meus', titulo: '📦 Meus pedidos' },
  { id: 'menu:atendente', titulo: '💬 Atendente' },
]

function menuPrincipal(cabecalho = 'Como posso ajudar?'): MensagemSaida {
  return botoes(cabecalho, BOTOES_MENU)
}

async function boasVindas(ctx: ContextoFluxo): Promise<MensagemSaida> {
  const cliente = await carregarCliente(ctx)
  const nome = cliente.nome || ctx.nomePerfil
  return menuPrincipal(
    `Olá${nome ? `, ${nome.split(' ')[0]}` : ''}! Bem-vindo(a) à *Fredda Pizzaria* 🍕\n` +
    'Pizzas de longa fermentação, congeladas e prontas para assar em casa.\n\n' +
    'Como posso ajudar? Se preferir, é só escrever sua dúvida.'
  )
}

async function listaSabores(estado: EstadoFluxo, pagina = 0): Promise<MensagemSaida[]> {
  const sabores = await saboresDisponiveis(estado.carrinho)
  if (sabores.length === 0) {
    estado.etapa = estado.carrinho.length ? 'CARRINHO' : 'MENU'
    const aviso = 'No momento não temos mais sabores disponíveis 😕'
    return [estado.carrinho.length ? resumoCarrinho(estado, aviso) : menuPrincipal(`${aviso}\n\nPosso ajudar com mais alguma coisa?`)]
  }

  estado.etapa = 'SABOR'
  // A lista do WhatsApp aceita até 10 itens: acima disso, 9 por página + "ver mais"
  const porPagina = sabores.length <= LIMITES.linhasLista ? LIMITES.linhasLista : LIMITES.linhasLista - 1
  const paginas = Math.ceil(sabores.length / porPagina)
  const atual = Math.min(Math.max(pagina, 0), paginas - 1)

  const opcoes: Opcao[] = sabores.slice(atual * porPagina, (atual + 1) * porPagina).map((s) => ({
    id: `sabor:${s.receitaId}`,
    titulo: s.nome,
    descricao: `${formatarMoeda(s.preco)} · ${s.disponivel} disponíve${s.disponivel === 1 ? 'l' : 'is'}`,
  }))
  if (paginas > 1) {
    opcoes.push({ id: `sabores:${(atual + 1) % paginas}`, titulo: atual + 1 < paginas ? '➡️ Ver mais sabores' : '⬅️ Voltar ao início' })
  }

  const cabecalho = estado.carrinho.length
    ? `Seu carrinho:\n${linhasCarrinho(estado.carrinho)}\n\nEscolha mais um sabor:`
    : 'Escolha um sabor do nosso cardápio:'
  return [lista(cabecalho, 'Ver sabores', opcoes)]
}

function perguntaQuantidade(estado: EstadoFluxo, maximo: number): MensagemSaida {
  const sabor = estado.saborEmEscolha!
  const opcoes = [1, 2, 3].filter((n) => n <= maximo).map((n) => ({ id: `qtd:${n}`, titulo: String(n) }))
  return botoes(
    `*${sabor.nome}* — ${formatarMoeda(sabor.preco)} cada.\n` +
    `Quantas unidades? Posso separar até ${maximo}.` +
    (maximo > 3 ? '\nPara mais de 3, digite o número.' : ''),
    opcoes
  )
}

function resumoCarrinho(estado: EstadoFluxo, cabecalho = '🛒 Seu carrinho:'): MensagemSaida {
  estado.etapa = 'CARRINHO'
  return botoes(
    `${cabecalho}\n${linhasCarrinho(estado.carrinho)}\n\n*Total: ${formatarMoeda(totalCarrinho(estado.carrinho))}*`,
    [
      { id: 'carrinho:mais', titulo: '➕ Outro sabor' },
      { id: 'carrinho:finalizar', titulo: '✅ Finalizar' },
      { id: 'carrinho:limpar', titulo: '🗑️ Esvaziar' },
    ]
  )
}

function perguntaEntrega(estado: EstadoFluxo, cabecalho = ''): MensagemSaida {
  estado.etapa = 'ENTREGA'
  return botoes(`${cabecalho}Você vai retirar na pizzaria ou prefere entrega?`, [
    { id: 'entrega:RETIRADA', titulo: '🏪 Retirar' },
    { id: 'entrega:ENTREGA', titulo: '🛵 Entrega' },
  ])
}

async function perguntaEndereco(estado: EstadoFluxo, ctx: ContextoFluxo): Promise<MensagemSaida> {
  estado.etapa = 'ENDERECO'
  const cliente = await carregarCliente(ctx)
  if (cliente.endereco && !estado.digitandoEndereco) {
    return botoes(`Posso entregar no endereço que já temos?\n📍 ${cliente.endereco}`, [
      { id: 'endereco:salvo', titulo: '✅ Usar este' },
      { id: 'endereco:outro', titulo: '✏️ Outro endereço' },
    ])
  }
  estado.digitandoEndereco = true
  return texto('Qual é o endereço de entrega? Informe rua, número, complemento (se houver), bairro e cidade.')
}

function perguntaPagamento(estado: EstadoFluxo): MensagemSaida {
  estado.etapa = 'PAGAMENTO'
  return lista(
    'Como você prefere pagar? O pagamento é feito na entrega ou retirada.',
    'Formas de pagamento',
    FORMAS_PAGAMENTO_CLIENTE.map((f) => ({ id: `pag:${f}`, titulo: f }))
  )
}

function resumoFinal(estado: EstadoFluxo): MensagemSaida {
  estado.etapa = 'CONFIRMAR'
  const entrega = estado.tipoEntrega === 'ENTREGA' ? `🛵 Entrega em: ${estado.endereco}` : '🏪 Retirada na pizzaria'
  return botoes(
    `Confira seu pedido:\n${linhasCarrinho(estado.carrinho)}\n\n` +
    `*Total: ${formatarMoeda(totalCarrinho(estado.carrinho))}*\n${entrega}\n💳 Pagamento: ${estado.formaPagamento}\n\n` +
    'Posso confirmar?',
    [
      { id: 'confirmar:sim', titulo: '✅ Confirmar' },
      { id: 'confirmar:alterar', titulo: '✏️ Alterar' },
      { id: 'confirmar:cancelar', titulo: '❌ Cancelar' },
    ]
  )
}

/** Repete a pergunta da etapa atual (ex.: depois de uma resposta da IA ou de uma opção inválida). */
export async function promptEtapa(estado: EstadoFluxo, ctx: ContextoFluxo): Promise<MensagemSaida[]> {
  switch (estado.etapa) {
    case 'SABOR':
      return listaSabores(estado)
    case 'QUANTIDADE': {
      const maximo = await maximoParaSabor(estado)
      return maximo > 0 ? [perguntaQuantidade(estado, maximo)] : listaSabores(estado)
    }
    case 'CARRINHO':
      return estado.carrinho.length ? [resumoCarrinho(estado)] : listaSabores(estado)
    case 'NOME':
      return [texto('Para finalizar, qual é o seu nome?')]
    case 'ENTREGA':
      return [perguntaEntrega(estado)]
    case 'ENDERECO':
      return [await perguntaEndereco(estado, ctx)]
    case 'PAGAMENTO':
      return [perguntaPagamento(estado)]
    case 'CONFIRMAR':
      return [resumoFinal(estado)]
    case 'CANCELAR_PEDIDO':
      return [perguntaCancelamento(estado.pedidoACancelar!)]
    default:
      return [menuPrincipal()]
  }
}

// ─── Ações ───────────────────────────────────────────────────────────────────

async function maximoParaSabor(estado: EstadoFluxo) {
  const sabor = estado.saborEmEscolha
  if (!sabor) return 0
  const disponivel = (await saboresDisponiveis(estado.carrinho)).find((s) => s.receitaId === sabor.receitaId)?.disponivel ?? 0
  return Math.min(disponivel, MAX_UNIDADES_POR_PEDIDO - unidadesCarrinho(estado.carrinho))
}

async function escolherSabor(estado: EstadoFluxo, receitaId: string): Promise<MensagemSaida[]> {
  const sabor = (await saboresDisponiveis(estado.carrinho)).find((s) => s.receitaId === receitaId)
  if (!sabor) {
    return [texto('Esse sabor acabou de esgotar 😕'), ...(await listaSabores(estado))]
  }
  if (unidadesCarrinho(estado.carrinho) >= MAX_UNIDADES_POR_PEDIDO) {
    return [texto(`Pelo menu dá para pedir até ${MAX_UNIDADES_POR_PEDIDO} unidades. Para pedidos maiores, fale com um atendente.`), resumoCarrinho(estado)]
  }
  estado.saborEmEscolha = { receitaId: sabor.receitaId, nome: sabor.nome, preco: sabor.preco }
  estado.etapa = 'QUANTIDADE'
  return [perguntaQuantidade(estado, await maximoParaSabor(estado))]
}

async function adicionarAoCarrinho(estado: EstadoFluxo, quantidade: number): Promise<MensagemSaida[]> {
  const maximo = await maximoParaSabor(estado)
  if (maximo <= 0) {
    return [texto('Esse sabor acabou de esgotar 😕'), ...(await listaSabores(estado))]
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > maximo) {
    return [texto(`Posso separar de 1 a ${maximo} unidade(s) desse sabor.`), perguntaQuantidade(estado, maximo)]
  }

  const sabor = estado.saborEmEscolha!
  const existente = estado.carrinho.find((i) => i.receitaId === sabor.receitaId)
  if (existente) existente.quantidade += quantidade
  else estado.carrinho.push({ ...sabor, quantidade })
  estado.saborEmEscolha = undefined

  return [resumoCarrinho(estado, `Adicionei ${quantidade}x ${sabor.nome} 👍\n\n🛒 Seu carrinho:`)]
}

async function finalizarCarrinho(estado: EstadoFluxo, ctx: ContextoFluxo): Promise<MensagemSaida[]> {
  if (!estado.carrinho.length) return listaSabores(estado)
  const cliente = await carregarCliente(ctx)
  if (!cliente.nome) {
    estado.etapa = 'NOME'
    return [texto('Para finalizar, qual é o seu nome?')]
  }
  return [perguntaEntrega(estado)]
}

async function confirmarPedido(estado: EstadoFluxo, ctx: ContextoFluxo): Promise<MensagemSaida[]> {
  try {
    const pedido = await criarPedido({
      clienteId: ctx.clienteId,
      conversaId: ctx.conversaId,
      itens: estado.carrinho.map((i) => ({ receitaId: i.receitaId, quantidade: i.quantidade })),
      tipoEntrega: estado.tipoEntrega!,
      enderecoEntrega: estado.endereco,
      formaPagamento: estado.formaPagamento,
    })
    resetar(estado)
    return [botoes(
      `✅ Pedido *#${pedido.id}* registrado! Total: ${formatarMoeda(pedido.valorTotal)}.\n\n` +
      'Nossa equipe vai confirmar por aqui em breve. Obrigado por escolher a Fredda! 🍕',
      [{ id: 'menu:meus', titulo: '📦 Meus pedidos' }, { id: 'nav:menu', titulo: '📋 Menu' }]
    )]
  } catch (e) {
    if (!(e instanceof PedidoError)) throw e
    // Normalmente um sabor esgotou enquanto o cliente montava o pedido
    return [texto(`Não consegui registrar: ${e.message}. Vamos revisar o carrinho?`), resumoCarrinho(estado)]
  }
}

async function meusPedidos(estado: EstadoFluxo, ctx: ContextoFluxo): Promise<MensagemSaida[]> {
  estado.etapa = 'MENU'
  const pedidos = await prisma.pedido.findMany({
    where: { clienteId: ctx.clienteId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { itens: { include: { receita: { select: { nome: true } } } } },
  })
  if (!pedidos.length) return [menuPrincipal('Você ainda não fez nenhum pedido por aqui.\n\nComo posso ajudar?')]

  const linhas = pedidos.map((p) =>
    `*#${p.id}* · ${p.createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · ${formatarMoeda(p.valorTotal)}\n` +
    `${p.itens.map((i) => `${Number(i.quantidade)}x ${i.receita.nome}`).join(', ')}\n` +
    `Status: ${ROTULO_STATUS[p.status]}`
  )
  const pendente = pedidos.find((p) => p.status === 'PENDENTE')
  const opcoes: Opcao[] = [
    ...(pendente ? [{ id: `cancelarpedido:${pendente.id}`, titulo: `❌ Cancelar #${pendente.id}` }] : []),
    { id: 'menu:pedir', titulo: '🍕 Novo pedido' },
    { id: 'nav:menu', titulo: '📋 Menu' },
  ]
  return [botoes(`Seus últimos pedidos:\n\n${linhas.join('\n\n')}`, opcoes)]
}

function perguntaCancelamento(numero: number): MensagemSaida {
  return botoes(`Quer mesmo cancelar o pedido *#${numero}*?`, [
    { id: 'cancelarpedido:sim', titulo: 'Sim, cancelar' },
    { id: 'cancelarpedido:nao', titulo: 'Não' },
  ])
}

async function tratarCancelamento(estado: EstadoFluxo, valor: string, ctx: ContextoFluxo): Promise<MensagemSaida[]> {
  if (valor === 'nao') {
    estado.etapa = 'MENU'
    estado.pedidoACancelar = undefined
    return [menuPrincipal('Tudo bem, o pedido continua de pé 👍\n\nPosso ajudar com mais alguma coisa?')]
  }

  const numero = valor === 'sim' ? estado.pedidoACancelar : Number(valor)
  const pedido = numero ? await prisma.pedido.findFirst({ where: { id: numero, clienteId: ctx.clienteId } }) : null
  if (!pedido) return opcaoIndisponivel(estado, ctx)

  if (pedido.status !== 'PENDENTE') {
    estado.etapa = 'MENU'
    return [botoes(
      `O pedido #${pedido.id} está ${ROTULO_STATUS[pedido.status].toLowerCase()} e não pode mais ser cancelado por aqui. Quer falar com a equipe?`,
      [{ id: 'menu:atendente', titulo: '💬 Atendente' }, { id: 'nav:menu', titulo: '📋 Menu' }]
    )]
  }

  if (valor !== 'sim') {
    estado.etapa = 'CANCELAR_PEDIDO'
    estado.pedidoACancelar = pedido.id
    return [perguntaCancelamento(pedido.id)]
  }

  estado.etapa = 'MENU'
  estado.pedidoACancelar = undefined
  try {
    await cancelarPedido(pedido.id, { apenasPendente: true })
    return [menuPrincipal(`Pedido #${pedido.id} cancelado.\n\nPosso ajudar com mais alguma coisa?`)]
  } catch (e) {
    if (!(e instanceof PedidoError)) throw e
    return [menuPrincipal(`Não consegui cancelar: ${e.message}.`)]
  }
}

async function opcaoIndisponivel(estado: EstadoFluxo, ctx: ContextoFluxo): Promise<MensagemSaida[]> {
  return [texto('Essa opção não está mais disponível. Vamos continuar daqui:'), ...(await promptEtapa(estado, ctx))]
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

async function tratarOpcao(id: string, estado: EstadoFluxo, ctx: ContextoFluxo): Promise<ResultadoFluxo> {
  const [tipo, ...resto] = id.split(':')
  const valor = resto.join(':')
  const r = (saidas: MensagemSaida[]): ResultadoFluxo => ({ estado, saidas })

  switch (tipo) {
    case 'menu':
      if (valor === 'pedir') return r(estado.carrinho.length ? [resumoCarrinho(estado)] : await listaSabores(estado))
      if (valor === 'meus') return r(await meusPedidos(estado, ctx))
      if (valor === 'atendente') {
        return { estado, chamarAtendente: true, saidas: [texto('Certo! Vou chamar alguém da nossa equipe. Já já respondemos por aqui 🙂')] }
      }
      break
    case 'nav':
      if (valor === 'menu') {
        estado.etapa = 'MENU'
        return r([menuPrincipal(estado.carrinho.length ? 'Seu carrinho continua guardado. Como posso ajudar?' : 'Como posso ajudar?')])
      }
      if (valor === 'continuar') return r(await promptEtapa(estado, ctx))
      break
    case 'sabores':
      return r(await listaSabores(estado, Number(valor) || 0))
    case 'sabor':
      return r(await escolherSabor(estado, valor))
    case 'qtd':
      if (estado.etapa === 'QUANTIDADE' && estado.saborEmEscolha) return r(await adicionarAoCarrinho(estado, Number(valor)))
      break
    case 'carrinho':
      if (valor === 'mais') return r(await listaSabores(estado))
      if (valor === 'finalizar') return r(await finalizarCarrinho(estado, ctx))
      if (valor === 'limpar') {
        resetar(estado)
        return r([menuPrincipal('Carrinho esvaziado. Como posso ajudar?')])
      }
      break
    case 'entrega':
      if (!estado.carrinho.length) break
      if (valor === 'RETIRADA') {
        estado.tipoEntrega = 'RETIRADA'
        estado.endereco = undefined
        return r([perguntaPagamento(estado)])
      }
      if (valor === 'ENTREGA') {
        estado.tipoEntrega = 'ENTREGA'
        estado.digitandoEndereco = false
        return r([await perguntaEndereco(estado, ctx)])
      }
      break
    case 'endereco':
      if (estado.tipoEntrega !== 'ENTREGA') break
      if (valor === 'salvo') {
        const cliente = await carregarCliente(ctx)
        if (!cliente.endereco) return r([await perguntaEndereco(estado, ctx)])
        estado.endereco = cliente.endereco
        return r([perguntaPagamento(estado)])
      }
      if (valor === 'outro') {
        estado.digitandoEndereco = true
        return r([await perguntaEndereco(estado, ctx)])
      }
      break
    case 'pag':
      if (!estado.carrinho.length || !estado.tipoEntrega) break
      if (!(FORMAS_PAGAMENTO_CLIENTE as readonly string[]).includes(valor)) break
      estado.formaPagamento = valor
      return r([resumoFinal(estado)])
    case 'confirmar':
      if (estado.etapa !== 'CONFIRMAR') break
      if (valor === 'sim') return r(await confirmarPedido(estado, ctx))
      if (valor === 'alterar') return r([resumoCarrinho(estado, 'Sem problemas! Seu carrinho:')])
      if (valor === 'cancelar') {
        resetar(estado)
        return r([menuPrincipal('Pedido descartado. Como posso ajudar?')])
      }
      break
    case 'cancelarpedido':
      return r(await tratarCancelamento(estado, valor, ctx))
  }
  return r(await opcaoIndisponivel(estado, ctx))
}

/** Tenta entender texto digitado como resposta da etapa atual. */
async function tratarTexto(textoOriginal: string, estado: EstadoFluxo, ctx: ContextoFluxo): Promise<ResultadoFluxo> {
  const t = normalizar(textoOriginal)
  const naoEntendido: ResultadoFluxo = { estado, saidas: [], naoEntendido: true }

  // Atalhos que valem em qualquer etapa. "menu" vem antes da saudação (a regex de
  // saudação também casa "menu"); os dois levam a etapa para o menu, guardando o carrinho,
  // para que o próximo texto não seja lido como resposta da etapa anterior (ex.: o nome).
  if (/^(menu|inicio|voltar|comecar)$/.test(t)) return tratarOpcao('nav:menu', estado, ctx)
  if (SAUDACAO.test(t) && contarPalavras(t) <= 4) {
    estado.etapa = 'MENU'
    return { estado, saidas: [await boasVindas(ctx)] }
  }
  if (/\b(atendente|humano|pessoa de verdade)\b/.test(t) && contarPalavras(t) <= 6) return tratarOpcao('menu:atendente', estado, ctx)

  switch (estado.etapa) {
    case 'QUANTIDADE': {
      const numeros = t.match(/\d+/g)
      if (numeros?.length === 1 && contarPalavras(t) <= 4) return tratarOpcao(`qtd:${numeros[0]}`, estado, ctx)
      return naoEntendido
    }
    case 'NOME': {
      const nome = textoOriginal.trim().replace(/\s+/g, ' ')
      const pareceNome = /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,60}$/.test(nome) && contarPalavras(t) <= 6
      if (!pareceNome) return naoEntendido
      await prisma.cliente.update({ where: { id: ctx.clienteId }, data: { nome } })
      return { estado, saidas: [perguntaEntrega(estado, `Prazer, ${nome.split(' ')[0]}! `)] }
    }
    case 'ENDERECO': {
      if (!estado.digitandoEndereco) break
      const endereco = textoOriginal.trim().replace(/\s+/g, ' ')
      const pareceEndereco = endereco.length >= 10 && /\d/.test(endereco) && !endereco.includes('?')
      if (!pareceEndereco) return naoEntendido
      estado.endereco = endereco
      estado.digitandoEndereco = false
      await prisma.cliente.update({ where: { id: ctx.clienteId }, data: { endereco } })
      return { estado, saidas: [perguntaPagamento(estado)] }
    }
    case 'CONFIRMAR':
      if (SIM.test(t)) return tratarOpcao('confirmar:sim', estado, ctx)
      break
    case 'CANCELAR_PEDIDO':
      if (SIM.test(t)) return tratarOpcao('cancelarpedido:sim', estado, ctx)
      if (NAO.test(t)) return tratarOpcao('cancelarpedido:nao', estado, ctx)
      break
    case 'SABOR': {
      // Nome do sabor digitado (ex.: "calabrese", "quatro formaggi")
      const sabores = await saboresDisponiveis(estado.carrinho)
      const achado = sabores.filter((s) => {
        const nome = normalizar(s.nome)
        return t === nome || (t.length >= 4 && (nome.includes(t) || t.includes(nome)))
      })
      if (achado.length === 1) return tratarOpcao(`sabor:${achado[0].receitaId}`, estado, ctx)
      break
    }
    case 'MENU':
      if (/\b(cardapio|sabores|pedir|fazer pedido|quero pedir)\b/.test(t) && contarPalavras(t) <= 4) return tratarOpcao('menu:pedir', estado, ctx)
      if (/\b(meus pedidos|meu pedido|status)\b/.test(t) && contarPalavras(t) <= 5) return tratarOpcao('menu:meus', estado, ctx)
      break
  }

  // Por último, o texto digitado igual ao título de uma das opções da etapa
  const opcoes = (await promptEtapa({ ...estado, carrinho: [...estado.carrinho] }, ctx))
    .flatMap((m) => (m.tipo === 'botoes' ? m.botoes : m.tipo === 'lista' ? m.opcoes : []))
  const opcao = opcoes.find((o) => normalizar(o.titulo) === t)
  if (opcao) return tratarOpcao(opcao.id, estado, ctx)

  return naoEntendido
}

/**
 * Processa uma mensagem do cliente no fluxo guiado.
 * `estadoAtual` nulo significa conversa nova.
 */
export async function processarFluxo(
  estadoAtual: EstadoFluxo | null,
  entrada: EntradaFluxo,
  ctx: ContextoFluxo
): Promise<ResultadoFluxo> {
  const estado: EstadoFluxo = estadoAtual ? structuredClone(estadoAtual) : estadoInicial()

  if (entrada.respostaId) return tratarOpcao(entrada.respostaId, estado, ctx)

  if (!estadoAtual) {
    // Primeira mensagem: cumprimento ou mensagem curta abre o menu; texto mais longo
    // (ex.: "quero 2 calabresas pra sábado") vai para a IA, que entende pedidos por escrito.
    const t = normalizar(entrada.texto)
    if (SAUDACAO.test(t) || contarPalavras(t) <= 3) return { estado, saidas: [await boasVindas(ctx)] }
    return { estado, saidas: [], naoEntendido: true }
  }

  return tratarTexto(entrada.texto, estado, ctx)
}

/** Resumo do estado para a IA saber onde o cliente parou no menu. */
export function descreverEstado(estado: EstadoFluxo) {
  const ETAPAS: Record<Etapa, string> = {
    MENU: 'no menu principal',
    SABOR: 'escolhendo um sabor',
    QUANTIDADE: `escolhendo a quantidade de ${estado.saborEmEscolha?.nome ?? 'um sabor'}`,
    CARRINHO: 'revisando o carrinho',
    NOME: 'informando o nome',
    ENTREGA: 'escolhendo entre retirada e entrega',
    ENDERECO: 'informando o endereço de entrega',
    PAGAMENTO: 'escolhendo a forma de pagamento',
    CONFIRMAR: 'confirmando o pedido',
    CANCELAR_PEDIDO: `decidindo se cancela o pedido #${estado.pedidoACancelar}`,
  }
  const partes = [`Etapa do menu: ${ETAPAS[estado.etapa]}`]
  if (estado.carrinho.length) {
    partes.push(`Carrinho em montagem: ${estado.carrinho.map((i) => `${i.quantidade}x ${i.nome}`).join(', ')}`)
  }
  if (estado.tipoEntrega) partes.push(`Escolheu: ${estado.tipoEntrega === 'ENTREGA' ? `entrega em ${estado.endereco ?? '(endereço pendente)'}` : 'retirada'}`)
  if (estado.formaPagamento) partes.push(`Pagamento: ${estado.formaPagamento}`)
  return partes.join('\n')
}
