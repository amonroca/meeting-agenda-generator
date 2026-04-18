import { Box, Chip, Stack, Typography } from '@mui/material'
import Card from '../components/Card'

const tasks = [
  { title: 'Enviar resumo da reunião', priority: 'Alta', owner: 'Ana', status: 'Em andamento' },
  { title: 'Atualizar backlog do time', priority: 'Média', owner: 'Carlos', status: 'Planejada' },
  { title: 'Integrar com Trello', priority: 'Baixa', owner: 'Time Dev', status: 'Futuro' },
]

export default function TasksPage() {
  return (
    <Stack spacing={3} sx={{ pt: { xs: 6, md: 0 } }}>
      <Box>
        <Typography variant="h4">Tarefas</Typography>
        <Typography color="text.secondary">
          Cards prontos para futura integração com Trello e Telegram.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {tasks.map((task) => (
          <Card key={task.title} sx={{ height: '100%' }}>
            <Stack spacing={2}>
              <Typography variant="h6">{task.title}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={task.priority} color="secondary" variant="outlined" />
                <Chip label={task.status} color="primary" variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Responsável: {task.owner}
              </Typography>
            </Stack>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}
