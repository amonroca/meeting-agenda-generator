import MuiButton from '@mui/material/Button'

export default function Button({ children, sx, ...props }) {
  return (
    <MuiButton
      variant="contained"
      sx={{
        borderRadius: 3,
        textTransform: 'none',
        fontWeight: 600,
        px: 2,
        py: 1.2,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiButton>
  )
}
