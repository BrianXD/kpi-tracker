import { useState, useEffect } from 'react'
import type { FormOptions } from '../types'
import { getFormOptions } from '../services/api'

interface UseFormOptionsResult {
  data: FormOptions | null
  loading: boolean
  error: string | null
}

export function useFormOptions(): UseFormOptionsResult {
  const [data, setData] = useState<FormOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFormOptions()
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : '載入失敗')
      )
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
