'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, HelpCircle } from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'

export interface OpcoesConfirmacao {
  titulo: string
  /** Texto curto abaixo do título. */
  descricao?: string
  /** Consequências da ação, uma por linha ("As pizzas voltam para o estoque"). */
  itens?: string[]
  confirmar?: string
  cancelar?: string
  /** Ação destrutiva: botão vermelho e foco inicial em "Voltar". */
  perigo?: boolean
}

type Confirmar = (opcoes: OpcoesConfirmacao) => Promise<boolean>

const ConfirmContext = createContext<Confirmar | null>(null)

/** Substitui o window.confirm: `if (!(await confirmar({...}))) return` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opcoes, setOpcoes] = useState<OpcoesConfirmacao | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const focoAnterior = useRef<HTMLElement | null>(null)
  const painel = useRef<HTMLDivElement>(null)
  const botaoConfirmar = useRef<HTMLButtonElement>(null)
  const botaoVoltar = useRef<HTMLButtonElement>(null)

  const confirmar = useCallback<Confirmar>((o) => {
    resolver.current?.(false)
    focoAnterior.current = document.activeElement as HTMLElement | null
    setOpcoes(o)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const fechar = useCallback((resultado: boolean) => {
    resolver.current?.(resultado)
    resolver.current = null
    setOpcoes(null)
    focoAnterior.current?.focus?.()
  }, [])

  useEffect(() => {
    if (!opcoes) return
    ;(opcoes.perigo ? botaoVoltar : botaoConfirmar).current?.focus()

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); fechar(false) }
      if (e.key !== 'Tab' || !painel.current) return
      // Mantém o foco dentro do diálogo
      const focaveis = painel.current.querySelectorAll<HTMLElement>('button:not([disabled])')
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [opcoes, fechar])

  const Icone = opcoes?.perigo ? AlertTriangle : opcoes?.itens ? Check : HelpCircle

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {opcoes && (
        <div
          className="fixed inset-0 z-50 bg-brand-900/50 flex items-start justify-center px-4 pt-[12vh] pb-4 overflow-y-auto"
          onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(false) }}
        >
          <div
            ref={painel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmacao-titulo"
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <span className={cn(
                'flex-none w-11 h-11 rounded-xl inline-flex items-center justify-center',
                opcoes.perigo ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'
              )}>
                <Icone className="w-[22px] h-[22px]" aria-hidden="true" />
              </span>
              <h2 id="confirmacao-titulo" className="font-display text-2xl font-bold text-brand-900">{opcoes.titulo}</h2>
            </div>
            {opcoes.descricao && <p className="text-sm text-gray-600">{opcoes.descricao}</p>}
            {opcoes.itens && opcoes.itens.length > 0 && (
              <ul className="space-y-2">
                {opcoes.itens.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-gray-700">
                    <Check className="flex-none w-4 h-4 mt-0.5 text-brand-700" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button ref={botaoVoltar} variante="secundario" onClick={() => fechar(false)}>
                {opcoes.cancelar ?? 'Voltar'}
              </Button>
              <Button ref={botaoConfirmar} variante={opcoes.perigo ? 'perigoSolido' : 'primario'} onClick={() => fechar(true)}>
                {opcoes.confirmar ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>')
  return ctx
}
