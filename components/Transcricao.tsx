export interface MensagemTranscricao {
  id: string
  direcao: 'ENTRADA' | 'SAIDA'
  texto: string
  createdAt: string
}

/**
 * Separa as opções que `paraTranscricao` (lib/chatbot/mensagens.ts) grava no fim
 * das mensagens com botões ou lista: "texto\n[Opção A | Opção B]".
 */
function separarOpcoes(texto: string): { corpo: string; opcoes: string[] } {
  const m = texto.match(/^([\s\S]*)\n\[([^\]\n]+)\]$/)
  if (!m) return { corpo: texto, opcoes: [] }
  return { corpo: m[1], opcoes: m[2].split(' | ').map((o) => o.trim()).filter(Boolean) }
}

/** Conversa do WhatsApp em formato de balões (cliente à esquerda, Fredda à direita). */
export default function Transcricao({ mensagens }: { mensagens: MensagemTranscricao[] }) {
  if (mensagens.length === 0) {
    return <p className="text-sm text-gray-400">Nenhuma mensagem registrada.</p>
  }

  return (
    <div className="space-y-2 bg-creme-50 rounded-xl p-3 max-h-[32rem] overflow-y-auto">
      {mensagens.map((m) => {
        const saida = m.direcao === 'SAIDA'
        const { corpo, opcoes } = saida ? separarOpcoes(m.texto) : { corpo: m.texto, opcoes: [] }
        return (
          <div key={m.id} className={`flex ${saida ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                saida
                  ? 'bg-brand-50 text-brand-900 rounded-2xl rounded-br-md'
                  : 'bg-white text-gray-900 border border-[#e7e1cf] rounded-2xl rounded-bl-md'
              }`}
            >
              {corpo}
              {opcoes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 whitespace-normal">
                  {opcoes.map((o) => (
                    <span key={o} className="text-xs font-semibold px-2.5 py-1 rounded-full border border-brand-200 bg-white text-brand-700">
                      {o}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1 text-right">
                {new Date(m.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
