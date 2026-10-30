import type { ReactNode } from 'react'

/** Cabeçalho padrão das telas do painel: título, subtítulo e ações à direita. */
export function PageHeader({ titulo, subtitulo, acoes }: { titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold text-brand-900">{titulo}</h1>
        {subtitulo && <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}
