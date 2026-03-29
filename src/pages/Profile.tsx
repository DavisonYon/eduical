import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

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

export default function Profile() {
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
      setError('Failed to load profile')
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

  const updatePastSchool = (index: number, field: 'school' | 'degree' | 'year', value: string | number) => {
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
      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12 text-gray-400">Loading profile...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Your Profile</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-200 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                {profileData.profile_picture ? (
                  <img
                    src={profileData.profile_picture}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-2 border-gray-700"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                    <span className="text-4xl text-gray-400">
                      {profileData.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
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
                    className="ml-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={profileData.full_name || ''}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, full_name: e.target.value }))}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profileData.email || user?.email || ''}
                  disabled
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Academic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Degree Type
                </label>
                <select
                  value={profileData.degree_type || ''}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, degree_type: e.target.value as any || null }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Major
                </label>
                <input
                  type="text"
                  value={profileData.major || ''}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, major: e.target.value || null }))}
                  placeholder="e.g., Computer Science, Business Administration"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Graduation Year
                </label>
                <input
                  type="number"
                  value={profileData.graduation_year || ''}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, graduation_year: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="e.g., 2025"
                  min="1900"
                  max="2100"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Past Schools */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Past Schools/Degrees
                  </label>
                  <button
                    type="button"
                    onClick={addPastSchool}
                    className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  >
                    + Add School
                  </button>
                </div>
                <div className="space-y-3">
                  {profileData.past_schools?.map((school, index) => (
                    <div key={index} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm text-gray-400">School {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removePastSchool(index)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={school.school}
                          onChange={(e) => updatePastSchool(index, 'school', e.target.value)}
                          placeholder="School name"
                          className="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={school.degree}
                          onChange={(e) => updatePastSchool(index, 'degree', e.target.value)}
                          placeholder="Degree"
                          className="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          value={school.year || ''}
                          onChange={(e) => updatePastSchool(index, 'year', e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="Year"
                          min="1900"
                          max="2100"
                          className="px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          {/* Notifications */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Notifications</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Desktop toast notifications</p>
                <p className="text-sm text-gray-400 mt-1">
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
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                  profileData.desktop_toasts_enabled ? 'bg-blue-600' : 'bg-gray-600'
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

          {/* Links */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Links</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  LinkedIn Profile
                </label>
                <input
                  type="url"
                  value={profileData.linkedin_url || ''}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, linkedin_url: e.target.value || null }))}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  GitHub Profile
                </label>
                <input
                  type="url"
                  value={profileData.github_url || ''}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, github_url: e.target.value || null }))}
                  placeholder="https://github.com/yourusername"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Personal Website
                </label>
                <input
                  type="url"
                  value={profileData.website_url || ''}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, website_url: e.target.value || null }))}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
