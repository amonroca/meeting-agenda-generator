const tasks = [
  { title: 'Enviar resumo da reunião', priority: 'Alta', owner: 'Ana', status: 'Em andamento' },
  { title: 'Atualizar backlog do time', priority: 'Média', owner: 'Carlos', status: 'Planejada' },
  { title: 'Integrar com Trello', priority: 'Baixa', owner: 'Time Dev', status: 'Futuro' },
]

function priorityClasses(priority) {
  switch (priority) {
    case 'Alta':
      return 'bg-red-50 text-red-700 ring-red-200'
    case 'Média':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    default:
      return 'bg-blue-50 text-blue-700 ring-blue-200'
  }
}

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
          Integração Trello
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Tarefas</h1>
        <p className="mt-2 text-slate-600">
          Cards preparados para a futura integração com Trello e Telegram.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {tasks.map((task) => (
          <div key={task.title} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${priorityClasses(task.priority)}`}>
                Prioridade: {task.priority}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {task.status}
              </span>
            </div>

            <p className="mt-4 text-sm text-slate-500">Responsável: {task.owner}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
