import { useState, useEffect } from 'react'
import type { FormOptions } from '../types'
import { getFormOptions } from '../services/api'

interface UseFormOptionsResult {
  data: FormOptions | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useFormOptions(): UseFormOptionsResult {
  const [data, setData] = useState<FormOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    try {
      const res = await getFormOptions()
      setData(res)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  return { data, loading, error, refetch }
}
