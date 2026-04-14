import { Link } from 'react-router-dom'

export default function FloatingBugReportButton() {
  return (
    <Link
      to="/report"
      aria-label="Report a bug"
      title="Report a bug"
      className="fixed bottom-5 right-5 z-[150] inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-900"
    >
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v10M8 9V6a4 4 0 118 0v3m-9 0h10M5 13h14M7 13l-2 4m12-4l2 4M9 17h6" />
      </svg>
    </Link>
  )
}
