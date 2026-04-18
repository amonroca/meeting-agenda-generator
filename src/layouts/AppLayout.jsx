import { useMemo, useState } from 'react'
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '../hooks/useAuth'

const drawerWidth = 260

export default function AppLayout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const menuItems = useMemo(
    () => [
      { label: 'Dashboard', path: '/dashboard', icon: <DashboardRoundedIcon /> },
      { label: 'Reuniões', path: '/meetings', icon: <EventNoteRoundedIcon /> },
      { label: 'Tarefas', path: '/tasks', icon: <AssignmentTurnedInRoundedIcon /> },
      { label: 'Configurações', path: '/settings', icon: <SettingsRoundedIcon /> },
    ],
    [],
  )

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', px: 2 }}>
      <Toolbar disableGutters sx={{ py: 2, px: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main' }}>M</Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Meeting Hub
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Agenda Generator
            </Typography>
          </Box>
        </Stack>
      </Toolbar>

      <List sx={{ display: 'grid', gap: 0.5 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            selected={location.pathname === item.path}
            sx={{
              borderRadius: 3,
              '&.active, &.Mui-selected': {
                bgcolor: 'primary.main',
                color: '#fff',
                '& .MuiListItemIcon-root': { color: '#fff' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ mt: 'auto', mb: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={0.5} sx={{ px: 1, mb: 1.5 }}>
          <Typography variant="body2" fontWeight={600}>
            {user?.name || 'Usuário'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email}
          </Typography>
        </Stack>
        <ListItemButton onClick={handleLogout} sx={{ borderRadius: 3 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Sair" />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!isDesktop && (
        <IconButton
          onClick={() => setMobileOpen(true)}
          sx={{ position: 'fixed', top: 12, left: 12, zIndex: 1301, bgcolor: '#fff' }}
        >
          <MenuRoundedIcon />
        </IconButton>
      )}

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              borderRight: '1px solid rgba(15, 23, 42, 0.08)',
              backgroundImage: 'none',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          ml: { md: 0 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
