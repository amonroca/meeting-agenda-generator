import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { formatCalendarDate } from '../services/googleCalendar'
import { getTrelloTasks } from '../services/meetingMinutes'

const MEETING_TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'conselho_estaca', label: 'Reunião de Conselho da Estaca' },
  { value: 'coordenacao_missionaria_estaca', label: 'Reunião de Coordenação Missionária da Estaca' },
  { value: 'presidencia_estaca', label: 'Reunião de Presidência da Estaca' },
  { value: 'sumo_conselho_estaca', label: 'Reunião do Sumo Conselho da Estaca' },
  { value: 'outras', label: 'Outras Reuniões' },
]

function statusClasses(status) {
  if (!status) return 'bg-slate-100 text-slate-500 ring-slate-200'
  const lower = status.toLowerCase()
  if (lower.includes('conclu') || lower.includes('done') || lower.includes('pronto')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }
  if (lower.includes('andamento') || lower.includes('doing') || lower.includes('progresso')) {
    return 'bg-blue-50 text-blue-700 ring-blue-200'
  }
  return 'bg-amber-50 text-amber-700 ring-amber-200'
}

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  const loadTasks = useCallback(() => {
    if (!user?.organizationId) return
    setLoading(true)
    setError('')
    getTrelloTasks(user.organizationId)
      .then(setTasks)
      .catch((err) => setError(err.message || 'Erro ao carregar tarefas.'))
      .finally(() => setLoading(false))
  }, [user?.organizationId])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Status únicos para o filtro
  const statusOptions = useMemo(() => {
    const unique = [...new Set(tasks.map((t) => t.status).filter(Boolean))]
    return unique.sort()
  }, [tasks])

  // Tarefas filtradas
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStatus && task.status !== filterStatus) return false
      if (filterType && task.meetingType !== filterType) return false
      if (filterStartDate) {
        const taskDate = new Date(task.meetingAt)
        const start = new Date(filterStartDate)
        start.setHours(0, 0, 0, 0)
        if (taskDate < start) return false
      }
      if (filterEndDate) {
        const taskDate = new Date(task.meetingAt)
        const end = new Date(filterEndDate)
        end.setHours(23, 59, 59, 999)
        if (taskDate > end) return false
      }
      return true
    })
  }, [tasks, filterStatus, filterType, filterStartDate, filterEndDate])

  const hasFilters = filterStatus || filterType || filterStartDate || filterEndDate

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tarefas</h1>
          <p className="mt-2 text-slate-600">
            Sincronizadas em tempo real com o Trello.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTasks}
          disabled={loading}
          className="shrink-0 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Status */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Status (lista Trello)</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Todos os status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Tipo de reunião */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tipo de reunião</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {MEETING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Data inicial */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Data inicial</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Data final */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Data final</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFilterStatus('')
                setFilterType('')
                setFilterStartDate('')
                setFilterEndDate('')
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="rounded-3xl bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Sincronizando com o Trello...
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-red-50 px-4 py-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-3xl bg-white px-4 py-12 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          {tasks.length === 0
            ? 'Nenhuma tarefa encontrada. As tarefas aparecem aqui quando atas com a seção ## Tarefas são geradas com o Trello configurado.'
            : 'Nenhuma tarefa corresponde aos filtros selecionados.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div key={`${task.minuteId}-${task.id}`} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{task.name}</h2>
                    {task.status ? (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusClasses(task.status)}`}>
                        {task.status}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-200">
                        Sem status
                      </span>
                    )}
                  </div>
                  {task.responsible && (
                    <p className="mt-1 text-sm text-slate-500">Responsável: {task.responsible}</p>
                  )}
                  {/*{task.description && (
                    <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{task.description}</p>
                  )}*/}
                  <p className="mt-1 text-xs text-slate-400">
                    {task.meetingTypeLabel} · {formatCalendarDate(task.meetingAt)}
                  </p>
                </div>
                {task.url && (
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Ver no Trello
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}