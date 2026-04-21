import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isGoogleCalendarConfigured } from '../services/googleCalendar'
import { getOrganizationSettings, saveOrganizationSettings } from '../services/organizationSettings'

const MEETING_TYPE_LABELS = {
  conselho_estaca: 'Reunião de Conselho da Estaca',
  presidencia_estaca: 'Reunião de Presidência da Estaca',
  sumo_conselho_estaca: 'Reunião do Sumo Conselho da Estaca',
  coordenacao_missionaria_estaca: 'Reunião de Coordenação Missionária da Estaca',
  outras: 'Outras Reuniões',
}

const DEFAULT_FOLDER_PATHS = {
  conselho_estaca: 'Estaca Carapicuiba/Secretaria/Atas_Conselho/2026',
  presidencia_estaca: 'Estaca Carapicuiba/Secretaria/Atas_PresEstaca/2026',
  sumo_conselho_estaca: 'Estaca Carapicuiba/Secretaria/Atas_SumoConselho/2026',
  coordenacao_missionaria_estaca: '',
  outras: '',
}

const DEFAULT_MINUTES_PROMPT = `Você é um assistente especializado em redigir atas de reunião formais em português brasileiro.

A partir da transcrição fornecida, produza uma ata completa e bem estruturada.

Regras importantes:
- Use APENAS as informações presentes na transcrição. Não invente dados.
- Seja objetivo e claro.
- Use linguagem formal.
- Listas de itens devem começar com "- " (hífen e espaço).
- Os títulos de seções devem usar o formato exato abaixo (com # e ##).

Formato obrigatório de saída:

# Ata da Reunião

## Resumo Executivo
- [Síntese em 2 a 4 pontos dos principais resultados e encaminhamentos da reunião]

## Temas
- [Tema 1: descrição objetiva do que foi discutido]
- [Tema 2: descrição objetiva do que foi discutido]

## Decisões
- [Decisão 1]
- [Decisão 2]

## Tarefas
- [Descrição da tarefa] — Responsável: [nome ou "não informado"]

## Pendências
- [Ponto pendente ou "Nenhuma pendência registrada."]`

export default function SettingsPage() {
  const { user, logout, isConfigured } = useAuth()
  const [folderPaths, setFolderPaths] = useState(DEFAULT_FOLDER_PATHS)
  const [driveSaving, setDriveSaving] = useState(false)
  const [driveMessage, setDriveMessage] = useState({ type: '', text: '' })
  const [minutesPrompt, setMinutesPrompt] = useState(DEFAULT_MINUTES_PROMPT)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptMessage, setPromptMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (!user?.organizationId) return

    getOrganizationSettings(user.organizationId)
      .then((settings) => {
        if (settings?.type_folder_map) {
          setFolderPaths((prev) => ({ ...prev, ...settings.type_folder_map }))
        }
        if (settings?.minutes_prompt) {
          setMinutesPrompt(settings.minutes_prompt)
        }
      })
      .catch(() => { })
  }, [user?.organizationId])

  async function handleSaveDriveSettings(e) {
    e.preventDefault()
    if (!user?.organizationId) return

    setDriveSaving(true)
    setDriveMessage({ type: '', text: '' })

    try {
      await saveOrganizationSettings(user.organizationId, { typeFolderMap: folderPaths })
      setDriveMessage({ type: 'success', text: 'Configurações de pastas salvas com sucesso.' })
    } catch (err) {
      setDriveMessage({ type: 'error', text: err.message || 'Falha ao salvar configurações.' })
    } finally {
      setDriveSaving(false)
      setTimeout(() => setDriveMessage({ type: '', text: '' }), 5000)
    }
  }

  async function handleSavePromptSettings(e) {
    e.preventDefault()
    if (!user?.organizationId) return

    setPromptSaving(true)
    setPromptMessage({ type: '', text: '' })

    try {
      await saveOrganizationSettings(user.organizationId, {
        typeFolderMap: folderPaths,
        minutesPrompt,
      })
      setPromptMessage({ type: 'success', text: 'Prompt salvo com sucesso.' })
    } catch (err) {
      setPromptMessage({ type: 'error', text: err.message || 'Falha ao salvar prompt.' })
    } finally {
      setPromptSaving(false)
      setTimeout(() => setPromptMessage({ type: '', text: '' }), 5000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          Conta e integrações
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-2 text-slate-600">Gerencie seu perfil, o acesso ao banco e as integrações externas.</p>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{user?.name || 'Usuário'}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {isConfigured ? 'Supabase conectado' : 'Supabase pendente'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Google Calendar</h2>
            <p className="text-sm text-slate-500">Sincronização segura via Supabase Edge Function.</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isGoogleCalendarConfigured ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
            {isGoogleCalendarConfigured ? 'Proxy ativo' : 'Pendente'}
          </span>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <p>As credenciais sensíveis do Google ficam no backend da função segura do Supabase, e não no frontend.</p>
          <div className="rounded-2xl bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-200">
            <p><strong>Secrets do backend:</strong></p>
            <p>GOOGLE_CLIENT_ID</p>
            <p>GOOGLE_CLIENT_SECRET</p>
            <p>GOOGLE_CALENDAR_ID</p>
            <p>GOOGLE_OAUTH_TOKEN_URL</p>
          </div>
          <p>Você pode usar refresh token ou fluxo OAuth com usuário e senha, ambos protegidos no servidor.</p>
        </div>
      </div>
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Pastas do Google Drive</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Configure o caminho de destino das atas por tipo de reunião. Use o formato{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">
              Pasta Raiz/Subpasta/2026
            </code>
            . As pastas serão criadas automaticamente se não existirem.
          </p>
        </div>

        <form onSubmit={handleSaveDriveSettings} className="space-y-4">
          {Object.entries(MEETING_TYPE_LABELS).map(([type, label]) => (
            <label key={type} className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
              <input
                type="text"
                value={folderPaths[type] || ''}
                onChange={(e) =>
                  setFolderPaths((prev) => ({ ...prev, [type]: e.target.value }))
                }
                placeholder="Ex: Estaca Nome/Secretaria/Atas_Tipo/2026"
                disabled={!isConfigured || driveSaving}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
              />
            </label>
          ))}

          {driveMessage.text && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${driveMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
                }`}
            >
              {driveMessage.text}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!isConfigured || !user?.organizationId || driveSaving}
              className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {driveSaving ? 'Salvando…' : 'Salvar pastas'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Prompt de Geração de Atas</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Instruções enviadas ao modelo de IA ao gerar cada ata. Defina o formato, as seções e o estilo esperados.
          </p>
        </div>

        <form onSubmit={handleSavePromptSettings} className="space-y-4">
          <textarea
            value={minutesPrompt}
            onChange={(e) => setMinutesPrompt(e.target.value)}
            rows={14}
            disabled={!isConfigured || promptSaving}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
          />

          {promptMessage.text && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${promptMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
                }`}
            >
              {promptMessage.text}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setMinutesPrompt(DEFAULT_MINUTES_PROMPT)}
              disabled={!isConfigured || promptSaving}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Restaurar padrão
            </button>
            <button
              type="submit"
              disabled={!isConfigured || !user?.organizationId || promptSaving || !minutesPrompt.trim()}
              className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {promptSaving ? 'Salvando…' : 'Salvar prompt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
