// ─────────────────────────────────────────────────────────────────────────────
// Minimal, dependency-free QR Code generator.
// Scope: byte mode, error-correction level L, versions 1–6 (single data block),
// fixed mask pattern 0. That's plenty for a short invite URL (~136 bytes at v6).
//
// Any single mask produces a scannable code as long as the 15-bit format
// information encodes that same mask + EC level, so we skip penalty-based mask
// selection entirely and always use mask 0.
// Reference algorithm: Nayuki's "QR Code generator" (public domain), trimmed.
// ─────────────────────────────────────────────────────────────────────────────

// ── GF(256), primitive polynomial 0x11d ──
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(function initGaloisField() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]
}

function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i])
      next[j + 1] ^= poly[j]
    }
    poly = next
  }
  return poly // length degree+1, leading coeff 1
}

function rsEncode(data: number[], ecCount: number): number[] {
  const gen = rsGenerator(ecCount)
  const res = new Array(ecCount).fill(0)
  for (const byte of data) {
    const factor = byte ^ res[0]
    res.shift()
    res.push(0)
    for (let i = 0; i < ecCount; i++) res[i] ^= gfMul(gen[i + 1], factor)
  }
  return res
}

// data codewords / EC codewords per version at level L (all single-block)
const CAP: Record<number, { data: number; ec: number }> = {
  1: { data: 19, ec: 7 },
  2: { data: 34, ec: 10 },
  3: { data: 55, ec: 15 },
  4: { data: 80, ec: 20 },
  5: { data: 108, ec: 26 },
  6: { data: 136, ec: 36 },
}

// Alignment-pattern centre coordinates per version (versions 2–6 → one pattern)
const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
}

const bit = (x: number, i: number) => ((x >> i) & 1) === 1

/** Encode `text` to a boolean matrix (true = dark). Throws if too long for v6. */
export function generateQrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))

  // Pick the smallest version whose data capacity fits mode+count+payload.
  let version = 0
  for (let v = 1; v <= 6; v++) {
    const needBits = 4 + 8 + bytes.length * 8 // byte mode + 8-bit count + data
    if (needBits <= CAP[v].data * 8) { version = v; break }
  }
  if (version === 0) throw new Error('QR payload too long')

  const { data: dataCW, ec: ecCount } = CAP[version]

  // ── Build the bit stream ──
  const bits: number[] = []
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1)
  }
  push(0b0100, 4)          // byte mode
  push(bytes.length, 8)    // character count (8 bits for v1–9)
  for (const b of bytes) push(b, 8)

  const capacityBits = dataCW * 8
  push(0, Math.min(4, capacityBits - bits.length)) // terminator
  while (bits.length % 8 !== 0) bits.push(0)        // byte-align
  const PAD = [0xec, 0x11]
  for (let i = 0; bits.length < capacityBits; i++) push(PAD[i % 2], 8)

  // Pack to data codewords, append Reed-Solomon EC codewords.
  const codewords: number[] = []
  for (let i = 0; i < dataCW; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b]
    codewords.push(byte)
  }
  const all = codewords.concat(rsEncode(codewords, ecCount))

  // ── Build the matrix ──
  const size = version * 4 + 17
  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const set = (r: number, c: number, dark: boolean) => { m[r][c] = dark; fn[r][c] = true }

  // Timing patterns (drawn first; finders overwrite the ends).
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }

  // Three finder patterns + separators.
  const finder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr, c = left + dc
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        const inner = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const dark = inner && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
        set(r, c, dark)
      }
    }
  }
  finder(0, 0)
  finder(0, size - 7)
  finder(size - 7, 0)

  // Alignment patterns (skip any centre already claimed by timing/finder).
  const coords = ALIGN[version]
  for (const cr of coords) {
    for (const cc of coords) {
      if (fn[cr][cc]) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc))
          set(cr + dr, cc + dc, ring !== 1)
        }
      }
    }
  }

  // Format information (EC level L = 0b01, mask 0), with BCH(15,5) + mask 0x5412.
  const fmtData = (1 << 3) | 0
  let rem = fmtData
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537)
  const fmt = ((fmtData << 10) | rem) ^ 0x5412
  for (let i = 0; i <= 5; i++) set(8, i, bit(fmt, i))
  set(8, 7, bit(fmt, 6))
  set(8, 8, bit(fmt, 7))
  set(7, 8, bit(fmt, 8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fmt, i))
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fmt, i))
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fmt, i))
  set(size - 8, 8, true) // always-dark module

  // ── Place data codewords in the zig-zag, applying mask 0 as we go ──
  let idx = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5 // skip the timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j
        const upward = ((right + 1) & 2) === 0
        const row = upward ? size - 1 - vert : vert
        if (fn[row][col]) continue
        let dark = false
        if (idx < all.length * 8) {
          dark = bit(all[idx >> 3], 7 - (idx & 7))
          idx++
        }
        // Mask 0: invert where (row + col) is even.
        if ((row + col) % 2 === 0) dark = !dark
        m[row][col] = dark
      }
    }
  }

  return m
}
