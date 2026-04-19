import { useMemo, useState } from 'react'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function navItemClass(isActive) {
  return `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
    isActive
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`
}

function Sidebar({ menuItems, user, onClose, onLogout }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Meeting Hub</p>
            <p className="text-xs text-slate-500">Agenda Generator</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <CloseRoundedIcon fontSize="small" />
        </button>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink key={item.path} to={item.path} onClick={onClose} className={({ isActive }) => navItemClass(isActive)}>
              <Icon fontSize="small" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 px-4 py-4">
        <div className="mb-3 rounded-2xl bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{user?.name || 'Usuário'}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <LogoutRoundedIcon fontSize="small" />
          Sair
        </button>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const menuItems = useMemo(
    () => [
      { label: 'Dashboard', path: '/dashboard', icon: DashboardRoundedIcon },
      { label: 'Reuniões', path: '/meetings', icon: EventNoteRoundedIcon },
      { label: 'Tarefas', path: '/tasks', icon: AssignmentTurnedInRoundedIcon },
      { label: 'Configurações', path: '/settings', icon: SettingsRoundedIcon },
    ],
    [],
  )

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="text-sm font-semibold">Meeting Hub</p>
          <p className="text-xs text-slate-500">Agenda Generator</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
        >
          <MenuRoundedIcon fontSize="small" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="h-full w-72 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Sidebar
              menuItems={menuItems}
              user={user}
              onClose={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <Sidebar menuItems={menuItems} user={user} onClose={() => {}} onLogout={handleLogout} />
      </aside>

      <main className="px-4 pb-6 pt-20 lg:ml-72 lg:px-8 lg:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
