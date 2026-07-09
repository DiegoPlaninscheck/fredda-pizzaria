'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const [alertas, setAlertas] = useState(0)
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    fetch('/api/insumos?alerta=true')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAlertas(Array.isArray(data) ? data.length : 0))
  }, [pathname])

  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/vendas', label: 'Vendas' },
    { href: '/producao', label: 'Produção' },
    { href: '/receitas', label: 'Receitas' },
    { href: '/estoque', label: 'Estoque', badge: alertas > 0 ? alertas : undefined },
    { href: '/fornecedores', label: 'Fornecedores' },
    { href: '/categorias', label: 'Categorias' },
  ]

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/fredda_pizzaria.png"
            alt="Fredda Pizzaria"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <span className="font-bold text-gray-900 text-sm">Fredda Pizzaria</span>
        </div>
        <button
          type="button"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setMenuAberto((v) => !v)}
          className="p-2 -mr-2 text-gray-600 hover:text-gray-900"
        >
          {menuAberto ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {menuAberto && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex flex-col transform transition-transform duration-200 ease-in-out md:static md:z-auto md:w-56 md:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-2.5">
          <Image
            src="/fredda_pizzaria.png"
            alt="Fredda Pizzaria"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-bold text-gray-900 text-base">Fredda Pizzaria</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, badge }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{label}</span>
              {badge !== undefined && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold bg-red-500 text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
