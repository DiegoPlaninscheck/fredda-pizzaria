import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ToastProvider } from '@/components/ui/Toast'

/** Renderiza uma tela com os mesmos provedores do layout do painel (diálogos e avisos). */
export function renderPainel(ui: ReactElement) {
  return render(<ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider>)
}
