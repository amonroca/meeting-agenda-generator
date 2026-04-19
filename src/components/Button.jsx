export default function Button({ children, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
