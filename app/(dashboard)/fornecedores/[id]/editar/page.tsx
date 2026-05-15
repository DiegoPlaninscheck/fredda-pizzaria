'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function EditarFornecedorPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    nome: '',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
    ativo: true,
  })

  useEffect(() => {
    fetch(`/api/fornecedores/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          nome: data.nome || '',
          cnpj: data.cnpj || '',
          telefone: data.telefone || '',
          email: data.email || '',
          endereco: data.endereco || '',
          ativo: data.ativo,
        })
        setCarregando(false)
      })
  }, [id])

  function set(campo: string, valor: string | boolean) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    setSalvando(true)
    setErro('')

    const res = await fetch(`/api/fornecedores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      router.push('/fornecedores')
    } else {
      const data = await res.json()
      setErro(data.error || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  if (carregando) return <p className="text-gray-500 text-sm">Carregando...</p>

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/fornecedores" className="text-sm text-gray-500 hover:text-gray-700">
          ← Fornecedores
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Editar Fornecedor</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
            <input
              type="text"
              value={form.cnpj}
              onChange={(e) => set('cnpj', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input
              type="text"
              value={form.endereco}
              onChange={(e) => set('endereco', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={form.ativo}
              onChange={(e) => set('ativo', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="ativo" className="text-sm text-gray-700">Fornecedor ativo</label>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <Link
              href="/fornecedores"
              className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
