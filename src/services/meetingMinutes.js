import { getSupabaseClient, isSupabaseConfigured, supabase } from '../lib/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

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

const fallbackMeetingTypeOptions = [
  { value: 'conselho_estaca', label: 'Reunião de Conselho da Estaca' },
  { value: 'coordenacao_missionaria_estaca', label: 'Reunião de Coordenação Missionária da Estaca' },
  { value: 'presidencia_estaca', label: 'Reunião de Presidência da Estaca' },
  { value: 'sumo_conselho_estaca', label: 'Reunião do Sumo Conselho da Estaca' },
  { value: 'outras', label: 'Outras Reuniões' },
]

export async function listMeetingTypeOptions() {
  if (!isSupabaseConfigured) {
    return fallbackMeetingTypeOptions
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client.rpc('get_meeting_type_options')

    if (error || !data?.length) {
      return fallbackMeetingTypeOptions
    }

    return data
  } catch {
    return fallbackMeetingTypeOptions
  }
}

/**
 * Envia a transcrição de uma reunião para a Edge Function que gera a ata via
 * Azure OpenAI, cria o documento no Google Docs e salva no Drive.
 *
 * @param {object} params
 * @param {string} params.googleEventId
 * @param {string} params.title
 * @param {string} params.meetingType
 * @param {string} params.meetingAt  ISO 8601
 * @param {string} params.transcript
 * @param {string} params.organizationId
 * @param {string[]} [params.attendees]
 * @returns {Promise<{ documentId: string, webViewLink: string }>}
 */
export async function generateMeetingMinutes({
  googleEventId,
  title,
  meetingType,
  meetingAt,
  transcript,
  organizationId,
  attendees = [],
}) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure o Supabase para gerar atas.')
  }

  // Busca a sessão atual para incluir o token de autenticação
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const response = await fetch(
    `${supabaseUrl}/functions/v1/generate-meeting-minutes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        googleEventId,
        title,
        meetingType,
        meetingAt,
        transcript,
        organizationId,
        attendees,
      }),
    },
  )

  let responseBody
  try {
    responseBody = await response.json()
  } catch {
    responseBody = null
  }

  if (!response.ok) {
    const message =
      responseBody?.error ||
      responseBody?.message ||
      `Erro ${response.status}: ${response.statusText}`
    throw new Error(message)
  }

  if (responseBody?.error) {
    throw new Error(responseBody.error)
  }

  return responseBody
}

/**
 * Busca todas as tarefas das atas, enriquecidas com o status atual no Trello
 * (nome da lista em que o card se encontra).
 *
 * @param {string} organizationId
 * @returns {Promise<Array>}
 */
export async function getTrelloTasks(organizationId) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure o Supabase para buscar tarefas.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const response = await fetch(
    `${supabaseUrl}/functions/v1/get-trello-tasks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ organizationId }),
    },
  )

  let responseBody
  try {
    responseBody = await response.json()
  } catch {
    responseBody = null
  }

  if (!response.ok) {
    const message = responseBody?.error || `Erro ${response.status}: ${response.statusText}`
    throw new Error(message)
  }

  return responseBody?.tasks ?? []
}

