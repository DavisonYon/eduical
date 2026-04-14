import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'

interface ProfileData {
  full_name: string | null
  email: string | null
  degree_type: 'undergrad' | 'masters' | 'phd' | 'post-bach' | 'continuing-edu' | null
  graduation_year: number | null
  past_schools: Array<{ school: string; degree: string; year: number | null }> | null
  major: string | null
  linkedin_url: string | null
  github_url: string | null
  website_url: string | null
  profile_picture: string | null
  desktop_toasts_enabled: boolean
}

export default function Settings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { refreshToastPreference } = useNotification()
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: null,
    email: null,
    degree_type: null,
    graduation_year: null,
    past_schools: [],
    major: null,
    linkedin_url: null,
    github_url: null,
    website_url: null,
    profile_picture: null,
    desktop_toasts_enabled: true,
  })

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

      if (data) {
        setProfileData({
          full_name: data.full_name || null,
          email: data.email || null,
          degree_type: data.degree_type || null,
          graduation_year: data.graduation_year || null,
          past_schools: data.past_schools || [],
          major: data.major || null,
          linkedin_url: data.linkedin_url || null,
          github_url: data.github_url || null,
          website_url: data.website_url || null,
          profile_picture: data.profile_picture || null,
          desktop_toasts_enabled: data.desktop_toasts_enabled ?? true,
        })
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setProfileData((prev) => ({ ...prev, profile_picture: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const addPastSchool = () => {
    setProfileData((prev) => ({
      ...prev,
      past_schools: [...(prev.past_schools || []), { school: '', degree: '', year: null }],
    }))
  }

  const removePastSchool = (index: number) => {
    setProfileData((prev) => ({
      ...prev,
      past_schools: prev.past_schools?.filter((_, i) => i !== index) || [],
    }))
  }

  const updatePastSchool = (index: number, field: 'school' | 'degree' | 'year', value: string | number | null) => {
    setProfileData((prev) => ({
      ...prev,
      past_schools: prev.past_schools?.map((school, i) =>
        i === index ? { ...school, [field]: value } : school
      ) || [],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name || null,
          degree_type: profileData.degree_type || null,
          graduation_year: profileData.graduation_year || null,
          past_schools: profileData.past_schools || [],
          major: profileData.major || null,
          linkedin_url: profileData.linkedin_url || null,
          github_url: profileData.github_url || null,
          website_url: profileData.website_url || null,
          profile_picture: profileData.profile_picture || null,
          desktop_toasts_enabled: profileData.desktop_toasts_enabled,
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      await refreshToastPreference()
      setSuccess('Settings saved successfully.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Update the information that appears on your public profile.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-200">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Profile Picture</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              {profileData.profile_picture ? (
                <img
                  src={profileData.profile_picture}
                  alt="Profile"
                  className="h-32 w-32 rounded-full border-2 border-gray-300 object-cover dark:border-gray-700"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
                  <span className="text-4xl text-gray-500 dark:text-gray-400">
                    {profileData.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-gray-200 px-4 py-2 text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                Upload Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {profileData.profile_picture && (
                <button
                  type="button"
                  onClick={() => setProfileData((prev) => ({ ...prev, profile_picture: null }))}
                  className="ml-2 rounded-lg bg-red-700 px-4 py-2 text-white transition-colors hover:bg-red-600"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Full Name *
              </label>
              <input
                type="text"
                value={profileData.full_name || ''}
                onChange={(e) => setProfileData((prev) => ({ ...prev, full_name: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={profileData.email || user?.email || ''}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Academic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Degree Type
              </label>
              <select
                value={profileData.degree_type || ''}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, degree_type: (e.target.value as any) || null }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select degree type</option>
                <option value="undergrad">Undergraduate</option>
                <option value="masters">Master's</option>
                <option value="phd">PhD</option>
                <option value="post-bach">Post-Baccalaureate</option>
                <option value="continuing-edu">Continuing Education</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Major</label>
              <input
                type="text"
                value={profileData.major || ''}
                onChange={(e) => setProfileData((prev) => ({ ...prev, major: e.target.value || null }))}
                placeholder="e.g., Computer Science, Business Administration"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Graduation Year
              </label>
              <input
                type="number"
                value={profileData.graduation_year || ''}
                onChange={(e) =>
                  setProfileData((prev) => ({
                    ...prev,
                    graduation_year: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                placeholder="e.g., 2025"
                min="1900"
                max="2100"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Past Schools/Degrees
                </label>
                <button
                  type="button"
                  onClick={addPastSchool}
                  className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  + Add School
                </button>
              </div>
              <div className="space-y-3">
                {profileData.past_schools?.map((school, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">School {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removePastSchool(index)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <input
                        type="text"
                        value={school.school}
                        onChange={(e) => updatePastSchool(index, 'school', e.target.value)}
                        placeholder="School name"
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                      <input
                        type="text"
                        value={school.degree}
                        onChange={(e) => updatePastSchool(index, 'degree', e.target.value)}
                        placeholder="Degree"
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                      <input
                        type="number"
                        value={school.year || ''}
                        onChange={(e) =>
                          updatePastSchool(index, 'year', e.target.value ? parseInt(e.target.value) : null)
                        }
                        placeholder="Year"
                        min="1900"
                        max="2100"
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                  </div>
                ))}
                {(!profileData.past_schools || profileData.past_schools.length === 0) && (
                  <p className="text-sm text-gray-500">No past schools added yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Notifications</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Desktop toast notifications</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Show brief pop-up notifications in the bottom-right corner when new messages arrive (desktop only)
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profileData.desktop_toasts_enabled}
              onClick={() =>
                setProfileData((prev) => ({
                  ...prev,
                  desktop_toasts_enabled: !prev.desktop_toasts_enabled,
                }))
              }
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 ${
                profileData.desktop_toasts_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  profileData.desktop_toasts_enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Links</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                LinkedIn Profile
              </label>
              <input
                type="url"
                value={profileData.linkedin_url || ''}
                onChange={(e) => setProfileData((prev) => ({ ...prev, linkedin_url: e.target.value || null }))}
                placeholder="https://linkedin.com/in/yourprofile"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                GitHub Profile
              </label>
              <input
                type="url"
                value={profileData.github_url || ''}
                onChange={(e) => setProfileData((prev) => ({ ...prev, github_url: e.target.value || null }))}
                placeholder="https://github.com/yourusername"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Personal Website
              </label>
              <input
                type="url"
                value={profileData.website_url || ''}
                onChange={(e) => setProfileData((prev) => ({ ...prev, website_url: e.target.value || null }))}
                placeholder="https://yourwebsite.com"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
