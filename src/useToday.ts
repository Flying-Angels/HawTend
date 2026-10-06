import { useEffect, useState } from 'react'
import { localDay, nextMidnight } from './calendar'

export function useToday() {
  const [today, setToday] = useState(localDay)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const now = new Date()
      setToday(localDay(now))
      // Recheck at midnight, and at least once per minute for a changed system clock/timezone.
      timer = setTimeout(refresh, Math.min(nextMidnight(now) + 50, 60_000))
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return today
}
