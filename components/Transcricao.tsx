export interface MensagemTranscricao {
  id: string
  direcao: 'ENTRADA' | 'SAIDA'
  texto: string
  createdAt: string
}

/** Conversa do WhatsApp em formato de balões (cliente à esquerda, Fredda à direita). */
export default function Transcricao({ mensagens }: { mensagens: MensagemTranscricao[] }) {
  if (mensagens.length === 0) {
    return <p className="text-sm text-gray-400">Nenhuma mensagem registrada.</p>
  }

  return (
    <div className="space-y-2 bg-gray-50 rounded-lg p-3 max-h-[32rem] overflow-y-auto">
      {mensagens.map((m) => (
        <div key={m.id} className={`flex ${m.direcao === 'SAIDA' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words ${
              m.direcao === 'SAIDA' ? 'bg-brand-50 text-brand-900' : 'bg-white text-gray-900'
            }`}
          >
            {m.texto}
            <p className="text-[10px] text-gray-400 mt-1 text-right">
              {new Date(m.createdAt).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
