export function toNumberOrUndefined(value: string): number | undefined {
  const v = value.trim()
  if (!v) return undefined
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

export function toIntOrUndefined(value: string): number | undefined {
  const n = toNumberOrUndefined(value)
  if (n === undefined) return undefined
  const i = Math.trunc(n)
  return Number.isFinite(i) ? i : undefined
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${file.type};base64,${btoa(binary)}`
}

export function formatMoneyBRL(value?: number): string {
  if (value === undefined) return ''
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  } catch {
    return String(value)
  }
}

