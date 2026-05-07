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

/**
 * Envia um arquivo de áudio para a Edge Function de transcrição (Whisper).
 *
 * @param {File} file  Arquivo de áudio (MP3, M4A, WAV, OGG, WEBM, FLAC). Máximo 25 MB.
 * @returns {Promise<string>} Texto transcrito.
 */
export async function transcribeAudio(file) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure o Supabase para transcrever áudios.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const formData = new FormData()
  formData.append('audio', file, file.name)

  const response = await fetch(
    `${supabaseUrl}/functions/v1/transcribe-audio`,
    {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        // Não define Content-Type — o browser define automaticamente com o boundary correto
      },
      body: formData,
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

  if (!responseBody?.transcript) {
    throw new Error('A transcrição retornou vazia.')
  }

  return responseBody.transcript
}

/**
 * Busca todas as listas abertas do board Trello ao qual um card pertence.
 *
 * @param {string} organizationId
 * @param {string} cardId
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getTrelloBoardLists(organizationId, cardId) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure o Supabase para buscar as listas do Trello.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const response = await fetch(
    `${supabaseUrl}/functions/v1/get-trello-board-lists`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ organizationId, cardId }),
    },
  )

  let responseBody
  try { responseBody = await response.json() } catch { responseBody = null }

  if (!response.ok) {
    throw new Error(responseBody?.error || `Erro ${response.status}: ${response.statusText}`)
  }

  return responseBody?.lists ?? []
}

/**
 * Atualiza um card do Trello (título, descrição e/ou lista).
 *
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.cardId
 * @param {string} [params.name]
 * @param {string} [params.desc]
 * @param {string} [params.idList]
 * @returns {Promise<{ id, name, desc, idList, url }>}
 */
export async function updateTrelloCard({ organizationId, cardId, minuteId, name, responsible, desc, idList }) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure o Supabase para atualizar tarefas.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const response = await fetch(
    `${supabaseUrl}/functions/v1/update-trello-card`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ organizationId, cardId, minuteId, name, responsible, desc, idList }),
    },
  )

  let responseBody
  try { responseBody = await response.json() } catch { responseBody = null }

  if (!response.ok) {
    throw new Error(responseBody?.error || `Erro ${response.status}: ${response.statusText}`)
  }

  return responseBody
}

/**
 * Remove um card do Trello e do array trello_cards da ata.
 *
 * @param {string} organizationId
 * @param {string} cardId
 * @param {string} minuteId
 */
export async function deleteTrelloCard({ organizationId, cardId, minuteId }) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure o Supabase para remover tarefas.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const response = await fetch(
    `${supabaseUrl}/functions/v1/delete-trello-card`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ organizationId, cardId, minuteId }),
    },
  )

  let responseBody
  try { responseBody = await response.json() } catch { responseBody = null }

  if (!response.ok) {
    throw new Error(responseBody?.error || `Erro ${response.status}: ${response.statusText}`)
  }

  return responseBody
}

/**
 * Retorna todos os usuários com Telegram vinculado na organização
 * (membros internos + contatos externos).
 *
 * @returns {Promise<Array<{ name: string, chatId: number, type: 'member' | 'external' }>>}
 */
export async function getTelegramUsers(organizationId) {
  if (!supabase) throw new Error('Configure o Supabase.')

  const [{ data: members, error: e1 }, { data: contacts, error: e2 }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('full_name, telegram_chat_id')
      .eq('organization_id', organizationId)
      .not('telegram_chat_id', 'is', null),
    supabase
      .from('telegram_contacts')
      .select('full_name, telegram_chat_id')
      .eq('organization_id', organizationId)
      .not('telegram_chat_id', 'is', null),
  ])

  if (e1 || e2) throw new Error('Erro ao carregar usuários com Telegram.')

  return [
    ...(members || []).map((m) => ({ name: m.full_name, chatId: m.telegram_chat_id, type: 'member' })),
    ...(contacts || []).map((c) => ({ name: c.full_name, chatId: c.telegram_chat_id, type: 'external' })),
  ].filter((u) => u.name && u.chatId)
}

/**
 * Envia uma notificação Telegram.
 * Aceita `recipientChatId` + `recipientName` (direto) ou `responsible` (lookup por nome).
 *
 * @returns {Promise<{ ok: boolean, notificationsCount: number }>}
 */
export async function sendTaskNotification({ organizationId, cardId, minuteId, cardName, meetingTitle, description, recipientChatId, recipientName, responsible }) {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure o Supabase para enviar notificações.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-task-notification`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ organizationId, cardId, minuteId, cardName, meetingTitle, description, recipientChatId, recipientName, responsible }),
    },
  )

  let responseBody
  try { responseBody = await response.json() } catch { responseBody = null }

  if (!response.ok) {
    throw new Error(responseBody?.error || `Erro ${response.status}: ${response.statusText}`)
  }

  return responseBody
}
