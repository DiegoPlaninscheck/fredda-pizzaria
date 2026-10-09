/**
 * Conversa com o chatbot de pedidos pelo terminal, sem precisar do WhatsApp.
 * Usa o mesmo banco e as mesmas ferramentas do webhook — pedidos criados aqui
 * aparecem em /pedidos.
 *
 *   npm run chat                    (telefone fictício padrão)
 *   npm run chat -- 5547988887777   (simula outro cliente)
 *
 * Comandos: /nova (encerra a conversa e começa outra), /sair
 */
import readline from 'node:readline'

async function main() {
  // Evita o log de cada query do Prisma (NODE_ENV=development no .env)
  Object.assign(process.env, { NODE_ENV: 'test' })
  const { responderMensagem } = await import('@/lib/chatbot/agente')
  const { prisma } = await import('@/lib/prisma')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('Aviso: ANTHROPIC_API_KEY não definida no .env — o SDK tentará outras credenciais.\n')
  }

  const telefone = process.argv[2] || '5547999990000'
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'você › ' })
  console.log(`Chat local da Fredda — cliente ${telefone}. Digite /nova para recomeçar ou /sair para encerrar.\n`)
  // Com entrada redirecionada (ex.: printf ... | npm run chat) o readline fecha antes de terminarmos
  let fechado = false
  rl.on('close', () => { fechado = true })
  const prompt = () => { if (!fechado) rl.prompt() }
  prompt()

  for await (const linha of rl) {
    const texto = linha.trim()
    if (texto === '/sair') break
    if (!texto) {
      prompt()
      continue
    }

    if (texto === '/nova') {
      const cliente = await prisma.cliente.findUnique({ where: { telefone } })
      if (cliente) {
        await prisma.conversa.updateMany({
          where: { clienteId: cliente.id, status: { not: 'ENCERRADA' } },
          data: { status: 'ENCERRADA' },
        })
      }
      console.log('(conversa encerrada — a próxima mensagem abre uma nova)\n')
      prompt()
      continue
    }

    const { texto: resposta } = await responderMensagem({ telefone, texto, nomePerfil: 'Cliente Teste' })
    console.log(`\nfredda › ${resposta ?? '(sem resposta — conversa está com um atendente humano)'}\n`)
    prompt()
  }

  rl.close()
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
