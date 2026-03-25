import './App.css'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, type Product } from './db'
import { fileToDataUrl, formatMoneyBRL, toIntOrUndefined, toNumberOrUndefined } from './utils'

type Aba = 'produtos' | 'vendas'

function TextoVazio({ children }: { children: string }) {
  return <div className="vazio">{children}</div>
}

function ProductForm({
  inicial,
  onCancel,
  onSaved,
}: {
  inicial?: Product
  onCancel: () => void
  onSaved: () => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [tamanho, setTamanho] = useState(inicial?.tamanho ?? '')
  const [tipo, setTipo] = useState(inicial?.tipo ?? '')
  const [cor, setCor] = useState(inicial?.cor ?? '')
  const [colmeia, setColmeia] = useState(inicial?.colmeia ?? '')
  const [quantidade, setQuantidade] = useState(
    inicial?.quantidade === undefined ? '' : String(inicial.quantidade),
  )
  const [valor, setValor] = useState(
    inicial?.valor === undefined ? '' : String(inicial.valor),
  )
  const [fotoDataUrl, setFotoDataUrl] = useState(inicial?.fotoDataUrl ?? '')
  const [salvando, setSalvando] = useState(false)
  const editando = Boolean(inicial?.id)

  async function salvar() {
    setSalvando(true)
    try {
      const agora = Date.now()
      const payload: Product = {
        nome: nome.trim() || undefined,
        tamanho: tamanho.trim() || undefined,
        tipo: tipo.trim() || undefined,
        cor: cor.trim() || undefined,
        colmeia: colmeia.trim() || undefined,
        quantidade: toIntOrUndefined(quantidade),
        valor: toNumberOrUndefined(valor),
        fotoDataUrl: fotoDataUrl.trim() || undefined,
        criadoEm: inicial?.criadoEm ?? agora,
        atualizadoEm: agora,
      }
      if (inicial?.id) await db.produtos.update(inicial.id, payload)
      else await db.produtos.add(payload)
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="cardTitle">{editando ? 'Editar produto' : 'Novo produto'}</div>
        <div className="cardActions">
          <button className="btn ghost" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="btn primary" onClick={salvar} type="button" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="grid">
        <label className="field">
          <span>Foto</span>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const url = await fileToDataUrl(file)
              setFotoDataUrl(url)
            }}
          />
        </label>
        <label className="field">
          <span>Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Caneta" />
        </label>
        <label className="field">
          <span>Tamanho</span>
          <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="Ex: P / M / G" />
        </label>
        <label className="field">
          <span>Tipo</span>
          <input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ex: Papelaria" />
        </label>
        <label className="field">
          <span>Quantidade</span>
          <input inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex: 10" />
        </label>
        <label className="field">
          <span>Valor</span>
          <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 12,90" />
        </label>
        <label className="field">
          <span>Cor</span>
          <input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex: Azul" />
        </label>
        <label className="field">
          <span>Colmeia (nicho)</span>
          <input value={colmeia} onChange={(e) => setColmeia(e.target.value)} placeholder="Ex: 12" />
        </label>
      </div>

      {fotoDataUrl ? (
        <div className="preview">
          <img src={fotoDataUrl} alt="Prévia do produto" />
          <button className="btn ghost" type="button" onClick={() => setFotoDataUrl('')}>
            Remover foto
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Produtos() {
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState<Product | undefined>(undefined)
  const [criando, setCriando] = useState(false)

  const produtos = useLiveQuery(async () => {
    const busca = q.trim().toLowerCase()
    const todos = await db.produtos.orderBy('atualizadoEm').reverse().toArray()
    if (!busca) return todos
    return todos.filter((p) => (p.nome ?? '').toLowerCase().includes(busca))
  }, [q])

  async function excluir(p: Product) {
    if (!p.id) return
    const ok = window.confirm(`Excluir "${p.nome || '(sem nome)'}"?`)
    if (!ok) return
    await db.transaction('rw', db.produtos, db.vendas, async () => {
      await db.vendas.where('produtoId').equals(p.id!).delete()
      await db.produtos.delete(p.id!)
    })
  }

  async function baixar(p: Product, quantidadeBaixa: number) {
    if (!p.id) return
    const atual = p.quantidade ?? 0
    const novo = Math.max(0, atual - quantidadeBaixa)
    await db.produtos.update(p.id, { quantidade: novo, atualizadoEm: Date.now() })
    if (novo === 0) window.alert(`Estoque zerado: ${p.nome || '(sem nome)'}`)
  }

  return (
    <div className="stack">
      {criando || editando ? (
        <ProductForm
          inicial={editando}
          onCancel={() => {
            setCriando(false)
            setEditando(undefined)
          }}
          onSaved={() => {
            setCriando(false)
            setEditando(undefined)
          }}
        />
      ) : (
        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">Produtos</div>
            <div className="cardActions">
              <button className="btn primary" type="button" onClick={() => setCriando(true)}>
                + Cadastrar produto
              </button>
            </div>
          </div>
          <div className="toolbar">
            <input
              className="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar por nome…"
            />
          </div>

          {!produtos ? (
            <TextoVazio>Carregando…</TextoVazio>
          ) : produtos.length === 0 ? (
            <TextoVazio>Nenhum produto encontrado.</TextoVazio>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Valor</th>
                    <th>Qtd.</th>
                    <th>Colmeia</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="produtoCell">
                          {p.fotoDataUrl ? <img className="thumb" src={p.fotoDataUrl} alt="" /> : <div className="thumb placeholder" />}
                          <div className="produtoMeta">
                            <div className="produtoNome">{p.nome || '(sem nome)'}</div>
                            <div className="produtoSub">
                              {[p.tipo, p.tamanho, p.cor].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{formatMoneyBRL(p.valor)}</td>
                      <td>{p.quantidade ?? ''}</td>
                      <td>{p.colmeia ?? ''}</td>
                      <td>
                        <div className="rowActions">
                          <button className="btn" type="button" onClick={() => setEditando(p)}>
                            Editar
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => {
                              const raw = window.prompt('Quantidade vendida (baixar do estoque):', '1')
                              if (!raw) return
                              const n = toIntOrUndefined(raw)
                              if (!n || n <= 0) return
                              void baixar(p, n)
                            }}
                          >
                            Venda / Baixar
                          </button>
                          <button className="btn danger" type="button" onClick={() => void excluir(p)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Vendas() {
  const [busca, setBusca] = useState('')
  const [produtoId, setProdutoId] = useState<number | ''>('')
  const [quantidade, setQuantidade] = useState('1')
  const [confirmModal, setConfirmModal] = useState<{ produto: Product; quantidade: number } | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [sucesso, setSucesso] = useState('')

  const produtos = useLiveQuery(async () => {
    const todos = await db.produtos.orderBy('nome').toArray()
    const b = busca.trim().toLowerCase()
    if (!b) return todos
    return todos.filter((p) => (p.nome ?? '').toLowerCase().includes(b))
  }, [busca])

  const selecionado = useMemo(() => {
    if (!produtos) return undefined
    if (produtoId === '') return undefined
    return produtos.find((p) => p.id === produtoId)
  }, [produtos, produtoId])

  useEffect(() => {
    if (!sucesso) return
    const t = window.setTimeout(() => setSucesso(''), 6000)
    return () => window.clearTimeout(t)
  }, [sucesso])

  async function registrarVenda(produto: Product, q: number) {
    if (!produto.id) return { novo: 0, excedeu: false }

    let novo = 0
    let excedeu = false

    await db.transaction('rw', db.produtos, db.vendas, async () => {
      const fresh = await db.produtos.get(produto.id!)
      const atual = fresh?.quantidade ?? 0
      excedeu = q > atual
      novo = Math.max(0, atual - q)

      await db.vendas.add({
        produtoId: produto.id!,
        quantidade: q,
        valorUnitario: produto.valor,
        criadoEm: Date.now(),
      })
      await db.produtos.update(produto.id!, {
        quantidade: novo,
        atualizadoEm: Date.now(),
      })
    })

    return { novo, excedeu }
  }

  function pedirConfirmacao() {
    if (!selecionado?.id) return
    const q = toIntOrUndefined(quantidade) ?? 0
    if (q <= 0) return
    setConfirmModal({ produto: selecionado, quantidade: q })
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Registrar venda (baixa manual)</div>
        </div>

        <div className="grid">
          <label className="field">
            <span>Pesquisar produto</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome…" />
          </label>

          <label className="field">
            <span>Produto</span>
            <select
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Selecione…</option>
              {(produtos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome || '(sem nome)'} {p.colmeia ? `— colmeia ${p.colmeia}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Quantidade vendida</span>
            <input inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </label>
        </div>

        <div className="cardFooter">
          <div className="hint">
            {selecionado ? (
              <>
                <strong>{selecionado.nome || '(sem nome)'}</strong>
                {' · '}
                {selecionado.colmeia ? `Colmeia ${selecionado.colmeia}` : 'Sem colmeia'}
                {' · '}
                Estoque: <strong>{selecionado.quantidade ?? 0}</strong>
                {selecionado.valor !== undefined ? (
                  <>
                    {' · '}
                    Valor: <strong>{formatMoneyBRL(selecionado.valor)}</strong>
                  </>
                ) : null}
              </>
            ) : (
              'Selecione um produto para registrar a venda.'
            )}
          </div>
          <button className="btn primary" type="button" onClick={pedirConfirmacao} disabled={!selecionado}>
            Confirmar venda
          </button>
        </div>

        {sucesso ? <div className="successBanner" role="status">{sucesso}</div> : null}
      </div>

      {confirmModal ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !confirmando) setConfirmModal(null)
          }}
        >
          <div className="modal">
            <div className="modalHeader">
              <div className="modalTitle">Confirmar venda</div>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if (!confirmando) setConfirmModal(null)
                }}
                disabled={confirmando}
              >
                Fechar
              </button>
            </div>
            <div className="modalBody">
              <div className="modalLine">
                <strong>{confirmModal.produto.nome || '(sem nome)'}</strong>
                {' · '}
                Colmeia {confirmModal.produto.colmeia || '(não informada)'}
              </div>
              <div className="modalLine">
                Quantidade: <strong>{confirmModal.quantidade}</strong>
              </div>
              <div className="modalLine">
                Estoque atual: <strong>{confirmModal.produto.quantidade ?? 0}</strong>
              </div>
              {confirmModal.produto.valor !== undefined ? (
                <div className="modalLine">
                  Valor unitário: <strong>{formatMoneyBRL(confirmModal.produto.valor)}</strong>
                </div>
              ) : null}
              <div className="modalHint">Ao confirmar, a venda será salva no banco local e o estoque será baixado.</div>
            </div>
            <div className="modalFooter">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  if (!confirmando) setConfirmModal(null)
                }}
                disabled={confirmando}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={async () => {
                  if (confirmando) return
                  setConfirmando(true)
                  try {
                    const { novo, excedeu } = await registrarVenda(confirmModal.produto, confirmModal.quantidade)
                    const nome = confirmModal.produto.nome || '(sem nome)'
                    const base = `Venda registrada: ${confirmModal.quantidade} unidade(s) de ${nome}. Estoque agora: ${novo}.`
                    const extra = excedeu ? ' Obs: a quantidade excedeu o estoque e o sistema zerou.' : novo === 0 ? ' Estoque zerado.' : ''
                    setSucesso(base + extra)
                    setConfirmModal(null)
                    setQuantidade('1')
                  } finally {
                    setConfirmando(false)
                  }
                }}
                disabled={confirmando}
              >
                {confirmando ? 'Confirmando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const [aba, setAba] = useState<Aba>('produtos')
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">Estoque — Fran Fashion</div>
          <div className="brandSub">Salvo localmente neste computador</div>
        </div>
        <nav className="tabs">
          <button className={`tab ${aba === 'produtos' ? 'active' : ''}`} onClick={() => setAba('produtos')} type="button">
            Produtos
          </button>
          <button className={`tab ${aba === 'vendas' ? 'active' : ''}`} onClick={() => setAba('vendas')} type="button">
            Vendas
          </button>
        </nav>
      </header>
      <main className="container">{aba === 'produtos' ? <Produtos /> : <Vendas />}</main>
      <footer className="footer">
        Dica: para não perder nada, use sempre o mesmo navegador/perfil neste PC.
      </footer>
    </div>
  )
}

export default App
