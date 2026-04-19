import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { listMeetingMinutes } from '../services/meetingMinutes'

function formatDateTime(value) {
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

export default function DashboardPage() {
  const { isConfigured } = useAuth()
  const [stats, setStats] = useState([
    { label: 'Reuniões hoje', value: '--', tone: 'text-blue-700 bg-blue-50' },
    { label: 'Tarefas abertas', value: 'Trello', tone: 'text-violet-700 bg-violet-50' },
    { label: 'Atas geradas', value: '0', tone: 'text-emerald-700 bg-emerald-50' },
  ])
  const [recentMeetings, setRecentMeetings] = useState([])
  const [loading, setLoading] = useState(isConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      if (!isConfigured) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const data = await listMeetingMinutes()
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const todayCount = data.filter((item) => new Date(item.meeting_at) >= today).length

        setStats([
          { label: 'Reuniões hoje', value: String(todayCount), tone: 'text-blue-700 bg-blue-50' },
          { label: 'Tarefas abertas', value: 'Trello', tone: 'text-violet-700 bg-violet-50' },
          { label: 'Atas geradas', value: String(data.length), tone: 'text-emerald-700 bg-emerald-50' },
        ])
        setRecentMeetings(data.slice(0, 3))
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
        <p className="mt-2 text-slate-600">Acompanhe o panorama das suas reuniões e entregas.</p>
      </div>

      {!isConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Configure o Supabase para carregar os indicadores reais da aplicação.
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
            <h2 className="text-lg font-semibold text-slate-900">Últimas atas geradas</h2>
            <p className="text-sm text-slate-500">Resumo das reuniões disponíveis no banco.</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Carregando dados...</div>
        ) : recentMeetings.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Nenhuma ata encontrada no banco de dados.
          </div>
        ) : (
          <div className="space-y-3">
            {recentMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{meeting.title}</p>
                  <p className="text-sm text-slate-500">
                    {meeting.meeting_type_label} • {formatDateTime(meeting.meeting_at)}
                  </p>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(meeting.generation_status)}`}>
                  {meeting.generation_status || 'ready'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
