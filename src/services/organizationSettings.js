import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

/**
 * Retorna as configurações da organização, incluindo o mapa de pastas do Drive.
 * @param {string} organizationId
 */
export async function getOrganizationSettings(organizationId) {
    if (!isSupabaseConfigured || !organizationId) return null

    const client = getSupabaseClient()
    const { data, error } = await client
        .from('organization_settings')
        .select('drive_root_folder_id, type_folder_map, minutes_prompt, trello_api_key, trello_token, trello_list_map')
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Salva (upsert) as configurações de pastas do Drive para a organização.
 * @param {string} organizationId
 * @param {{ typeFolderMap: Record<string, string>, driveRootFolderId?: string }} settings
 */
export async function saveOrganizationSettings(organizationId, { typeFolderMap, driveRootFolderId, minutesPrompt, trelloApiKey, trelloToken, trelloListMap }) {
    if (!isSupabaseConfigured || !organizationId) {
        throw new Error('Supabase não configurado.')
    }

    const client = getSupabaseClient()
    const { error } = await client
        .from('organization_settings')
        .upsert(
            {
                organization_id: organizationId,
                type_folder_map: typeFolderMap,
                ...(driveRootFolderId !== undefined ? { drive_root_folder_id: driveRootFolderId || null } : {}),
                ...(minutesPrompt !== undefined ? { minutes_prompt: minutesPrompt || null } : {}),
                ...(trelloApiKey !== undefined ? { trello_api_key: trelloApiKey || null } : {}),
                ...(trelloToken !== undefined ? { trello_token: trelloToken || null } : {}),
                ...(trelloListMap !== undefined ? { trello_list_map: trelloListMap } : {}),
            },
            { onConflict: 'organization_id' },
        )

    if (error) throw error
}
