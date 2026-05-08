import { supabase } from './supabase'

/**
 * Generates the next ARTHDIS-XXXX distributor ID.
 * Queries the current maximum and increments by 1.
 */
export async function generateDistributorId(): Promise<string> {
  const { data: maxRow } = await supabase
    .from('clients')
    .select('distributor_id')
    .not('distributor_id', 'is', null)
    .like('distributor_id', 'ARTHDIS-%')
    .order('distributor_id', { ascending: false })
    .limit(1)

  let nextNum = 1
  if (maxRow && maxRow.length > 0 && maxRow[0].distributor_id) {
    const match = maxRow[0].distributor_id.match(/ARTHDIS-(\d+)/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }

  return `ARTHDIS-${String(nextNum).padStart(4, '0')}`
}
