import type { ReactNode } from 'react'
import { cn } from './cn'

/** Pílula de status; a cor vem dos mapas de estilo de cada tela (ex.: STATUS_PEDIDO_STYLE). */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', className)}>
      {children}
    </span>
  )
}
