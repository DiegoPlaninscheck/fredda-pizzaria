import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-white border border-[#e7e1cf] rounded-2xl p-5', className)} {...props} />
}

/** Título pequeno em caixa alta usado no topo dos cards ("Itens", "Conversa"...). */
export function CardTitulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</h2>
      {acao}
    </div>
  )
}
