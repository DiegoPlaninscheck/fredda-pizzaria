'use client'

import { useState, useEffect } from 'react'

interface Categoria {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
  _count: { insumos: number }
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [incluirInativas, setIncluirInativas] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  async function carregarCategorias() {
    setLoading(true)
    const res = await fetch(`/api/categorias?incluirInativas=${incluirInativas}`)
    if (res.ok) setCategorias(await res.json())
    else setErro('Erro ao carregar categorias')
    setLoading(false)
  }

  useEffect(() => { carregarCategorias() }, [incluirInativas])

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setDescricao('')
    setErroForm('')
    setShowForm(true)
  }

  function abrirEditar(cat: Categoria) {
    setEditando(cat)
    setNome(cat.nome)
    setDescricao(cat.descricao || '')
    setErroForm('')
    setShowForm(true)
  }

  function cancelar() {
    setShowForm(false)
    setEditando(null)
    setErroForm('')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { setErroForm('Nome é obrigatório'); return }
    setSalvando(true)
    setErroForm('')

    const url = editando ? `/api/categorias/${editando.id}` : '/api/categorias'
    const method = editando ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, descricao }),
    })

    if (res.ok) {
      setShowForm(false)
      carregarCategorias()
    } else {
      const data = await res.json()
      setErroForm(data.error || 'Erro ao salvar')
    }
    setSalvando(false)
  }

  async function inativar(cat: Categoria) {
    if (cat._count.insumos > 0) {
      alert(`Não é possível inativar: categoria possui ${cat._count.insumos} insumo(s) ativo(s) vinculado(s).`)
      return
    }
    if (!confirm(`Inativar categoria "${cat.nome}"?`)) return
    const res = await fetch(`/api/categorias/${cat.id}`, { method: 'DELETE' })
    if (res.ok) carregarCategorias()
    else {
      const data = await res.json()
      alert(data.error || 'Erro ao inativar')
    }
  }

  async function reativar(cat: Categoria) {
    if (!confirm(`Reativar categoria "${cat.nome}"?`)) return
    const res = await fetch(`/api/categorias/${cat.id}`, { method: 'PATCH' })
    if (res.ok) carregarCategorias()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-500 mt-1">Organize os insumos por categoria</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirInativas}
              onChange={(e) => setIncluirInativas(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Mostrar inativas
          </label>
          <button
            onClick={abrirNovo}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nova Categoria
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editando ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Ex: Farinhas e Grãos"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Descrição opcional"
                maxLength={255}
              />
            </div>
            {erroForm && <p className="text-sm text-red-600">{erroForm}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={salvando}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={cancelar}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : erro ? (
        <p className="text-red-600 text-sm">{erro}</p>
      ) : categorias.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Nenhuma categoria encontrada</p>
          <p className="text-sm mt-1">Clique em &quot;Nova Categoria&quot; para começar</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Insumos</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.map((cat) => (
                <tr key={cat.id} className={`hover:bg-gray-50 transition-colors ${!cat.ativo ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.nome}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{cat.descricao || '—'}</td>
                  <td className="px-6 py-4 text-sm text-center text-gray-700">{cat._count.insumos}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cat.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {cat.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    {cat.ativo ? (
                      <>
                        <button
                          onClick={() => abrirEditar(cat)}
                          className="text-sm text-brand-600 hover:text-brand-800 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => inativar(cat)}
                          className="text-sm text-red-500 hover:text-red-700 font-medium"
                        >
                          Inativar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => reativar(cat)}
                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                      >
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
