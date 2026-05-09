import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

/**
 * Gera (ou regenera) um token de vinculação do Telegram para o usuário.
 * Retorna o novo token.
 */
export async function generateTelegramLinkToken(userId) {
    if (!isSupabaseConfigured || !userId) throw new Error('Supabase não configurado.')

    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)))
        .map((b) => b.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 24)

    const client = getSupabaseClient()
    const { error } = await client
        .from('user_profiles')
        .update({ telegram_link_token: token })
        .eq('id', userId)

    if (error) throw error
    return token
}

/**
 * Retorna o perfil do usuário com os campos de Telegram.
 */
export async function getTelegramStatus(userId) {
    if (!isSupabaseConfigured || !userId) return null

    const client = getSupabaseClient()
    const { data, error } = await client
        .from('user_profiles')
        .select('telegram_chat_id, telegram_link_token')
        .eq('id', userId)
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Remove a vinculação do Telegram do usuário.
 */
export async function unlinkTelegram(userId) {
    if (!isSupabaseConfigured || !userId) throw new Error('Supabase não configurado.')

    const client = getSupabaseClient()
    const { error } = await client
        .from('user_profiles')
        .update({ telegram_chat_id: null, telegram_link_token: null })
        .eq('id', userId)

    if (error) throw error
}

/**
 * Envia lembretes via Telegram para uma reunião.
 */
export async function sendTelegramReminders({ organizationId, googleEventId, title, meetingAt, meetingType, meetingTypeLabel, location }) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.')

    const client = getSupabaseClient()
    const { data, error } = await client.functions.invoke('send-telegram-reminders', {
        body: { organizationId, googleEventId, title, meetingAt, meetingType, meetingTypeLabel, location },
    })

    if (error) throw new Error(error.message || 'Falha ao enviar lembretes.')
    return data
}

/**
 * Busca as confirmações de uma reunião.
 */
export async function getMeetingConfirmations(organizationId, googleEventId) {
    if (!isSupabaseConfigured) return []

    const client = getSupabaseClient()
    const { data, error } = await client
        .from('meeting_confirmations')
        .select('user_id, telegram_contact_id, status, responded_at, user_profiles(full_name), telegram_contacts(full_name)')
        .eq('organization_id', organizationId)
        .eq('google_event_id', googleEventId)

    if (error) throw error

    return (data || []).map((row) => ({
        ...row,
        displayName: row.user_profiles?.full_name || row.telegram_contacts?.full_name || 'Desconhecido',
    }))
}

/**
 * Lista os contatos externos com Telegram da organização.
 */
export async function listTelegramContacts(organizationId) {
    if (!isSupabaseConfigured || !organizationId) return []

    const client = getSupabaseClient()
    const { data, error } = await client
        .from('telegram_contacts')
        .select('id, full_name, role, telegram_chat_id, meeting_types, created_at')
        .eq('organization_id', organizationId)
        .order('full_name')

    if (error) throw error
    return data || []
}

/**
 * Adiciona um contato externo usando o código gerado pelo bot.
 * Resolve o código para o telegram_chat_id e cria o registro.
 */
export async function addTelegramContact({ organizationId, fullName, role, meetingTypes, linkCode, createdBy }) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.')

    const client = getSupabaseClient()

    // Resolve o código para o chat_id
    const { data: linkData, error: linkError } = await client
        .from('telegram_link_codes')
        .select('telegram_chat_id, expires_at')
        .eq('code', linkCode.toUpperCase())
        .maybeSingle()

    if (linkError) throw linkError
    if (!linkData) throw new Error('Código de vinculação inválido ou expirado.')
    if (new Date(linkData.expires_at) < new Date()) throw new Error('Código de vinculação expirado. Peça à pessoa para enviar /start novamente.')

    const { data: contact, error: insertError } = await client
        .from('telegram_contacts')
        .insert({
            organization_id: organizationId,
            full_name: fullName,
            role,
            telegram_chat_id: linkData.telegram_chat_id,
            meeting_types: meetingTypes,
            created_by: createdBy,
        })
        .select('id, full_name, role, telegram_chat_id, meeting_types')
        .single()

    if (insertError) {
        if (insertError.code === '23505') throw new Error('Esta conta do Telegram já está vinculada a outro contato.')
        throw insertError
    }

    // Remove o código usado
    await client.from('telegram_link_codes').delete().eq('code', linkCode.toUpperCase())

    return contact
}

/**
 * Remove um contato externo.
 */
export async function removeTelegramContact(contactId) {
    if (!isSupabaseConfigured || !contactId) throw new Error('Supabase não configurado.')

    const client = getSupabaseClient()
    const { error } = await client
        .from('telegram_contacts')
        .delete()
        .eq('id', contactId)

    if (error) throw error
}

/**
 * Lista os usuários internos da organização com seus tipos de notificação.
 */
export async function listOrgUsers(organizationId) {
    if (!isSupabaseConfigured || !organizationId) return []

    const client = getSupabaseClient()
    const { data, error } = await client
        .from('user_profiles')
        .select('id, full_name, email, role, telegram_chat_id, notification_meeting_types')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('full_name')

    if (error) throw error
    return data || []
}

/**
 * Atualiza os tipos de reunião para notificação de um usuário.
 */
export async function updateUserNotificationTypes(userId, meetingTypes) {
    if (!isSupabaseConfigured || !userId) throw new Error('Supabase não configurado.')

    const client = getSupabaseClient()
    const { error } = await client
        .from('user_profiles')
        .update({ notification_meeting_types: meetingTypes })
        .eq('id', userId)

    if (error) throw error
}
