import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const WHATSAPP_NUMERO = '554188204504'
const WHATSAPP_MENSAGEM = 'Olá! Gostaria de fazer um pedido na Fredda Pizzaria 🍕'
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/dashboard')
  }

  const pizzas = await prisma.receita.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, descricao: true },
  })

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/fredda_pizzaria.png"
              alt="Fredda Pizzaria"
              width={40}
              height={40}
              className="rounded-lg"
              priority
            />
            <span className="text-lg font-bold text-brand-900">Fredda Pizzaria</span>
          </div>

          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-brand-700 border border-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h1 className="text-3xl sm:text-5xl font-bold text-brand-900 leading-tight">
          Pizzas de massa longa fermentação,
          <br className="hidden sm:block" /> feitas com calma.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
          Massas fermentadas por até 72 horas, direto pro seu pedido no WhatsApp.
        </p>
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white text-base font-medium rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
        >
          <WhatsAppIcon className="w-5 h-5" />
          Pedir pelo WhatsApp
        </a>
      </section>

      {/* Cardápio */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-2xl font-bold text-brand-900 mb-6">Nosso cardápio</h2>

        {pizzas.length === 0 ? (
          <p className="text-gray-500">Cardápio em breve.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pizzas.map((pizza) => (
              <div
                key={pizza.id}
                className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Placeholder de imagem — substituir quando as fotos das pizzas estiverem disponíveis */}
                <div className="h-40 bg-brand-50 flex items-center justify-center text-5xl">
                  🍕
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{pizza.nome}</h3>
                  {pizza.descricao && (
                    <p className="mt-1 text-sm text-gray-500">{pizza.descricao}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA final */}
      <section className="bg-brand-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-white">Bateu a fome?</h2>
          <p className="mt-2 text-brand-50">Fale com a gente e faça seu pedido agora mesmo.</p>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-700 text-base font-medium rounded-xl hover:bg-brand-50 transition-colors"
          >
            <WhatsAppIcon className="w-5 h-5" />
            Enviar mensagem no WhatsApp
          </a>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Fredda Pizzaria
      </footer>
    </div>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.149-.15.347-.397.521-.595.174-.198.232-.34.348-.568.116-.228.058-.427-.04-.575-.099-.15-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.05 3.133 4.977 4.27 2.928 1.139 2.928.759 3.454.71.526-.05 1.758-.719 2.006-1.413.248-.694.248-1.289.174-1.413-.074-.124-.271-.198-.57-.347z" />
      <path d="M12.004 2c-5.514 0-9.98 4.467-9.98 9.98 0 1.763.462 3.42 1.267 4.857L2 22l5.29-1.264a9.94 9.94 0 0 0 4.714 1.196h.004c5.514 0 9.98-4.467 9.98-9.98C22 6.467 17.523 2 12.004 2zm5.943 15.923a8.26 8.26 0 0 1-5.943 2.462h-.003a8.25 8.25 0 0 1-4.204-1.15l-.302-.18-3.14.75.752-3.06-.198-.316a8.23 8.23 0 0 1-1.267-4.451c0-4.564 3.716-8.28 8.284-8.28 2.213 0 4.293.865 5.856 2.43a8.226 8.226 0 0 1 2.427 5.856c0 2.213-.865 4.293-2.427 5.939z" />
    </svg>
  )
}
