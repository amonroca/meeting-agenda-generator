import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { listMeetingMinutes } from '../services/meetingMinutes'
import { formatCalendarDate, isCalendarDateToday, isGoogleCalendarConfigured, listGoogleCalendarEvents } from '../services/googleCalendar'

function statusClasses(status) {
  switch (status) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'processing':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'failed':
      return 'bg-red-50 text-red-700 ring-red-200'
    default:
      return 'bg-blue-50 text-blue-700 ring-blue-200'
  }
}

export default function DashboardPage() {
  const { isConfigured } = useAuth()
  const [stats, setStats] = useState([
    { label: 'Reuniões hoje', value: '--', tone: 'text-blue-700 bg-blue-50' },
    { label: 'Tarefas abertas', value: 'Trello', tone: 'text-violet-700 bg-violet-50' },
    { label: 'Atas geradas', value: '0', tone: 'text-emerald-700 bg-emerald-50' },
  ])
  const [calendarMeetings, setCalendarMeetings] = useState([])
  const [loading, setLoading] = useState(isConfigured || isGoogleCalendarConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      if (!isConfigured && !isGoogleCalendarConfigured) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const [minutes, calendarEvents] = await Promise.all([
          isConfigured ? listMeetingMinutes() : Promise.resolve([]),
          isGoogleCalendarConfigured
            ? listGoogleCalendarEvents({ maxResults: 6 })
            : Promise.resolve([]),
        ])

        const todayCount = calendarEvents.filter((item) => item.startAt && isCalendarDateToday(item.startAt)).length

        setStats([
          { label: 'Reuniões hoje', value: String(todayCount), tone: 'text-blue-700 bg-blue-50' },
          { label: 'Tarefas abertas', value: 'Trello', tone: 'text-violet-700 bg-violet-50' },
          { label: 'Atas geradas', value: String(minutes.length), tone: 'text-emerald-700 bg-emerald-50' },
        ])
        setCalendarMeetings(calendarEvents.slice(0, 3))
      } catch (err) {
        setError(err.message || 'Não foi possível carregar o dashboard.')
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [isConfigured])

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          Visão geral
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-slate-600">Acompanhe o panorama das suas reuniões, agendas e entregas.</p>
      </div>

      {!isGoogleCalendarConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Configure o Google Calendar para carregar os próximos eventos automaticamente.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>
              {item.label}
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{loading ? '...' : item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Próximas reuniões do calendário</h2>
            <p className="text-sm text-slate-500">Eventos sincronizados diretamente do Google Calendar.</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Carregando dados...</div>
        ) : calendarMeetings.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Nenhuma reunião encontrada no Google Calendar.
          </div>
        ) : (
          <div className="space-y-3">
            {calendarMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{meeting.title}</p>
                  <p className="text-sm text-slate-500">
                    {meeting.meetingTypeLabel} • {formatCalendarDate(meeting.startAt, meeting.isAllDay)}
                  </p>
                  {meeting.location && <p className="text-sm text-slate-500">Local: {meeting.location}</p>}
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(meeting.status)}`}>
                  {meeting.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
