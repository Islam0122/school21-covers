import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError } from '@/services/http'

/** Maps API field errors onto react-hook-form fields; shows the remaining message as a toast. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]) {
  if (error instanceof ApiError) {
    let mapped = false
    for (const [key, messages] of Object.entries(error.errors)) {
      if (fields.includes(key)) {
        setError(key as Path<T>, { type: 'server', message: messages[0] })
        mapped = true
      }
    }
    if (!mapped || error.message !== 'Please correct the highlighted fields.') {
      const extra = Object.entries(error.errors).find(([k]) => !fields.includes(k))
      toast.error(extra ? `${error.message} ${extra[1][0]}` : error.message)
    }
    return
  }
  toast.error('Unexpected error. Please try again.')
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const first = Object.values(error.errors)[0]?.[0]
    return first && error.message === 'Please correct the highlighted fields.' ? first : error.message
  }
  return error instanceof Error ? error.message : 'Unexpected error.'
}
