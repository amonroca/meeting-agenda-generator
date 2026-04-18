import MuiCard from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'

export default function Card({ children, contentSx, sx, ...props }) {
  return (
    <MuiCard sx={{ borderRadius: 4, ...sx }} {...props}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, ...contentSx }}>
        {children}
      </CardContent>
    </MuiCard>
  )
}
