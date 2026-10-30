import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'perigoSolido' | 'fantasma'

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-brand-900 text-creme-100 hover:bg-brand-800',
  secundario: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50',
  perigo: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  perigoSolido: 'bg-red-700 text-white hover:bg-red-800',
  fantasma: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
}

const TAMANHOS = {
  sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
  tamanho?: keyof typeof TAMANHOS
  /** Mostra o spinner, desabilita o botão e troca o texto por `textoCarregando` (se houver). */
  carregando?: boolean
  textoCarregando?: string
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variante = 'primario', tamanho = 'md', carregando, textoCarregando, className, disabled, children, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className
      )}
      {...props}
    >
      {carregando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {carregando && textoCarregando ? textoCarregando : children}
    </button>
  )
})
