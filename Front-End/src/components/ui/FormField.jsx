import React from 'react'

/**
 * FieldError — small red inline error message under a form input.
 */
export function FieldError({ children }) {
  if (!children) return null
  return (
    <p className="mt-1 text-xs text-red-600 leading-snug">
      {children}
    </p>
  )
}

/**
 * FormField — label + input area + error message.
 *
 * <FormField label="Username" required error={errors.username}>
 *   <input className="input" .../>
 * </FormField>
 */
export default function FormField({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500 leading-snug">{hint}</p>
      )}
      <FieldError>{error}</FieldError>
    </div>
  )
}
