import { useAuth } from '../hooks/useAuth'

export default function SettingsPage() {
  const { user, logout, isConfigured } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          Conta e preferências
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-2 text-slate-600">Gerencie seu perfil e finalize a sessão com segurança.</p>
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
    </div>
  )
}
