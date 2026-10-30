'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from './cn'

type TipoToast = 'sucesso' | 'alerta' | 'erro' | 'info'

interface Toast {
  id: number
  tipo: TipoToast
  titulo: string
  descricao?: string
}

type Mostrar = (titulo: string, descricao?: string) => void

interface ToastApi {
  sucesso: Mostrar
  alerta: Mostrar
  erro: Mostrar
  info: Mostrar
}

const ToastContext = createContext<ToastApi | null>(null)

const ESTILO: Record<TipoToast, { caixa: string; icone: string; Icone: typeof Info }> = {
  sucesso: { caixa: 'bg-brand-900 text-creme-100', icone: 'bg-creme-200 text-brand-900', Icone: CheckCircle2 },
  alerta: { caixa: 'bg-white text-gray-900 border border-amber-200', icone: 'bg-amber-100 text-amber-800', Icone: AlertTriangle },
  erro: { caixa: 'bg-white text-gray-900 border border-red-200', icone: 'bg-red-100 text-red-700', Icone: XCircle },
  info: { caixa: 'bg-white text-gray-900 border border-gray-200', icone: 'bg-brand-50 text-brand-700', Icone: Info },
}

// Erros e alertas ficam mais tempo na tela: costumam pedir alguma ação
const DURACAO_MS: Record<TipoToast, number> = { sucesso: 5000, info: 5000, alerta: 9000, erro: 9000 }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const proximoId = useRef(1)

  const fechar = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const mostrar = useCallback((tipo: TipoToast, titulo: string, descricao?: string) => {
    const id = proximoId.current++
    setToasts((ts) => [...ts.slice(-3), { id, tipo, titulo, descricao }])
    setTimeout(() => fechar(id), DURACAO_MS[tipo])
  }, [fechar])

  const api = useMemo<ToastApi>(() => ({
    sucesso: (t, d) => mostrar('sucesso', t, d),
    alerta: (t, d) => mostrar('alerta', t, d),
    erro: (t, d) => mostrar('erro', t, d),
    info: (t, d) => mostrar('info', t, d),
  }), [mostrar])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="fixed top-4 right-4 left-4 sm:left-auto z-[60] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map((t) => {
          const { caixa, icone, Icone } = ESTILO[t.tipo]
          return (
            <div
              key={t.id}
              role={t.tipo === 'erro' ? 'alert' : 'status'}
              className={cn('pointer-events-auto w-full sm:w-96 flex items-start gap-3 p-4 rounded-2xl shadow-xl', caixa)}
            >
              <span className={cn('flex-none w-8 h-8 rounded-full inline-flex items-center justify-center', icone)}>
                <Icone className="w-[18px] h-[18px]" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.titulo}</p>
                {t.descricao && <p className="text-sm mt-0.5 opacity-90">{t.descricao}</p>}
              </div>
              <button type="button" aria-label="Fechar aviso" onClick={() => fechar(t.id)} className="flex-none p-1 rounded-lg opacity-70 hover:opacity-100">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
