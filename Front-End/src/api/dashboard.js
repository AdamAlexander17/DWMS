import api from './axios'

/**
 * Fetch the combined dashboard payload (KPIs + every chart series).
 * @param {'week'|'month'|'year'} period
 */
export const getDashboardSummary = (period = 'month') =>
  api.get('/dashboard/summary/', { params: { period } })
