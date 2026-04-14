import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'

export default function Search() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (location.pathname === '/search') {
      setValue(searchParams.get('q') ?? '')
    }
  }, [location.pathname, searchParams])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    navigate({ pathname: '/search', search: q ? `?q=${encodeURIComponent(q)}` : '' })
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          className="h-5 w-5 text-gray-500 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search posts, comments, names, email…"
        autoComplete="off"
        className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm leading-5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:placeholder-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
        aria-label="Search posts and comments"
      />
    </form>
  )
}
