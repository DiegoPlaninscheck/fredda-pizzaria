'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { MensagemSaida, Opcao } from '@/lib/chatbot/mensagens'

type Bolha =
  | { id: number; de: 'cliente'; texto: string }
  | { id: number; de: 'fredda'; msg: MensagemSaida }

let proximoId = 0

/** Texto com a formatação básica do WhatsApp (*negrito*). */
function TextoWhatsApp({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
        parte.startsWith('*') && parte.endsWith('*') && parte.length > 2
          ? <strong key={i}>{parte.slice(1, -1)}</strong>
          : <span key={i}>{parte}</span>
      )}
    </>
  )
}

function BolhaFredda({ msg, onEscolher, desabilitado }: {
  msg: MensagemSaida
  onEscolher: (opcao: Opcao) => void
  desabilitado: boolean
}) {
  const [listaAberta, setListaAberta] = useState(false)

  return (
    <div className="max-w-[85%] sm:max-w-[70%]">
      <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 text-sm text-gray-900 shadow-sm whitespace-pre-wrap break-words">
        <TextoWhatsApp texto={msg.texto} />
      </div>

      {msg.tipo === 'botoes' && (
        <div className="mt-1 grid gap-1">
          {msg.botoes.map((b) => (
            <button
              key={b.id}
              disabled={desabilitado}
              onClick={() => onEscolher(b)}
              className="bg-white rounded-lg py-2 text-sm font-medium text-sky-600 shadow-sm hover:bg-sky-50 disabled:opacity-50"
            >
              {b.titulo}
            </button>
          ))}
        </div>
      )}

      {msg.tipo === 'lista' && (
        <div className="mt-1">
          <button
            disabled={desabilitado}
            onClick={() => setListaAberta((v) => !v)}
            className="w-full bg-white rounded-lg py-2 text-sm font-medium text-sky-600 shadow-sm hover:bg-sky-50 disabled:opacity-50"
          >
            ☰ {msg.botao}
          </button>
          {listaAberta && (
            <ul className="mt-1 bg-white rounded-lg shadow-sm divide-y divide-gray-100">
              {msg.opcoes.map((o) => (
                <li key={o.id}>
                  <button
                    disabled={desabilitado}
                    onClick={() => { setListaAberta(false); onEscolher(o) }}
                    className="w-full text-left px-3 py-2 hover:bg-sky-50 disabled:opacity-50"
                  >
                    <span className="block text-sm text-gray-900">{o.titulo}</span>
                    {o.descricao && <span className="block text-xs text-gray-500">{o.descricao}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function SimuladorPage() {
  const router = useRouter()
  const [telefone, setTelefone] = useState('00011111111')
  const [bolhas, setBolhas] = useState<Bolha[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [ia, setIa] = useState<boolean | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [bolhas])

  async function chamar(corpo: Record<string, unknown>) {
    setErro('')
    setEnviando(true)
    const res = await fetch('/api/chatbot/simulador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, ...corpo }),
    })
    setEnviando(false)
    const d = await res.json()
    if (!res.ok) {
      setErro(d.error || 'Erro ao simular mensagem')
      return null
    }
    setIa(d.iaDisponivel)
    return d.saidas as MensagemSaida[]
  }

  async function enviar(mensagem: string, respostaId?: string) {
    if (!mensagem.trim() || enviando) return
    setBolhas((b) => [...b, { id: proximoId++, de: 'cliente', texto: mensagem }])
    const saidas = await chamar({ texto: mensagem, respostaId })
    if (saidas) {
      setBolhas((b) => [
        ...b,
        ...(saidas.length
          ? saidas.map((msg) => ({ id: proximoId++, de: 'fredda' as const, msg }))
          : [{ id: proximoId++, de: 'fredda' as const, msg: { tipo: 'texto' as const, texto: '(sem resposta automática — a conversa está com um atendente)' } }]),
      ])
    }
  }

  async function novaConversa() {
    if (await chamar({ novaConversa: true })) setBolhas([])
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <button onClick={() => router.push('/pedidos')} className="text-sm text-gray-500 hover:text-gray-700">← Pedidos</button>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Simulador do WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-1">
          Converse como se fosse um cliente. Os pedidos criados aqui são reais (reservam estoque e aparecem em Pedidos)
          e ficam identificados como &quot;Simulador&quot;.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Telefone de teste</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={novaConversa}
          disabled={enviando}
          className="text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          Nova conversa
        </button>
        {ia !== null && (
          <span className={`text-xs px-2 py-1 rounded-full ${ia ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
            {ia ? 'IA (plano B) ativa' : 'IA desativada — sem ANTHROPIC_API_KEY, só o menu responde'}
          </span>
        )}
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{erro}</p>}

      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div className="bg-brand-700 text-white px-4 py-3 text-sm font-semibold">Fredda Pizzaria</div>
        <div className="bg-[#efeae2] h-[28rem] overflow-y-auto p-3 space-y-2">
          {bolhas.length === 0 && (
            <p className="text-center text-xs text-gray-500 mt-8">Mande um &quot;oi&quot; para começar.</p>
          )}
          {bolhas.map((b) =>
            b.de === 'cliente' ? (
              <div key={b.id} className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[70%] bg-[#d9fdd3] rounded-lg rounded-tr-none px-3 py-2 text-sm text-gray-900 shadow-sm whitespace-pre-wrap break-words">
                  {b.texto}
                </div>
              </div>
            ) : (
              <div key={b.id} className="flex justify-start">
                <BolhaFredda msg={b.msg} desabilitado={enviando} onEscolher={(o) => enviar(o.titulo, o.id)} />
              </div>
            )
          )}
          {enviando && <p className="text-xs text-gray-500">digitando…</p>}
          <div ref={fimRef} />
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); enviar(texto); setTexto('') }}
          className="flex gap-2 bg-gray-50 p-2 border-t border-gray-200"
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Mensagem"
            className="flex-1 min-w-0 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-full"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}
