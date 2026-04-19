import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { listMeetingMinutes } from '../services/meetingMinutes'

const meetingTypeOptions = [
  { value: '', label: 'Todos os tipos' },
  { value: 'conselho_estaca', label: 'Reunião de Conselho da Estaca' },
  {
    value: 'coordenacao_missionaria_estaca',
    label: 'Reunião de Coordenação Missionária da Estaca',
  },
  { value: 'presidencia_estaca', label: 'Reunião de Presidência da Estaca' },
  { value: 'outras', label: 'Outras Reuniões' },
]

function formatDate(value) {
  if (!value) {
    return 'Sem data'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusClasses(status) {
  switch (status) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'processing':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'failed':
      return 'bg-red-50 text-red-700 ring-red-200'
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200'
  }
}

export default function MeetingsPage() {
  const { isConfigured } = useAuth()
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(isConfigured)
  const [error, setError] = useState('')

  const loadMeetings = useCallback(async () => {
    if (!isConfigured) {
      setMeetings([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await listMeetingMinutes({
        meetingType,
        startDate: meetingDate || undefined,
        endDate: meetingDate || undefined,
      })

      setMeetings(data)
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as atas.')
    } finally {
      setLoading(false)
    }
  }, [isConfigured, meetingDate, meetingType])

  useEffect(() => {
    void loadMeetings()
  }, [loadMeetings])

  const handleClearFilters = () => {
    setMeetingDate('')
    setMeetingType('')
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          Atas e reuniões
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Reuniões</h1>
        <p className="mt-2 text-slate-600">
          Visualize as atas geradas no Google Drive com filtros por data e tipo de reunião.
        </p>
      </div>

      {!isConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Configure o Supabase para carregar a lista real de atas.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Filtrar por data</span>
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de reunião</span>
            <select
              value={meetingType}
              onChange={(event) => setMeetingType(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {meetingTypeOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col justify-end gap-2 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => void loadMeetings()}
              disabled={!isConfigured || loading}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Carregando atas...
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Nenhuma ata encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{meeting.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{meeting.meeting_type_label}</p>
                  <p className="mt-1 text-sm text-slate-500">Data: {formatDate(meeting.meeting_at)}</p>
                  {meeting.drive_file_url && (
                    <a
                      href={meeting.drive_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-600"
                    >
                      Abrir ata no Google Drive
                    </a>
                  )}
                </div>

                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(meeting.generation_status)}`}>
                  {meeting.generation_status || 'ready'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
