const variants = {
  active:      'bg-green-100 text-green-700 border-green-200',
  inactive:    'bg-gray-100 text-gray-500 border-gray-200',
  admin:       'bg-purple-100 text-purple-700 border-purple-200',
  back_office: 'bg-blue-100 text-blue-700 border-blue-200',
  rm:          'bg-amber-100 text-amber-700 border-amber-200',
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label ?? labels[variant] ?? variant}
    </span>
  )
}
