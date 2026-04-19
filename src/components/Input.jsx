export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${className}`}
      {...props}
    />
  )
}
