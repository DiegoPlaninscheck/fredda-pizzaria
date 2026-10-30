'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  BookOpen, CircleDollarSign, LayoutDashboard, LineChart, LogOut, Menu, Package, ShoppingBag, Tags, Timer, Truck, X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/components/ui/cn'

interface ItemNav {
  href: string
  label: string
  icone: LucideIcon
  badge?: number
}

// Os contadores também mudam sem navegação (pedidos novos pelo WhatsApp)
const INTERVALO_CONTADORES_MS = 30_000

/** Evento para as telas pedirem a atualização dos contadores logo após uma ação. */
export const EVENTO_CONTADORES = 'fredda:atualizar-contadores'

function iniciais(nome?: string | null) {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [alertas, setAlertas] = useState(0)
  const [pedidosAguardando, setPedidosAguardando] = useState(0)
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    function carregarContadores() {
      fetch('/api/insumos?alerta=true')
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAlertas(Array.isArray(data) ? data.length : 0))
        .catch(() => {})
      fetch('/api/pedidos/resumo')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => setPedidosAguardando(data ? data.pendentes + data.conversasAguardando : 0))
        .catch(() => {})
    }
    carregarContadores()
    const intervalo = setInterval(carregarContadores, INTERVALO_CONTADORES_MS)
    window.addEventListener(EVENTO_CONTADORES, carregarContadores)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener(EVENTO_CONTADORES, carregarContadores)
    }
  }, [pathname])

  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  const grupos: { titulo: string; itens: ItemNav[] }[] = [
    {
      titulo: 'Operação',
      itens: [
        { href: '/dashboard', label: 'Dashboard', icone: LayoutDashboard },
        { href: '/pedidos', label: 'Pedidos', icone: ShoppingBag, badge: pedidosAguardando },
        { href: '/vendas', label: 'Vendas', icone: CircleDollarSign },
      ],
    },
    {
      titulo: 'Produção',
      itens: [
        { href: '/producao', label: 'Produção', icone: Timer },
        { href: '/planejamento', label: 'Planejamento', icone: LineChart },
        { href: '/receitas', label: 'Receitas', icone: BookOpen },
      ],
    },
    {
      titulo: 'Cadastros',
      itens: [
        { href: '/estoque', label: 'Estoque', icone: Package, badge: alertas },
        { href: '/fornecedores', label: 'Fornecedores', icone: Truck },
        { href: '/categorias', label: 'Categorias', icone: Tags },
      ],
    },
  ]

  const ativo = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 bg-brand-900 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Image src="/fredda_pizzaria.png" alt="Fredda Pizzaria" width={30} height={30} className="rounded-lg" />
          <span className="font-display font-bold text-creme-100 text-lg">pizza fredda</span>
        </div>
        <button
          type="button"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((v) => !v)}
          className="p-2 -mr-2 text-creme-200 hover:text-creme-100"
        >
          {menuAberto ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
        </button>
      </header>

      {menuAberto && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMenuAberto(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-brand-900 text-creme-300 flex flex-col transform transition-transform duration-200 ease-in-out',
          'md:sticky md:top-0 md:h-screen md:z-auto md:w-60 md:translate-x-0',
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <Image src="/fredda_pizzaria.png" alt="Fredda Pizzaria" width={40} height={40} className="rounded-xl" />
          <div className="leading-tight">
            <p className="font-display font-bold text-creme-100 text-xl">pizza fredda</p>
            <p className="text-xs text-creme-400">Gestão</p>
          </div>
        </div>

        <nav aria-label="Navegação do painel" className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-creme-500">{g.titulo}</p>
              <div className="space-y-0.5">
                {g.itens.map(({ href, label, icone: Icone, badge }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={ativo(href) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                      ativo(href) ? 'bg-creme-200 text-brand-900 font-semibold' : 'hover:bg-white/5 hover:text-creme-100'
                    )}
                  >
                    <Icone className="w-[18px] h-[18px] flex-none" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {badge ? (
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold',
                        ativo(href) ? 'bg-brand-900 text-creme-100' : 'bg-creme-200 text-brand-900'
                      )}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
          <span aria-hidden="true" className="flex-none w-9 h-9 rounded-full bg-creme-200 text-brand-900 text-sm font-bold inline-flex items-center justify-center">
            {iniciais(session?.user?.name)}
          </span>
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-sm font-semibold text-creme-100 truncate">{session?.user?.name ?? '—'}</p>
            <p className="text-xs text-creme-400">{session?.user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
          </div>
          <button
            type="button"
            aria-label="Sair"
            title="Sair"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex-none w-9 h-9 rounded-xl border border-white/15 inline-flex items-center justify-center hover:bg-white/5 hover:text-creme-100"
          >
            <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  )
}
