export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-lg bg-white p-4 shadow-md transition hover:shadow-lg ${className}`} {...props}>
      {children}
    </div>
  )
}
