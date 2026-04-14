import { useCallback, useEffect, useRef, useState } from 'react'

const COUNTDOWN_SEC = 5

function isExternalHttpUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.href)
    if (!/^https?:$/i.test(url.protocol)) return false
    return url.origin !== window.location.origin
  } catch {
    return false
  }
}

/**
 * Intercepts left-clicks on external http(s) links, shows a disclaimer, then opens the URL in a new tab
 * after a short countdown or when the user confirms.
 */
export default function ExternalLinkGate() {
  const [open, setOpen] = useState(false)
  const [targetUrl, setTargetUrl] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC)
  const intervalRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearTimer()
    setOpen(false)
    setTargetUrl('')
  }, [clearTimer])

  const openInNewTab = useCallback(
    (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer')
      close()
    },
    [close]
  )

  useEffect(() => {
    if (!open || !targetUrl) return

    setSecondsLeft(COUNTDOWN_SEC)
    let remaining = COUNTDOWN_SEC

    intervalRef.current = window.setInterval(() => {
      remaining -= 1
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearTimer()
        window.open(targetUrl, '_blank', 'noopener,noreferrer')
        setOpen(false)
        setTargetUrl('')
      }
    }, 1000)

    return () => clearTimer()
  }, [open, targetUrl, clearTimer])

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      const el = (e.target as Element | null)?.closest?.('a[href]')
      if (!el) return
      const anchor = el as HTMLAnchorElement
      const hrefAttr = anchor.getAttribute('href')
      if (!hrefAttr || hrefAttr.trim() === '' || hrefAttr.startsWith('#')) return
      if (anchor.hasAttribute('download')) return

      let resolved: string
      try {
        resolved = new URL(anchor.href, window.location.href).href
      } catch {
        return
      }
      if (!isExternalHttpUrl(resolved)) return

      e.preventDefault()
      e.stopPropagation()
      clearTimer()
      setTargetUrl(resolved)
      setOpen(true)
    }

    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [clearTimer])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  let displayHost = targetUrl
  try {
    displayHost = new URL(targetUrl).hostname
  } catch {
    /* keep full string */
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="external-link-title"
      aria-describedby="external-link-desc"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 id="external-link-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            You are leaving Educial
          </h2>
          <p id="external-link-desc" className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            You are about to open an external website ({displayHost}) in a new browser tab. Educial does not
            control that site and is not responsible for its content, privacy practices, or availability. Only
            continue if you trust the destination.
          </p>
          <p className="mt-2 break-all rounded-lg bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {targetUrl}
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Opening in <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{secondsLeft}</span>s…
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Stay here
            </button>
            <button
              type="button"
              onClick={() => openInNewTab(targetUrl)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
