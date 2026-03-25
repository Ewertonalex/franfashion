import './App.css'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { db, type Product, type Sale } from './db'
import { fileToDataUrl, formatMoneyBRL, toIntOrUndefined, toNumberOrUndefined } from './utils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

type Aba = 'produtos' | 'vendas' | 'dashboard' | 'relatorio' | 'backup' | 'sobre'

function monthKeyFromMs(ms: number) {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthLabelPtBR(key: string) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

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

function FinanceiroDashboard() {
  const [range, setRange] = useState<'3' | '6' | '12' | 'ano'>('6')
  const [ano, setAno] = useState<number>(() => new Date().getFullYear())

  const produtos = useLiveQuery(() => db.produtos.toArray(), [])
  const vendas = useLiveQuery(() => db.vendas.orderBy('criadoEm').toArray(), [])

  const produtosById = useMemo(() => {
    const m = new Map<number, Product>()
    for (const p of produtos ?? []) if (p.id) m.set(p.id, p)
    return m
  }, [produtos])

  const totais = useMemo(() => {
    const ps = produtos ?? []
    const qtdItens = ps.reduce((acc, p) => acc + (p.quantidade ?? 0), 0)
    const valorTotal = ps.reduce((acc, p) => acc + (p.quantidade ?? 0) * (p.valor ?? 0), 0)
    const skus = ps.length
    return { qtdItens, valorTotal, skus }
  }, [produtos])

  const vendasPorMes = useMemo(() => {
    const vs = vendas ?? []
    const map = new Map<string, Sale[]>()
    for (const v of vs) {
      const key = monthKeyFromMs(v.criadoEm)
      const arr = map.get(key) ?? []
      arr.push(v)
      map.set(key, arr)
    }
    const keys = Array.from(map.keys()).sort()
    return { map, keys }
  }, [vendas])

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>()
    for (const k of vendasPorMes.keys) set.add(Number(k.slice(0, 4)))
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [vendasPorMes.keys])

  const mesesFiltrados = useMemo(() => {
    const keys = vendasPorMes.keys
    if (range === 'ano') return keys.filter((k) => Number(k.slice(0, 4)) === ano)
    const n = Number(range)
    return keys.slice(Math.max(0, keys.length - n))
  }, [vendasPorMes.keys, range, ano])

  const mesAtualKey = useMemo(() => monthKeyFromMs(Date.now()), [])
  const totalVendasMesAtual = useMemo(() => {
    const vs = vendasPorMes.map.get(mesAtualKey) ?? []
    return vs.reduce((acc, v) => acc + v.quantidade * (v.valorUnitario ?? produtosById.get(v.produtoId)?.valor ?? 0), 0)
  }, [vendasPorMes.map, mesAtualKey, produtosById])

  const chartData = useMemo(() => {
    const labels = mesesFiltrados.map(monthLabelPtBR)
    const valores = mesesFiltrados.map((k) => {
      const vs = vendasPorMes.map.get(k) ?? []
      return vs.reduce((acc, v) => acc + v.quantidade * (v.valorUnitario ?? produtosById.get(v.produtoId)?.valor ?? 0), 0)
    })
    return {
      labels,
      datasets: [
        {
          label: 'Vendas (R$)',
          data: valores,
          tension: 0.35,
          fill: true,
        },
      ],
    }
  }, [mesesFiltrados, vendasPorMes.map, produtosById])

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => formatMoneyBRL(Number(ctx.parsed?.y ?? 0)),
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (v: any) => {
              const n = Number(v)
              if (!Number.isFinite(n)) return v
              return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(n)
            },
          },
        },
      },
    } as const
  }, [])

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Dashboard</div>
        </div>

        <div className="cardBody">
          <div className="bigNumbers">
            <div className="bigNumberCard">
              <div className="bigNumberLabel">Valor total em estoque</div>
              <div className="bigNumberValue">{formatMoneyBRL(totais.valorTotal)}</div>
              <div className="bigNumberSub">Soma de quantidade × valor de todos os produtos</div>
            </div>
            <div className="bigNumberCard">
              <div className="bigNumberLabel">Itens em estoque</div>
              <div className="bigNumberValue">{new Intl.NumberFormat('pt-BR').format(totais.qtdItens)}</div>
              <div className="bigNumberSub">{totais.skus} produto(s) cadastrados</div>
            </div>
            <div className="bigNumberCard">
              <div className="bigNumberLabel">Vendas no mês atual</div>
              <div className="bigNumberValue">{formatMoneyBRL(totalVendasMesAtual)}</div>
              <div className="bigNumberSub">{monthLabelPtBR(mesAtualKey)}</div>
            </div>
          </div>

          <div className="chartHeader">
            <div className="chartTitle">Evolução mês a mês</div>
            <div className="cardActions">
              <select value={range} onChange={(e) => setRange(e.target.value as any)}>
                <option value="3">Últimos 3 meses</option>
                <option value="6">Últimos 6 meses</option>
                <option value="12">Últimos 12 meses</option>
                <option value="ano">Selecionar ano</option>
              </select>
              {range === 'ano' ? (
                <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>

          <div className="chartWrap">
            <Line
              data={{
                ...chartData,
                datasets: chartData.datasets.map((d) => ({
                  ...d,
                  borderColor: 'rgba(170, 59, 255, 0.92)',
                  backgroundColor: 'rgba(170, 59, 255, 0.14)',
                  pointRadius: 3,
                  pointHoverRadius: 6,
                })),
              }}
              options={chartOptions}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function RelatorioMensal() {
  const mesAtualKey = useMemo(() => monthKeyFromMs(Date.now()), [])
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesAtualKey)
  const produtos = useLiveQuery(() => db.produtos.toArray(), [])
  const vendas = useLiveQuery(() => db.vendas.orderBy('criadoEm').toArray(), [])

  const produtosById = useMemo(() => {
    const m = new Map<number, Product>()
    for (const p of produtos ?? []) if (p.id) m.set(p.id, p)
    return m
  }, [produtos])

  const vendasPorMes = useMemo(() => {
    const vs = vendas ?? []
    const map = new Map<string, Sale[]>()
    for (const v of vs) {
      const key = monthKeyFromMs(v.criadoEm)
      const arr = map.get(key) ?? []
      arr.push(v)
      map.set(key, arr)
    }
    const keys = Array.from(map.keys()).sort()
    return { map, keys }
  }, [vendas])

  useEffect(() => {
    // Se o usuário nunca mudou manualmente, garante sempre mês atual como padrão.
    if (!mesSelecionado) setMesSelecionado(mesAtualKey)
  }, [mesSelecionado, mesAtualKey])

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>(vendasPorMes.keys)
    set.add(mesAtualKey)
    return Array.from(set).sort().reverse()
  }, [vendasPorMes.keys, mesAtualKey])

  const resumo = useMemo(() => {
    const key = mesSelecionado
    if (!key) return { total: 0, qtd: 0, linhas: [] as Array<{ produtoId: number; nome: string; quantidade: number; valorUnitario: number; total: number }> }
    const vs = vendasPorMes.map.get(key) ?? []
    const byProd = new Map<number, { quantidade: number; total: number; valorUnitario: number }>()
    let qtd = 0
    for (const v of vs) {
      qtd += v.quantidade
      const id = v.produtoId
      const unit = v.valorUnitario ?? produtosById.get(id)?.valor ?? 0
      const cur = byProd.get(id) ?? { quantidade: 0, total: 0, valorUnitario: unit }
      cur.quantidade += v.quantidade
      cur.total += v.quantidade * unit
      cur.valorUnitario = unit
      byProd.set(id, cur)
    }
    const linhas = Array.from(byProd.entries()).map(([produtoId, r]) => ({
      produtoId,
      nome: produtosById.get(produtoId)?.nome || '(sem nome)',
      quantidade: r.quantidade,
      valorUnitario: r.valorUnitario,
      total: r.total,
    }))
    linhas.sort((a, b) => b.total - a.total)
    const total = linhas.reduce((acc, l) => acc + l.total, 0)
    return { total, qtd, linhas }
  }, [mesSelecionado, vendasPorMes.map, produtosById])

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Relatório mensal</div>
          <div className="cardActions">
            <select value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)}>
              {mesesDisponiveis.map((k) => (
                <option key={k} value={k}>
                  {monthLabelPtBR(k)}{k === mesAtualKey ? ' (mês atual)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cardBody">
          <div className="bigNumbers twoCols">
            <div className="bigNumberCard">
              <div className="bigNumberLabel">Total vendido no mês</div>
              <div className="bigNumberValue">{formatMoneyBRL(resumo.total)}</div>
              <div className="bigNumberSub">{mesSelecionado ? monthLabelPtBR(mesSelecionado) : '—'}</div>
            </div>
            <div className="bigNumberCard">
              <div className="bigNumberLabel">Itens vendidos</div>
              <div className="bigNumberValue">{new Intl.NumberFormat('pt-BR').format(resumo.qtd)}</div>
              <div className="bigNumberSub">Somatório das vendas registradas no mês</div>
            </div>
          </div>

          {!mesSelecionado ? (
            <TextoVazio>Selecione um mês para ver o detalhamento.</TextoVazio>
          ) : resumo.linhas.length === 0 ? (
            <TextoVazio>Nenhuma venda registrada neste mês.</TextoVazio>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qtd.</th>
                    <th>Valor un.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.linhas.map((l) => (
                    <tr key={l.produtoId}>
                      <td>{l.nome}</td>
                      <td>{l.quantidade}</td>
                      <td>{formatMoneyBRL(l.valorUnitario)}</td>
                      <td>
                        <strong>{formatMoneyBRL(l.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ImportacaoExportacao() {
  const [importando, setImportando] = useState(false)
  const [mensagem, setMensagem] = useState<string>('')

  useEffect(() => {
    if (!mensagem) return
    const t = window.setTimeout(() => setMensagem(''), 7000)
    return () => window.clearTimeout(t)
  }, [mensagem])

  async function exportarBackup() {
    const tables = await Promise.all(
      db.tables.map(async (t) => {
        const rows = await t.toArray()
        return [t.name, rows] as const
      }),
    )
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      tables: Object.fromEntries(tables),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-franfashion-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setMensagem('Backup exportado com sucesso (100% do banco local).')
  }

  async function importarBackup(file: File) {
    setImportando(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as any

      const tablesObj = parsed?.tables
      const produtosImport = Array.isArray(parsed?.produtos) ? (parsed.produtos as Product[]) : []
      const vendasImport = Array.isArray(parsed?.vendas) ? (parsed.vendas as Sale[]) : []

      await db.transaction('rw', db.produtos, db.vendas, async () => {
        if (tablesObj && typeof tablesObj === 'object') {
          for (const t of db.tables) {
            const rows = (tablesObj as any)[t.name]
            if (Array.isArray(rows) && rows.length) await t.bulkPut(rows)
          }
        } else {
          // compatibilidade com backups antigos
          if (produtosImport.length) await db.produtos.bulkPut(produtosImport)
          if (vendasImport.length) await db.vendas.bulkPut(vendasImport)
        }
      })

      setMensagem('Backup importado/mesclado com sucesso.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Importação/Exportação</div>
          <div className="cardActions">
            <button className="btn primary" type="button" onClick={() => void exportarBackup()}>
              Exportar backup
            </button>
            <label className="btn ghost" style={{ position: 'relative', overflow: 'hidden' }}>
              Importar backup
              <input
                type="file"
                accept="application/json"
                disabled={importando}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  void importarBackup(f)
                  e.currentTarget.value = ''
                }}
              />
            </label>
          </div>
        </div>
        <div className="cardBody">
          <div className="hint">
            Este backup leva os dados do banco local (produtos, vendas e outras tabelas futuras). Para usar em outra máquina/celular, exporte aqui e importe no outro dispositivo.
          </div>
          {mensagem ? <div className="successBanner" role="status">{mensagem}</div> : null}
        </div>
      </div>
    </div>
  )
}

function Sobre() {
  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="cardTitle">Sobre o projeto</div>
        </div>
        <div className="cardBody prose">
          <h3>O que é</h3>
          <p>
            Este sistema é um <strong>controle de estoque + vendas</strong> para a Fran Fashion. Ele funciona no navegador e salva tudo em um{' '}
            <strong>banco local</strong> no dispositivo (PC/celular) que você está usando.
          </p>

          <h3>Importante: onde seus dados ficam salvos</h3>
          <ul>
            <li>
              Os dados ficam no <strong>próprio navegador</strong> (banco local). Atualizar o site no Netlify <strong>não apaga</strong> seus dados locais.
            </li>
            <li>
              Cada dispositivo/navegador tem um banco diferente. Para usar em outra máquina/celular, use a aba <strong>Importar/Exportar</strong>.
            </li>
          </ul>

          <h3>Passo a passo — Cadastro de produtos</h3>
          <ol>
            <li>
              Abra a aba <strong>Produtos</strong>.
            </li>
            <li>
              Clique em <strong>+ Cadastrar produto</strong>.
            </li>
            <li>
              Preencha os campos que quiser (todos são opcionais): foto, nome, tamanho, tipo, quantidade, valor, cor e <strong>colmeia</strong> (onde está guardado).
            </li>
            <li>
              Clique em <strong>Salvar</strong>.
            </li>
          </ol>
          <p>
            Para <strong>editar</strong> ou <strong>excluir</strong>, use os botões na linha do produto.
          </p>

          <h3>Passo a passo — Buscar produto</h3>
          <ol>
            <li>
              Na aba <strong>Produtos</strong>, digite no campo <strong>Pesquisar por nome…</strong>.
            </li>
            <li>
              A lista mostra nome, valor, quantidade disponível e colmeia.
            </li>
          </ol>

          <h3>Passo a passo — Registrar uma venda</h3>
          <ol>
            <li>
              Abra a aba <strong>Vendas</strong>.
            </li>
            <li>
              Pesquise e selecione o produto.
            </li>
            <li>
              Informe a <strong>quantidade vendida</strong>.
            </li>
            <li>
              Clique em <strong>Confirmar venda</strong> e confirme no modal.
            </li>
          </ol>
          <ul>
            <li>
              A venda é salva e o estoque é baixado automaticamente.
            </li>
            <li>
              Se o estoque chegar em <strong>zero</strong>, o sistema avisa.
            </li>
          </ul>

          <h3>Como usar o Dashboard</h3>
          <ul>
            <li>
              <strong>Valor total em estoque</strong>: soma de (quantidade disponível × valor) de todos os produtos.
            </li>
            <li>
              <strong>Itens em estoque</strong>: soma de todas as quantidades (total de peças disponíveis para venda).
            </li>
            <li>
              <strong>Vendas no mês atual</strong>: total vendido no mês corrente.
            </li>
            <li>
              <strong>Gráfico</strong>: evolução mês a mês (3/6/12 meses ou por ano).
            </li>
          </ul>

          <h3>Como usar o Relatório mensal</h3>
          <ul>
            <li>
              O relatório abre sempre no <strong>mês atual</strong>.
            </li>
            <li>
              Você pode selecionar outros meses para ver <strong>itens vendidos</strong>, quantidade, valor unitário e total por item.
            </li>
          </ul>

          <h3>Como não perder nada (backup)</h3>
          <p>
            Para levar seus dados para outro aparelho (ou guardar uma cópia), use a aba <strong>Importar/Exportar</strong>.
          </p>
          <ol>
            <li>
              No aparelho que tem os dados, clique em <strong>Exportar backup</strong>.
            </li>
            <li>
              No outro aparelho, clique em <strong>Importar backup</strong> e selecione o arquivo.
            </li>
          </ol>
          <p>
            O backup leva <strong>100% do banco local</strong> (produtos, vendas e demais tabelas do sistema).
          </p>

          <h3>Sincronização em nuvem (opcional)</h3>
          <p>
            Se você quiser que tudo fique igual automaticamente em qualquer dispositivo (sem exportar/importar), é necessário ligar uma{' '}
            <strong>sincronização em nuvem com login</strong> (ex.: Supabase no plano gratuito). O banco local continua funcionando mesmo assim (offline-first).
          </p>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [aba, setAba] = useState<Aba>('produtos')
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brandLogo" src="/logo-franfashion.svg" alt="Fran Fashion" />
          <div>
            <div className="brandTitle">Fran Fashion</div>
            <div className="brandSub">Estoque • Vendas • Financeiro</div>
          </div>
        </div>
        <nav className="tabs">
          <button className={`tab ${aba === 'produtos' ? 'active' : ''}`} onClick={() => setAba('produtos')} type="button">
            Produtos
          </button>
          <button className={`tab ${aba === 'vendas' ? 'active' : ''}`} onClick={() => setAba('vendas')} type="button">
            Vendas
          </button>
          <button className={`tab ${aba === 'dashboard' ? 'active' : ''}`} onClick={() => setAba('dashboard')} type="button">
            Dashboard
          </button>
          <button className={`tab ${aba === 'relatorio' ? 'active' : ''}`} onClick={() => setAba('relatorio')} type="button">
            Relatório mensal
          </button>
          <button className={`tab ${aba === 'backup' ? 'active' : ''}`} onClick={() => setAba('backup')} type="button">
            Importar/Exportar
          </button>
          <button className={`tab ${aba === 'sobre' ? 'active' : ''}`} onClick={() => setAba('sobre')} type="button">
            Sobre
          </button>
        </nav>
      </header>
      <main className="container">
        {aba === 'produtos' ? (
          <Produtos />
        ) : aba === 'vendas' ? (
          <Vendas />
        ) : aba === 'dashboard' ? (
          <FinanceiroDashboard />
        ) : aba === 'relatorio' ? (
          <RelatorioMensal />
        ) : aba === 'sobre' ? (
          <Sobre />
        ) : (
          <ImportacaoExportacao />
        )}
      </main>
      <footer className="footer">
        Dica: atualizações do sistema não apagam seus dados locais. Para usar em outro dispositivo, exporte o backup e importe no outro aparelho.
      </footer>
    </div>
  )
}

export default App
