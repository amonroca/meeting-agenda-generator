import { useCallback, useEffect, useMemo, useState } from 'react'
import GenerateMinutesModal from '../components/GenerateMinutesModal'
import { useAuth } from '../hooks/useAuth'
import { formatCalendarDate, isGoogleCalendarConfigured, listGoogleCalendarEvents } from '../services/googleCalendar'
import { listMeetingMinutes, listMeetingTypeOptions } from '../services/meetingMinutes'

const defaultMeetingTypeOptions = [
  { value: '', label: 'Todos os tipos' },
]

export default function MeetingsPage() {
  const { isConfigured, user } = useAuth()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [calendarMeetings, setCalendarMeetings] = useState([])
  const [meetingMinutes, setMeetingMinutes] = useState([])
  const [meetingTypeOptions, setMeetingTypeOptions] = useState(defaultMeetingTypeOptions)
  const [loading, setLoading] = useState(isConfigured || isGoogleCalendarConfigured)
  const [error, setError] = useState('')
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    listMeetingTypeOptions()
      .then((options) => {
        setMeetingTypeOptions([
          { value: '', label: 'Todos os tipos' },
          ...options,
        ])
      })
      .catch(() => { })
  }, [])

  const loadMeetings = useCallback(async () => {
    if (!isConfigured && !isGoogleCalendarConfigured) {
      setCalendarMeetings([])
      setMeetingMinutes([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [calendarEvents, minutes] = await Promise.all([
        isGoogleCalendarConfigured
          ? listGoogleCalendarEvents({
            meetingType,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            maxResults: 30,
          })
          : Promise.resolve([]),
        isConfigured
          ? listMeetingMinutes({
            meetingType,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })
          : Promise.resolve([]),
      ])

      setCalendarMeetings(calendarEvents)
      setMeetingMinutes(minutes)
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as reuniões.')
    } finally {
      setLoading(false)
    }
  }, [isConfigured, startDate, endDate, meetingType])

  useEffect(() => {
    void loadMeetings()
  }, [loadMeetings])

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setMeetingType('')
  }

  const handleMinutesSuccess = (result) => {
    setSelectedMeeting(null)
    setSuccessMessage('Ata gerada com sucesso! O documento foi salvo no Google Drive.')
    setTimeout(() => setSuccessMessage(''), 6000)
    void loadMeetings()
  }

  // Mapa de google_event_id → registro de ata para cruzar com eventos do calendário
  const minuteByEventId = useMemo(() => {
    const map = {}
    for (const m of meetingMinutes) {
      if (m.google_event_id) map[m.google_event_id] = m
    }
    return map
  }, [meetingMinutes])

  const leadershipMeetingTypes = meetingTypeOptions
    .filter((opt) => opt.value && opt.value !== 'outras')
    .map((opt) => opt.value)

  const regularMeetings = calendarMeetings.filter(
    (meeting) => leadershipMeetingTypes.includes(meeting.meetingType),
  )

  const renderMeetingCards = (items, emptyMessage) => {
    if (loading) {
      return (
        <div className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Carregando reuniões...
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          {emptyMessage}
        </div>
      )
    }

    return items.map((meeting) => {
      const existingMinute = minuteByEventId[meeting.id]
      return (
        <div key={meeting.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{meeting.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{meeting.meetingTypeLabel}</p>
              <p className="mt-1 text-sm text-slate-500">Data: {formatCalendarDate(meeting.startAt, meeting.isAllDay)}</p>
              {meeting.location && <p className="mt-1 text-sm text-slate-500">Local: {meeting.location}</p>}
              {meeting.description && (
                <p className="mt-1 max-h-20 overflow-hidden text-sm text-slate-500">
                  Descrição: {meeting.description}
                </p>
              )}
            </div>
            {isConfigured && (
              existingMinute?.drive_file_url ? (
                <a
                  href={existingMinute.drive_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Abrir ata
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedMeeting(meeting)}
                  title="Gerar ata desta reunião"
                  className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700"
                >
                  + Gerar ata
                </button>
              )
            )}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Reuniões</h1>
        <p className="mt-2 text-slate-600">
          Eventos vêm do Google Calendar e as atas continuam disponíveis a partir dos registros do sistema.
        </p>
      </div>

      {!isGoogleCalendarConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Configure o Google Calendar para exibir as reuniões automaticamente.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,160px)_minmax(0,160px)_auto] lg:items-end">
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

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Data inicial</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Data final</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadMeetings()}
              disabled={loading}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Próximos eventos do Google Calendar</h2>
          <p className="text-sm text-slate-500">Agenda oficial sincronizada do calendário.</p>
        </div>

        {renderMeetingCards(regularMeetings, 'Nenhuma reunião encontrada no Google Calendar.')}
      </div>

      {selectedMeeting && (
        <GenerateMinutesModal
          meeting={selectedMeeting}
          organizationId={user?.organizationId}
          onClose={() => setSelectedMeeting(null)}
          onSuccess={handleMinutesSuccess}
        />
      )}
    </div>
  )
}
