import { supabase } from './supabase'
import type { UsageRecord, SurveyRound } from '../data/usage'

export async function pushUsage(
  records: UsageRecord[],
  round?: Omit<SurveyRound, 'id'>,
  roundId?: string,
): Promise<void> {
  if (!supabase || records.length === 0) return

  if (round && roundId) {
    const { error } = await supabase.from('survey_rounds').upsert({
      id: roundId,
      name: round.name,
      sent_at: round.sentAt,
      closed_at: round.closedAt ?? null,
      target_count: round.targetCount,
    })
    if (error) console.error('[supabase] survey_rounds upsert:', error.message)
  }

  const { error } = await supabase.from('usage_records').upsert(
    records.map((r) => ({
      member_id: r.memberId,
      software: r.software,
      frequency: r.frequency,
      still_needed: r.stillNeeded ?? null,
      surveyed_at: r.surveyedAt,
      source: r.source ?? 'survey',
      survey_round_id: roundId ?? null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'member_id,software' },
  )
  if (error) console.error('[supabase] usage_records upsert:', error.message)
}

export async function fetchUsage(): Promise<{ records: UsageRecord[]; rounds: SurveyRound[] }> {
  if (!supabase) return { records: [], rounds: [] }

  const [{ data: recData, error: recErr }, { data: roundData, error: roundErr }] =
    await Promise.all([
      supabase.from('usage_records').select('*'),
      supabase.from('survey_rounds').select('*').order('sent_at', { ascending: false }),
    ])

  if (recErr) console.error('[supabase] usage_records fetch:', recErr.message)
  if (roundErr) console.error('[supabase] survey_rounds fetch:', roundErr.message)

  const records: UsageRecord[] = (recData ?? []).map((r) => ({
    memberId: r.member_id as number,
    software: r.software as string,
    frequency: r.frequency as UsageRecord['frequency'],
    stillNeeded: (r.still_needed ?? null) as UsageRecord['stillNeeded'],
    surveyedAt: r.surveyed_at as string,
    source: (r.source ?? 'survey') as UsageRecord['source'],
  }))

  const rounds: SurveyRound[] = (roundData ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    sentAt: r.sent_at as string,
    closedAt: (r.closed_at ?? null) as string | null,
    targetCount: r.target_count as number,
  }))

  return { records, rounds }
}
