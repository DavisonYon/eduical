import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ensureProfile } from '../../utils/ensureProfile'

interface Post {
  id: string
  user_id: string
  content: string | null
  images: string[] | null
  gif_url: string | null
  location: string | null
  visibility: 'public' | 'friends'
  status: 'published' | 'draft'
  created_at: string
  updated_at: string
  profiles?: {
    full_name: string | null
    email: string | null
    profile_picture: string | null
  } | null
  likesCount?: number
  userHasLiked?: boolean
  commentsCount?: number
}

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: {
    full_name: string | null
    email: string | null
    profile_picture: string | null
  } | null
  likesCount?: number
  userHasLiked?: boolean
}

interface PostFeedProps {
  refreshKey?: number
}

export default function PostFeed({ refreshKey }: PostFeedProps) {
  const { user } = useAuth()
  const userId = user?.id
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [commentsModalPostId, setCommentsModalPostId] = useState<string | null>(null)
  const [commentsModalLoading, setCommentsModalLoading] = useState(false)
  const [commentsModalError, setCommentsModalError] = useState('')
  const [commentsModalComments, setCommentsModalComments] = useState<Comment[]>([])
  const [commentsModalInput, setCommentsModalInput] = useState('')
  const isFetchingRef = useRef(false)
  const lastRefreshKeyRef = useRef(refreshKey || 0)
  const refreshKeyRef = useRef(refreshKey || 0)

  // Update refreshKey ref when it changes
  useEffect(() => {
    refreshKeyRef.current = refreshKey || 0
  }, [refreshKey])

  const fetchPosts = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    const currentRefreshKey = refreshKeyRef.current

    // Prevent concurrent fetches unless refreshKey changed
    if (isFetchingRef.current && lastRefreshKeyRef.current === currentRefreshKey) {
      return
    }

    isFetchingRef.current = true
    lastRefreshKeyRef.current = currentRefreshKey
    setLoading(true)
    setError('')

    try {
      // Fetch published posts (public or from current user)
      // First, get posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50)

      if (postsError) {
        throw postsError
      }

      // Then, get user profiles for each post
      if (postsData && postsData.length > 0) {
        const userIds = [...new Set(postsData.map((p) => p.user_id))]
        
        // Try to get profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, profile_picture')
          .in('id', userIds)

        // Merge profiles with posts
        const postsWithProfiles: Post[] = postsData.map((post) => {
          const profile = profilesData?.find((p) => p.id === post.user_id)

          return {
            ...post,
            profiles: profile || {
              full_name: null,
              email: null,
              profile_picture: null,
            },
          }
        })

        const postIds = postsWithProfiles.map((p) => p.id)

        // Fetch likes for all posts
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('post_id, user_id')
          .in('post_id', postIds)

        const likesByPost: Record<string, { count: number; userHasLiked: boolean }> = {}
        postsWithProfiles.forEach((post) => {
          likesByPost[post.id] = { count: 0, userHasLiked: false }
        })

        if (likesData) {
          likesData.forEach((like) => {
            if (!likesByPost[like.post_id]) {
              likesByPost[like.post_id] = { count: 0, userHasLiked: false }
            }
            likesByPost[like.post_id].count += 1
            if (userId && like.user_id === userId) {
              likesByPost[like.post_id].userHasLiked = true
            }
          })
        }

        // Fetch comment counts for all posts (do not load comments in feed)
        const { data: commentsData } = await supabase
          .from('post_comments')
          .select('post_id')
          .in('post_id', postIds)

        const commentsCountByPost: Record<string, number> = {}
        if (commentsData) {
          commentsData.forEach((row: any) => {
            commentsCountByPost[row.post_id] = (commentsCountByPost[row.post_id] || 0) + 1
          })
        }

        const enrichedPosts = postsWithProfiles.map((post) => ({
          ...post,
          likesCount: likesByPost[post.id]?.count ?? 0,
          userHasLiked: likesByPost[post.id]?.userHasLiked ?? false,
          commentsCount: commentsCountByPost[post.id] ?? 0,
        }))

        setPosts(enrichedPosts)
      } else {
        setPosts([])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load posts')
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [userId])

  // Ensure current user has a profile (non-blocking)
  useEffect(() => {
    if (user) {
      ensureProfile(user).catch(console.error)
    }
  }, [user])

  // Fetch posts when userId or refreshKey changes
  useEffect(() => {
    if (!userId) {
      setPosts([])
      setLoading(false)
      return
    }

    if (lastRefreshKeyRef.current !== (refreshKey || 0)) {
      fetchPosts()
    } else if (!isFetchingRef.current) {
      fetchPosts()
    }
  }, [userId, refreshKey, fetchPosts])

  const handleToggleLike = async (postId: string) => {
    if (!user) return

    const post = posts.find((p) => p.id === postId)
    if (!post) return

    const currentlyLiked = post.userHasLiked

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              userHasLiked: !currentlyLiked,
              likesCount: (p.likesCount || 0) + (currentlyLiked ? -1 : 1),
            }
          : p
      )
    )

    if (currentlyLiked) {
      // Remove like
      const { error: unlikeError } = await supabase
        .from('post_likes')
        .delete()
        .match({ post_id: postId, user_id: user.id })

      if (unlikeError) {
        // Revert on error
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  userHasLiked: currentlyLiked,
                  likesCount: (p.likesCount || 0) + (currentlyLiked ? 1 : -1),
                }
              : p
          )
        )
      }
    } else {
      // Add like
      const { error: likeError } = await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: user.id })

      if (likeError) {
        // Revert on error
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  userHasLiked: currentlyLiked,
                  likesCount: (p.likesCount || 0) + (currentlyLiked ? 1 : -1),
                }
              : p
          )
        )
      }
    }
  }

  const handleOpenComments = async (postId: string) => {
    setCommentsModalPostId(postId)
    setCommentsModalError('')
    setCommentsModalInput('')
    setCommentsModalComments([])
    setCommentsModalLoading(true)

    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('id, post_id, user_id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (commentsError) throw commentsError

      const baseComments: Comment[] =
        commentsData?.map((c: any) => ({
          id: c.id,
          post_id: c.post_id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          profiles: null,
        })) || []

      if (baseComments.length === 0) {
        setCommentsModalComments([])
        return
      }

      const commenterIds = [...new Set(baseComments.map((c) => c.user_id))]
      const { data: commenterProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture')
        .in('id', commenterIds)

      // Fetch likes for all comments in this post
      const commentIds = baseComments.map((c) => c.id)
      const { data: commentLikesData } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds)

      const likesByComment: Record<string, { count: number; userHasLiked: boolean }> = {}
      baseComments.forEach((c) => {
        likesByComment[c.id] = { count: 0, userHasLiked: false }
      })

      if (commentLikesData) {
        commentLikesData.forEach((like: any) => {
          if (!likesByComment[like.comment_id]) {
            likesByComment[like.comment_id] = { count: 0, userHasLiked: false }
          }
          likesByComment[like.comment_id].count += 1
          if (userId && like.user_id === userId) {
            likesByComment[like.comment_id].userHasLiked = true
          }
        })
      }

      const enriched = baseComments.map((c) => ({
        ...c,
        profiles: commenterProfiles?.find((p) => p.id === c.user_id) || null,
        likesCount: likesByComment[c.id]?.count ?? 0,
        userHasLiked: likesByComment[c.id]?.userHasLiked ?? false,
      }))

      setCommentsModalComments(enriched)
    } catch (e: any) {
      setCommentsModalError(e?.message || 'Failed to load comments')
    } finally {
      setCommentsModalLoading(false)
    }
  }

  const handleToggleCommentLike = async (commentId: string) => {
    if (!userId) return

    const comment = commentsModalComments.find((c) => c.id === commentId)
    if (!comment) return

    const currentlyLiked = comment.userHasLiked

    // Optimistic update
    setCommentsModalComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              userHasLiked: !currentlyLiked,
              likesCount: (c.likesCount || 0) + (currentlyLiked ? -1 : 1),
            }
          : c
      )
    )

    if (currentlyLiked) {
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .match({ comment_id: commentId, user_id: userId })

      if (error) {
        // Revert on error
        setCommentsModalComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  userHasLiked: currentlyLiked,
                  likesCount: (c.likesCount || 0) + (currentlyLiked ? 1 : -1),
                }
              : c
          )
        )
      }
    } else {
      const { error } = await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: userId })

      if (error) {
        // Revert on error
        setCommentsModalComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  userHasLiked: currentlyLiked,
                  likesCount: (c.likesCount || 0) + (currentlyLiked ? 1 : -1),
                }
              : c
          )
        )
      }
    }
  }

  const handleCloseComments = () => {
    setCommentsModalPostId(null)
    setCommentsModalComments([])
    setCommentsModalInput('')
    setCommentsModalError('')
    setCommentsModalLoading(false)
  }

  const handleAddCommentInModal = async () => {
    if (!userId) return
    if (!commentsModalPostId) return

    const content = commentsModalInput.trim()
    if (!content) return

    const post = posts.find((p) => p.id === commentsModalPostId)
    const tempId = `temp-${Date.now()}`

    const optimistic: Comment = {
      id: tempId,
      post_id: commentsModalPostId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      profiles: post?.profiles || null,
    }

    setCommentsModalComments((prev) => [optimistic, ...prev])
    setCommentsModalInput('')
    setPosts((prev) =>
      prev.map((p) =>
        p.id === commentsModalPostId
          ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
          : p
      )
    )

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: commentsModalPostId, user_id: userId, content })
      .select('id, post_id, user_id, content, created_at')
      .single()

    if (error || !data) {
      // revert optimistic insert + count
      setCommentsModalComments((prev) => prev.filter((c) => c.id !== tempId))
      setPosts((prev) =>
        prev.map((p) =>
          p.id === commentsModalPostId
            ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - 1) }
            : p
        )
      )
      return
    }

    setCommentsModalComments((prev) =>
      prev.map((c) =>
        c.id === tempId ? { ...c, id: data.id, created_at: data.created_at } : c
      )
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading posts...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
        <p className="font-semibold">Error loading posts</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchPosts}
          className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg mb-2">No posts yet</p>
        <p className="text-sm">Be the first to share something!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div
          key={post.id}
          className="bg-gray-800 rounded-lg border border-gray-700 p-6"
        >
          {/* Post Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {post.profiles?.profile_picture ? (
                <img
                  src={post.profiles.profile_picture}
                  alt={post.profiles?.full_name || post.profiles?.email || 'User'}
                  className="w-10 h-10 rounded-full object-cover border border-gray-600"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {post.profiles?.full_name
                      ? post.profiles.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      : post.profiles?.email?.[0].toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              <div>
                <p className="text-white font-medium">
                  {post.profiles?.full_name || 
                   post.profiles?.email || 
                   'User'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {post.location && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {post.location}
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    post.visibility === 'public' 
                      ? 'bg-blue-900/50 text-blue-300' 
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {post.visibility === 'public' ? 'Public' : 'Friends Only'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Post Content */}
          {post.content && (
            <p className="text-white mb-4 whitespace-pre-wrap">{post.content}</p>
          )}

          {/* GIF */}
          {post.gif_url && (
            <div className="mb-4">
              <img
                src={post.gif_url}
                alt="Post GIF"
                className="w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          )}

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className={`mb-4 grid gap-2 ${
              post.images.length === 1 
                ? 'grid-cols-1' 
                : post.images.length === 2 
                ? 'grid-cols-2' 
                : 'grid-cols-2'
            }`}>
              {post.images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Post image ${index + 1}`}
                  className="w-full h-64 object-cover rounded-lg"
                />
              ))}
            </div>
          )}

          {/* Post Actions */}
          <div className="flex items-center gap-6 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={() => handleToggleLike(post.id)}
              className={`flex items-center gap-2 transition-colors ${
                post.userHasLiked ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-sm">
                {post.likesCount && post.likesCount > 0
                  ? `${post.likesCount} Like${post.likesCount === 1 ? '' : 's'}`
                  : 'Like'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenComments(post.id)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm">
                {post.commentsCount && post.commentsCount > 0
                  ? `${post.commentsCount} Comment${post.commentsCount === 1 ? '' : 's'}`
                  : 'Comment'}
              </span>
            </button>
          </div>
        </div>
      ))}

      {/* Comments Modal */}
      {commentsModalPostId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseComments()
          }}
        >
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <p className="text-white font-semibold">Comments</p>
                <p className="text-xs text-gray-400">
                  {posts.find((p) => p.id === commentsModalPostId)?.commentsCount || 0} total
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseComments}
                className="text-gray-400 hover:text-white"
                aria-label="Close comments"
              >
                ✕
              </button>
            </div>

            {/* Original post at top, like Facebook */}
            <div className="px-4 py-4 border-b border-gray-800 bg-gray-900/80">
              {(() => {
                const post = posts.find((p) => p.id === commentsModalPostId)
                if (!post) return null
                return (
                  <div className="flex items-start gap-3">
                    {post.profiles?.profile_picture ? (
                      <img
                        src={post.profiles.profile_picture}
                        alt={post.profiles.full_name || post.profiles.email || 'User'}
                        className="w-10 h-10 rounded-full object-cover border border-gray-600 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-medium">
                          {post.profiles?.full_name
                            ? post.profiles.full_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)
                            : post.profiles?.email?.[0].toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-white font-semibold truncate">
                            {post.profiles?.full_name || post.profiles?.email || 'User'}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            <span>
                              {new Date(post.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {post.visibility && (
                              <>
                                <span>•</span>
                                <span>{post.visibility === 'public' ? 'Public' : 'Friends'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {post.content && (
                        <p className="mt-2 text-sm text-gray-100 whitespace-pre-wrap">
                          {post.content}
                        </p>
                      )}
                      {post.gif_url && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-gray-800">
                          <img
                            src={post.gif_url}
                            alt="Post GIF"
                            className="w-full max-h-72 object-contain bg-black"
                          />
                        </div>
                      )}
                      {post.images && post.images.length > 0 && (
                        <div
                          className={`mt-3 grid gap-1 rounded-lg overflow-hidden border border-gray-800 ${
                            post.images.length === 1
                              ? 'grid-cols-1'
                              : post.images.length === 2
                              ? 'grid-cols-2'
                              : 'grid-cols-2'
                          }`}
                        >
                          {post.images.map((img, index) => (
                            <img
                              key={index}
                              src={img}
                              alt={`Post image ${index + 1}`}
                              className="w-full h-48 object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Add comment at top */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentsModalInput}
                  onChange={(e) => setCommentsModalInput(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddCommentInModal()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCommentInModal}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-full"
                  disabled={!commentsModalInput.trim()}
                >
                  Post
                </button>
              </div>
              {commentsModalError && (
                <p className="text-xs text-red-300 mt-2">{commentsModalError}</p>
              )}
            </div>

            {/* Scrollable comments */}
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {commentsModalLoading ? (
                <p className="text-gray-400 text-sm">Loading comments...</p>
              ) : commentsModalComments.length === 0 ? (
                <p className="text-gray-400 text-sm">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {commentsModalComments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      {comment.profiles?.profile_picture ? (
                        <img
                          src={comment.profiles.profile_picture}
                          alt={comment.profiles.full_name || comment.profiles.email || 'User'}
                          className="w-8 h-8 rounded-full object-cover border border-gray-600 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-medium">
                            {comment.profiles?.full_name
                              ? comment.profiles.full_name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)
                              : comment.profiles?.email?.[0].toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                      <div className="bg-gray-800 rounded-2xl px-3 py-2 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-gray-300 font-medium">
                              {comment.profiles?.full_name || comment.profiles?.email || 'User'}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {new Date(comment.created_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCommentLike(comment.id)}
                            className={`flex items-center gap-1 text-[11px] font-medium ${
                              comment.userHasLiked
                                ? 'text-blue-400'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill={comment.userHasLiked ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                            <span>
                              {comment.likesCount && comment.likesCount > 0
                                ? comment.likesCount
                                : 'Like'}
                            </span>
                          </button>
                        </div>
                        <p className="text-sm text-gray-100 mt-1 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
