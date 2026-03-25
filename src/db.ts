import Dexie, { type Table } from 'dexie'

export type Product = {
  id?: number
  nome?: string
  tamanho?: string
  tipo?: string
  quantidade?: number
  valor?: number
  cor?: string
  colmeia?: string
  fotoDataUrl?: string
  criadoEm: number
  atualizadoEm: number
}

export type Sale = {
  id?: number
  produtoId: number
  quantidade: number
  valorUnitario?: number
  criadoEm: number
}

class EstoqueDB extends Dexie {
  produtos!: Table<Product, number>
  vendas!: Table<Sale, number>

  constructor() {
    super('estoque_fran_fashion')
    this.version(1).stores({
      produtos:
        '++id, nome, tipo, tamanho, cor, colmeia, quantidade, valor, criadoEm, atualizadoEm',
      vendas: '++id, produtoId, criadoEm',
    })
  }
}

export const db = new EstoqueDB()

