/**
 * productFuzzyMatch.ts
 *
 * Normalizes and fuzzy-matches product names from invoices (Alegra's long-form
 * names or other sources) to the canonical short names in the `productos` table.
 *
 * Problem:
 *   Alegra stores names like "Radiofrecuencia de Plasma EZ-Blator 90° AC405-405Q3-T"
 *   while the canonical ERP name is "EZ Blator 90°". The Excel historical data uses
 *   canonical names directly. We need to group both under the same canonical name.
 *
 * Strategy:
 *   1. Strip common non-discriminating prefixes ("Radiofrecuencia de Plasma", "BONSS", etc.)
 *   2. Strip trailing product reference codes (like AC405-405Q3-T, 302Q4, 405U9)
 *   3. Normalize: unify degree symbols, hyphens, spaces, casing
 *   4. Score by token set overlap (Jaccard similarity on word tokens)
 *   5. Return best match above threshold, or the original name if no match
 */

// Prefixes that appear in long-form names but NOT in canonical names
const STRIP_PREFIXES = [
  'radiofrecuencia de plasma bonss',
  'radiofrecuencia de plasma',
  'bonss',
  'instrumental bonss',
  'renta de equipo medico',
  'sistema bonss',
  'sistema de radiofrecuencia de plasma bonss',
  'sistema de radiofrecuencia de plasma',
]

// Regex to strip trailing product reference codes like:
//   AC405-405Q3-T  MC405C-405Q3H  BC404A-404Q3  302Q4  405U9  A8872T
//   DGB40WA110  DG-A40WZ411(R)  HF6518Z.014.1
// Exclude dimensions/sizes ending in MM, CM, IN, °, or º
const PRODUCT_CODE_RE = /\b(?![\w\-\.()°º]*(?:MM|CM|IN|°|º)\b)[A-Z]{1,4}[\d][A-Z0-9\-\.()]{3,}\b/g

/** Normalize degree symbols: º → °, and remove (R) annotations */
function normalizeDegrees(s: string): string {
  return s
    .replace(/º/g, '°')
    .replace(/\(r\)/gi, '')
    .replace(/\(l\)/gi, '')
}

/**
 * Core normalization pipeline:
 * - Lowercase
 * - Normalize degrees
 * - Strip product reference codes
 * - Strip known prefixes
 * - Replace hyphens with spaces
 * - Collapse whitespace
 */
export function normalizeProductName(raw: string): string {
  let s = raw.trim()
  // Split camelCase / PascalCase joined words BEFORE lowercasing
  // e.g. "TendonRX" → "Tendon RX", "SpineOQFX" → "Spine OQFX"
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2')
  // Strip product reference codes BEFORE lowercasing — regex requires uppercase letters
  // e.g. "AC405-405Q3-T", "MC405C-405Q3H", "302Q4", "DGB40WA110"
  s = s.replace(PRODUCT_CODE_RE, ' ')
  s = s.toLowerCase()
  s = normalizeDegrees(s)
  // Second pass (case-insensitive) for codes that survived (e.g. "405q3h" in BONSS names)
  // Exclude dimensions/sizes ending in mm, cm, in, °, or º
  s = s.replace(/\b(?![\w\-\.()°º]*(?:mm|cm|in|°|º)\b)[a-z]{0,4}\d[a-z0-9\-\.()]{3,}\b/g, ' ')
  // Strip prefixes (order matters — longest first)
  for (const prefix of STRIP_PREFIXES) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length)
      break
    }
  }
  // Replace hyphens with spaces (EZ-Blator → EZ Blator)
  s = s.replace(/-/g, ' ')
  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Tokenize a normalized string into a Set of word tokens */
function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(/\s+/).filter(t => t.length > 1))
}

/**
 * Jaccard similarity between two token sets.
 * Returns a value in [0, 1].
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const t of a) {
    if (b.has(t)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

export interface FuzzyMatchResult {
  /** The canonical product name to use for grouping */
  canonicalName: string
  /** The original raw name from the invoice */
  rawName: string
  /** Similarity score [0..1]; 1 means exact match after normalization */
  score: number
  /** Whether a match was found above threshold */
  matched: boolean
}

/**
 * Build a matcher from a list of canonical product names.
 * Returns a match function that can be called for each raw invoice product name.
 *
 * @param canonicalNames - All names from the `productos` table (or combined set)
 * @param threshold      - Minimum Jaccard similarity to accept a match (default 0.35)
 */
export function buildProductMatcher(
  canonicalNames: string[],
  threshold = 0.35
): (rawName: string) => FuzzyMatchResult {
  // Pre-compute normalized tokens for each canonical name
  const index: { canonical: string; normalized: string; tokens: Set<string> }[] =
    canonicalNames.map(name => {
      const normalized = normalizeProductName(name)
      return { canonical: name, normalized, tokens: tokenSet(normalized) }
    })

  // Cache results to avoid re-computing for the same raw name
  const cache = new Map<string, FuzzyMatchResult>()

  return function match(rawName: string): FuzzyMatchResult {
    if (cache.has(rawName)) return cache.get(rawName)!

    const normalizedRaw = normalizeProductName(rawName)
    const rawTokens = tokenSet(normalizedRaw)

    let bestScore = 0
    let bestCanonical = rawName // fallback to original

    for (const entry of index) {
      // Fast path: exact match after normalization
      if (entry.normalized === normalizedRaw) {
        const result: FuzzyMatchResult = {
          canonicalName: entry.canonical,
          rawName,
          score: 1,
          matched: true,
        }
        cache.set(rawName, result)
        return result
      }

      const score = jaccardSimilarity(rawTokens, entry.tokens)
      if (score > bestScore) {
        bestScore = score
        bestCanonical = entry.canonical
      }
    }

    const matched = bestScore >= threshold
    const result: FuzzyMatchResult = {
      canonicalName: matched ? bestCanonical : rawName,
      rawName,
      score: bestScore,
      matched,
    }
    cache.set(rawName, result)
    return result
  }
}

/**
 * Clean and standardize product names before matching.
 * Maps known long-form system names to canonical short names.
 */
export function cleanProductName(name: string): string {
  if (!name) return name
  let s = name.trim()
  // Replace "Sistema de Radiofrecuencia de Plasma BONSS ARSxxx" with "Sistema BONSS ARSxxx"
  s = s.replace(/Sistema de Radiofrecuencia de Plasma BONSS ARS(\d+)/gi, 'Sistema BONSS ARS$1')
  return s
}

