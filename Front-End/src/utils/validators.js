// ─────────────────────────────────────────────────────────────────────────────
// Shared field validators — mirrors Back-End/common/validators.py rules.
// Each validator returns null on success or a human-readable error string.
// ─────────────────────────────────────────────────────────────────────────────

// ── Regex constants (compiled once) ─────────────────────────────────────────
export const RX = {
  username:      /^[A-Za-z][A-Za-z0-9._-]{2,49}$/,
  indianMobile:  /^[6-9]\d{9}$/,
  pan:           /^[A-Z]{5}\d{4}[A-Z]$/,
  ifsc:          /^[A-Z]{4}0[A-Z0-9]{6}$/,
  gstin:         /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z\d]$/,
  upi:           /^[a-zA-Z0-9._-]{2,50}@[a-zA-Z][a-zA-Z0-9.-]{1,40}$/,
  accountNumber: /^\d{9,18}$/,
  brandName:     /^[A-Z0-9 _-]{2,50}$/,
  roleName:      /^[A-Za-z][A-Za-z0-9 _-]{1,49}$/,
  safeName:      /^[A-Za-z0-9 .,'&()\-_/]+$/,
  clientArcId:   /^[A-Za-z0-9_-]{3,50}$/,
}

// ── File size & mime ────────────────────────────────────────────────────────
export const FILE = {
  IMAGE_EXTS:  ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'],
  PDF_EXTS:    ['.pdf'],
  DOC_EXTS:    ['.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'],
  LIMITS_MB: {
    image: 5, pdf: 8, slip: 8, attachment: 15, qr: 5,
  },
}

const _ext = (name) => {
  const i = (name || '').lastIndexOf('.')
  return i === -1 ? '' : name.slice(i).toLowerCase()
}

// ── Generic ─────────────────────────────────────────────────────────────────
export const required = (label = 'This field') => (v) =>
  v === null || v === undefined || String(v).trim() === '' ? `${label} is required.` : null

export const maxLen = (n, label = 'Value') => (v) =>
  v && String(v).length > n ? `${label} must be at most ${n} characters.` : null

export const minLen = (n, label = 'Value') => (v) =>
  v && String(v).length < n ? `${label} must be at least ${n} characters.` : null

// ── Identity / contact ──────────────────────────────────────────────────────
export const username = (v) => {
  if (!v) return 'Username is required.'
  return RX.username.test(v)
    ? null
    : 'Username must be 3–50 characters, start with a letter, and contain only letters, digits, dot, underscore or hyphen.'
}

export const indianMobile = (v, { allowBlank = true } = {}) => {
  if (!v) return allowBlank ? null : 'Mobile number is required.'
  let digits = String(v).replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return RX.indianMobile.test(digits)
    ? null
    : 'Enter a valid 10-digit Indian mobile number (starting with 6-9).'
}

export const strongPassword = (v, { minLength = 8 } = {}) => {
  if (!v || v.length < minLength) return `Password must be at least ${minLength} characters long.`
  const missing = []
  if (!/[a-z]/.test(v)) missing.push('a lowercase letter')
  if (!/[A-Z]/.test(v)) missing.push('an uppercase letter')
  if (!/\d/.test(v))    missing.push('a digit')
  if (!/[^A-Za-z0-9]/.test(v)) missing.push('a symbol')
  if (missing.length) return `Password must include ${missing.join(', ')}.`
  if (/\s/.test(v)) return 'Password must not contain spaces.'
  return null
}

// ── Banking ─────────────────────────────────────────────────────────────────
export const pan = (v) => {
  if (!v) return 'PAN is required.'
  return RX.pan.test(String(v).toUpperCase())
    ? null
    : 'Enter a valid PAN (e.g. ABCDE1234F).'
}

export const ifsc = (v) => {
  if (!v) return 'IFSC code is required.'
  return RX.ifsc.test(String(v).toUpperCase().replace(/\s/g, ''))
    ? null
    : 'Enter a valid 11-character IFSC code (e.g. HDFC0001234).'
}

export const upi = (v) => {
  if (!v) return 'UPI ID is required.'
  return RX.upi.test(String(v).toLowerCase().replace(/\s/g, ''))
    ? null
    : 'Enter a valid UPI ID (e.g. name@bank).'
}

export const accountNumber = (v) => {
  if (!v) return 'Account number is required.'
  const digits = String(v).replace(/\D/g, '')
  return RX.accountNumber.test(digits)
    ? null
    : 'Enter a valid bank account number (9 to 18 digits).'
}

export const gstin = (v) => {
  if (!v) return 'GSTIN is required.'
  return RX.gstin.test(String(v).toUpperCase().replace(/\s/g, ''))
    ? null
    : 'Enter a valid 15-character GSTIN.'
}

// ── Domain names ────────────────────────────────────────────────────────────
export const brandName = (v) => {
  if (!v) return 'Brand name is required.'
  return RX.brandName.test(String(v).toUpperCase().trim())
    ? null
    : 'Brand name must be 2–50 uppercase characters (letters, digits, space, underscore or hyphen).'
}

export const roleName = (v) => {
  if (!v) return 'Role name is required.'
  return RX.roleName.test(v)
    ? null
    : 'Role name must be 2–50 characters, start with a letter, and contain only letters, digits, space, underscore or hyphen.'
}

export const safeName = (v, label = 'Name', max = 150) => {
  if (!v) return `${label} is required.`
  if (v.length > max) return `${label} must be at most ${max} characters.`
  return RX.safeName.test(v) ? null : `${label} contains invalid characters.`
}

export const clientArcId = (v) => {
  if (!v) return 'Client ARC ID is required.'
  return RX.clientArcId.test(v)
    ? null
    : 'Client ARC ID must be 3–50 chars: letters, digits, underscore or hyphen.'
}

// ── Numeric ─────────────────────────────────────────────────────────────────
export const positiveAmount = (v, { label = 'Amount', max = 10_000_000 } = {}) => {
  if (v === null || v === undefined || v === '') return `${label} is required.`
  const n = Number(v)
  if (Number.isNaN(n)) return `${label} must be a valid number.`
  if (n <= 0) return `${label} must be greater than zero.`
  if (max != null && n > max) return `${label} cannot exceed ${max.toLocaleString('en-IN')}.`
  // 2 decimal places max
  const s = String(v)
  if (s.includes('.') && s.split('.')[1].length > 2) {
    return `${label} can have at most 2 decimal places.`
  }
  return null
}

export const rangeOrder = (from, to, label = 'Max amount') => {
  if (from == null || to == null || from === '' || to === '') return null
  return Number(from) >= Number(to) ? `${label} must be greater than the minimum.` : null
}

// ── Files ───────────────────────────────────────────────────────────────────
export const fileLimits = (file, { maxMB, exts, label = 'File' }) => {
  if (!file) return `${label} is required.`
  const mb = file.size / (1024 * 1024)
  if (file.size === 0) return `${label} is empty.`
  if (maxMB && mb > maxMB) return `${label} is ${mb.toFixed(1)} MB — must be ≤ ${maxMB} MB.`
  if (exts) {
    const ext = _ext(file.name)
    if (!exts.includes(ext)) {
      return `${label}: extension "${ext || '?'}" is not allowed. Allowed: ${exts.join(', ')}`
    }
  }
  return null
}

export const imageFile = (file, { maxMB = FILE.LIMITS_MB.image, label = 'Image' } = {}) =>
  fileLimits(file, { maxMB, exts: FILE.IMAGE_EXTS, label })

export const qrFile = (file) =>
  fileLimits(file, { maxMB: FILE.LIMITS_MB.qr, exts: FILE.IMAGE_EXTS, label: 'QR image' })

export const slipFile = (file) =>
  fileLimits(file, {
    maxMB: FILE.LIMITS_MB.slip,
    exts: [...FILE.IMAGE_EXTS, ...FILE.PDF_EXTS],
    label: 'Slip',
  })

export const attachmentFile = (file) =>
  fileLimits(file, {
    maxMB: FILE.LIMITS_MB.attachment,
    exts: [...FILE.IMAGE_EXTS, ...FILE.PDF_EXTS, ...FILE.DOC_EXTS],
    label: 'Attachment',
  })

// ── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Run a rule map against a values object and return an errors object.
 * rules: { fieldName: [validatorFn, ...] }
 * Returns: { fieldName: 'first error', ... }  (only fields with errors)
 */
export function validate(values, rules) {
  const out = {}
  for (const [field, fns] of Object.entries(rules)) {
    for (const fn of fns) {
      const err = fn(values[field])
      if (err) { out[field] = err; break }
    }
  }
  return out
}

/**
 * Map the standard `{success, errors}` API envelope into a flat field map.
 * Accepts axios errors: returns { fieldName: 'message', non_field: 'message' }.
 */
export function extractApiErrors(axiosErr) {
  const out = {}
  // No error at all (e.g. mutation hasn't been triggered yet) → empty map
  if (!axiosErr || (typeof axiosErr === 'object' && Object.keys(axiosErr).length === 0)) {
    return out
  }
  const data = axiosErr?.response?.data
  if (!data) {
    // Genuine network/transport failure
    out.non_field = axiosErr?.message || 'Network error. Please try again.'
    return out
  }
  const errs = data.errors
  if (errs && typeof errs === 'object') {
    for (const [k, v] of Object.entries(errs)) {
      out[k === 'non_field_errors' ? 'non_field' : k] = Array.isArray(v) ? v[0] : String(v)
    }
  }
  if (!Object.keys(out).length && data.message) {
    out.non_field = data.message
  }
  return out
}
