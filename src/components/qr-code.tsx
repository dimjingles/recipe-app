import { generateQrMatrix } from '@/lib/qr'

/** Renders a scannable QR code as crisp SVG. Pure — safe in any component. */
export function QRCode({ value, size = 200, className }: { value: string; size?: number; className?: string }) {
  let matrix: boolean[][]
  try {
    matrix = generateQrMatrix(value)
  } catch {
    return null
  }
  const n = matrix.length
  const quiet = 4
  const dim = n + quiet * 2

  const path: string[] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) path.push(`M${c + quiet} ${r + quiet}h1v1h-1z`)
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={path.join('')} fill="#000000" />
    </svg>
  )
}
