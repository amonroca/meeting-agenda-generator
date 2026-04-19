export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`} {...props}>
      {children}
    </div>
  )
}
