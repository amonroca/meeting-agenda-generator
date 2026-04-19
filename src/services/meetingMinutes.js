import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

function toStartOfDayIso(dateString) {
  const date = new Date(dateString)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function toNextDayIso(dateString) {
  const date = new Date(dateString)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}

export async function listMeetingMinutes(filters = {}) {
  if (!isSupabaseConfigured) {
    return []
  }

  const client = getSupabaseClient()
  let query = client
    .from('meeting_minutes_list')
    .select('*')
    .order('meeting_at', { ascending: false })

  if (filters.meetingType) {
    query = query.eq('meeting_type', filters.meetingType)
  }

  if (filters.startDate) {
    query = query.gte('meeting_at', toStartOfDayIso(filters.startDate))
  }

  if (filters.endDate) {
    query = query.lt('meeting_at', toNextDayIso(filters.endDate))
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data ?? []
}
