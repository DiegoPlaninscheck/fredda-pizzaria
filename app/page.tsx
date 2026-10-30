import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { Clock, Flame, Snowflake, Wheat } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import anatomia from '@/public/marketing/anatomia.jpg'
import blume from '@/public/marketing/blume-con-cipolla.jpg'
import retirada from '@/public/marketing/retirada-vila-nova.jpg'

const WHATSAPP_NUMERO = '5547991432494'
const WHATSAPP_EXIBICAO = '47 99143-2494'
const WHATSAPP_MENSAGEM = 'Olá! Gostaria de fazer um pedido na Fredda Pizzaria 🍕'
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`
const INSTAGRAM = 'https://www.instagram.com/fredda.pizza/'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'Fredda Pizzaria · pizza contemporânea congelada',
  description:
    'Pizzas de 30 cm com massa de 48h de maturação, farinha e tomate italianos, assadas em pedra e congeladas a -20°. Peça pelo WhatsApp e retire na Vila Nova, em Jaraguá do Sul.',
  openGraph: {
    title: 'Fredda Pizzaria',
    description: 'Pizza de fermentação lenta, pronta pra assar em casa. Peça pelo WhatsApp.',
    images: [{ url: '/marketing/anatomia.jpg', width: anatomia.width, height: anatomia.height }],
    locale: 'pt_BR',
    type: 'website',
  },
}

// Etiquetas do cardápio impresso da Fredda (a receita ainda não tem esse campo no banco)
const ETIQUETAS: Record<string, string> = {
  Margherita: 'Vegetariana',
  Zucchini: 'Vegetariana',
  'Quattro Formaggi': 'Vegetariana',
  'Salsiccia al Gorgo': 'Bianca · sem tomate',
  'Due Amori': 'Doce',
  'Dolce di Bosco': 'Doce',
}

const DIFERENCIAIS = [
  { icone: Wheat, titulo: 'Farinha e tomate italianos', texto: 'Ingredientes frescos e de primeira' },
  { icone: Clock, titulo: '48h de maturação', texto: 'Bordas aeradas e leves' },
  { icone: Flame, titulo: '30 cm, forno de pedra', texto: 'Forneada a 420 °C' },
  { icone: Snowflake, titulo: 'Embalada a vácuo, -20°', texto: 'Congela sem perder o sabor' },
]

const PASSOS = [
  'Tire sua Fredda do congelador e deixe em temperatura ambiente de 30 a 40 minutos.',
  'Pré-aqueça o forno na temperatura máxima por 15 minutos. Depois, diminua para 210 °C.',
  'Retire da embalagem e umedeça as bordas com água. Esta etapa é muito importante.',
  'Coloque a pizza direto na grade do forno, sem assadeira.',
  'Asse até o queijo derreter, de 5 a 7 minutos, conforme o seu forno.',
]

const preco = (v: unknown) => {
  const n = Number(v)
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`
}

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect('/dashboard')
  }

  const pizzas = await prisma.receita.findMany({
    where: { ativo: true, precoVenda: { not: null } },
    orderBy: [{ precoVenda: 'asc' }, { nome: 'asc' }],
    select: { id: true, nome: true, descricao: true, precoVenda: true },
  })

  return (
    <div className="min-h-screen bg-creme-50 text-gray-900">
      <header className="sticky top-0 z-20 bg-brand-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <a href="#topo" className="flex items-center gap-3">
            <Image src="/fredda_pizzaria.png" alt="Fredda Pizzaria" width={42} height={42} className="rounded-xl" priority />
            <span className="font-display text-2xl font-bold text-creme-200">pizza fredda</span>
          </a>
          <nav aria-label="Seções" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-creme-200">
            <a href="#cardapio" className="hover:text-creme-100">Cardápio</a>
            <a href="#preparo" className="hover:text-creme-100">Como preparar</a>
            <a href="#retirada" className="hover:text-creme-100">Retirada</a>
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="hidden sm:inline hover:text-creme-100">@fredda.pizza</a>
            <Link href="/login" className="px-4 py-1.5 rounded-full border border-creme-200/70 font-medium hover:bg-white/5">Entrar</Link>
          </nav>
        </div>
      </header>

      <section id="topo" className="bg-brand-900 text-creme-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-creme-200">Contemporânea · Congelada</p>
            <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[1.05] mt-5">
              Pizza de fermentação lenta, pronta pra assar em casa.
            </h1>
            <p className="mt-6 text-lg text-creme-300 max-w-xl leading-relaxed">
              Massa com 48h de maturação refrigerada, farinha 00 e tomate italianos, assada em pedra a 420 °C e congelada a -20°.
              No seu forno, fica pronta em 7 minutos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-creme-200 text-brand-900 font-semibold hover:bg-creme-100 transition-colors"
              >
                <WhatsAppIcon className="w-5 h-5" />
                Pedir pelo WhatsApp
              </a>
              <a href="#cardapio" className="inline-flex items-center px-6 py-3.5 rounded-full border border-white/25 text-creme-200 font-semibold hover:bg-white/5">
                Ver cardápio
              </a>
            </div>
            <p className="mt-5 text-sm text-creme-400">{WHATSAPP_EXIBICAO} · Retirada na Vila Nova, Jaraguá do Sul</p>
          </div>
          <Image
            src={anatomia}
            alt="Anatomia de uma Fredda: farinha 00 italiana Molino Caputo, bordas aeradas por 48h de fermentação, 30 cm de diâmetro, forneada em pedra a 420 graus e molho de tomate italiano fresco"
            placeholder="blur"
            priority
            sizes="(min-width: 1024px) 520px, 100vw"
            className="w-full max-w-[520px] h-auto mx-auto rounded-3xl"
          />
        </div>
      </section>

      <section aria-label="Diferenciais" className="bg-creme-100 border-b border-creme-200/60">
        <ul className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {DIFERENCIAIS.map(({ icone: Icone, titulo, texto }) => (
            <li key={titulo} className="flex gap-3.5">
              <Icone className="w-7 h-7 flex-none text-brand-700" strokeWidth={1.7} aria-hidden="true" />
              <div>
                <p className="font-semibold">{titulo}</p>
                <p className="text-sm text-gray-600 mt-0.5">{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Destaque da casa">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid gap-12 lg:grid-cols-2 items-center">
          <Image
            src={blume}
            alt="Pizza Blume con Cipolla ao lado dos ingredientes: molho de tomate, muçarela, linguiça blumenau, cebola roxa e pimentões"
            placeholder="blur"
            sizes="(min-width: 1024px) 560px, 100vw"
            className="w-full h-auto rounded-3xl"
          />
          <div>
            <p className="text-sm font-semibold tracking-[0.25em] uppercase text-brand-700">Destaque da casa</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-brand-900 mt-4">Blume con Cipolla</h2>
            <p className="mt-5 text-lg text-gray-700 leading-relaxed">
              Molho de tomates italianos da casa, mozzarella, linguiça blumenau Olho®, cebola roxa e parmesão.
              O sabor de Santa Catarina na nossa massa de longa fermentação.
            </p>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-brand-900 text-creme-100 font-semibold hover:bg-brand-800"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Quero essa
            </a>
          </div>
        </div>
      </section>

      <section id="cardapio" aria-label="Cardápio" className="bg-creme-100 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <p className="text-sm font-semibold tracking-[0.25em] uppercase text-brand-700">Nosso cardápio</p>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-brand-900 mt-3">
            {pizzas.length > 0 ? `${pizzas.length} sabores, todos com 30 cm` : 'Cardápio'}
          </h2>

          {pizzas.length === 0 ? (
            <p className="mt-6 text-gray-600">Cardápio em breve.</p>
          ) : (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pizzas.map((pizza) => (
                <li key={pizza.id} className="bg-white border border-creme-200/70 rounded-2xl p-6 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-2xl font-bold text-brand-900">{pizza.nome}</h3>
                    <span className="font-display text-2xl font-bold text-brand-700 whitespace-nowrap">{preco(pizza.precoVenda)}</span>
                  </div>
                  {pizza.descricao && <p className="text-sm text-gray-600 leading-relaxed flex-1">{pizza.descricao}</p>}
                  {ETIQUETAS[pizza.nome] && (
                    <span className="self-start text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-brand-50 text-brand-700">
                      {ETIQUETAS[pizza.nome]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="preparo" aria-label="Como preparar" className="bg-brand-900 text-creme-100 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <p className="text-sm font-semibold tracking-[0.25em] uppercase text-creme-200">Do congelador à mesa</p>
          <h2 className="font-display text-4xl sm:text-5xl font-bold mt-3">Preparando sua Fredda</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PASSOS.map((passo, i) => (
              <li key={passo} className="border border-white/15 rounded-2xl p-5">
                <span className="font-display text-4xl font-bold text-creme-200">{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-3 text-creme-300 leading-relaxed">{passo}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-creme-400">
            Pizzas doces: coloque o chocolate só quando faltar 1 minuto para a pizza ficar pronta, nunca desde o início.
          </p>
        </div>
      </section>

      <section id="retirada" aria-label="Retirada" className="scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <p className="text-sm font-semibold tracking-[0.25em] uppercase text-brand-700">Bem pertinho de você</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-brand-900 mt-4 leading-tight">
              Retirada na Vila Nova, em Jaraguá do Sul
            </h2>
            <p className="mt-5 text-lg text-gray-700 leading-relaxed">
              Faça o pedido pelo WhatsApp, escolha os sabores e combine o melhor horário para retirar.
              Suas pizzas ficam separadas e congeladas esperando por você.
            </p>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-brand-900 text-creme-100 font-semibold hover:bg-brand-800"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Combinar retirada
            </a>
          </div>
          <Image
            src={retirada}
            alt="Mapa da região da Vila Nova, em Jaraguá do Sul, onde fica o endereço de retiradas"
            placeholder="blur"
            sizes="(min-width: 1024px) 420px, 100vw"
            className="w-full max-w-[420px] h-auto mx-auto rounded-3xl"
          />
        </div>
      </section>

      <section className="bg-brand-700 text-creme-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-bold">Bateu a fome?</h2>
          <p className="mt-3 text-brand-50">Mande um oi no WhatsApp. Nosso atendimento monta o pedido com você em poucos minutos.</p>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-creme-200 text-brand-900 font-semibold hover:bg-creme-100"
          >
            <WhatsAppIcon className="w-5 h-5" />
            Pedir pelo WhatsApp · {WHATSAPP_EXIBICAO}
          </a>
        </div>
      </section>

      <footer className="bg-brand-900 text-creme-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 flex flex-wrap items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2.5">
            <Image src="/fredda_pizzaria.png" alt="" width={28} height={28} className="rounded-md" />
            © {new Date().getFullYear()} Fredda Pizzaria
          </span>
          <span className="flex flex-wrap gap-5 text-creme-200">
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="hover:text-creme-100">@fredda.pizza</a>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-creme-100">{WHATSAPP_EXIBICAO}</a>
            <Link href="/login" className="hover:text-creme-100">Área da equipe</Link>
          </span>
        </div>
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
