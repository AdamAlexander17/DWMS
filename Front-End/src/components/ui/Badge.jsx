const variants = {
  active:      'bg-green-100 text-green-700 border-green-200',
  inactive:    'bg-gray-100 text-gray-500 border-gray-200',
  admin:       'bg-blue-100 text-blue-700 border-blue-200',
  back_office: 'bg-sky-100 text-sky-700 border-sky-200',
  rm:          'bg-indigo-100 text-indigo-700 border-indigo-200',
  default:     'bg-gray-100 text-gray-600 border-gray-200',
}

const labels = {
  active:      'Active',
  inactive:    'Inactive',
  admin:       'Admin',
  back_office: 'Back Office',
  rm:          'RM',
}

export default function Badge({ variant = 'default', label }) {
  const cls = variants[variant] || variants.default
  return (
    <span className={`inline-flex items-center justify-center min-w-[70px] px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cls}`}>
      {label ?? labels[variant] ?? variant}
    </span>
  )
}
