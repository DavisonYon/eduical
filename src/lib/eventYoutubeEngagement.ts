import { supabase } from './supabase'

const viewSessionKey = (videoId: string, userId: string) => `educial-yt-view:${videoId}:${userId}`

export type EventYoutubeEngagement = {
  viewCount: number
  likeCount: number
  userHasLiked: boolean
}

export type EventYoutubeEngagementFeed = EventYoutubeEngagement & {
  commentCount: number
}

const emptyFeedEngagement = (): EventYoutubeEngagementFeed => ({
  viewCount: 0,
  likeCount: 0,
  userHasLiked: false,
  commentCount: 0,
})

export async function fetchEventYoutubeEngagement(
  youtubeVideoId: string,
  userId: string | undefined
): Promise<EventYoutubeEngagement> {
  const viewsRes = await supabase
    .from('event_youtube_view_events')
    .select('id', { count: 'exact', head: true })
    .eq('youtube_video_id', youtubeVideoId)

  const likesRes = await supabase
    .from('event_youtube_likes')
    .select('id', { count: 'exact', head: true })
    .eq('youtube_video_id', youtubeVideoId)

  if (viewsRes.error) throw viewsRes.error
  if (likesRes.error) throw likesRes.error

  let userHasLiked = false
  if (userId) {
    const { data, error } = await supabase
      .from('event_youtube_likes')
      .select('id')
      .eq('youtube_video_id', youtubeVideoId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    userHasLiked = !!data
  }

  return {
    viewCount: viewsRes.count ?? 0,
    likeCount: likesRes.count ?? 0,
    userHasLiked,
  }
}

/** Records one Educial view; uses sessionStorage to avoid duplicate rows from React Strict Mode remounts. */
export async function recordEventYoutubeView(
  youtubeVideoId: string,
  userId: string
): Promise<void> {
  const key = viewSessionKey(youtubeVideoId, userId)
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) {
    return
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, '1')
  }
  const { error } = await supabase.from('event_youtube_view_events').insert({
    youtube_video_id: youtubeVideoId,
    user_id: userId,
  })
  if (error) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key)
    }
    throw error
  }
}

export async function addEventYoutubeLike(youtubeVideoId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('event_youtube_likes').insert({
    youtube_video_id: youtubeVideoId,
    user_id: userId,
  })
  if (error) throw error
}

export async function removeEventYoutubeLike(youtubeVideoId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_youtube_likes')
    .delete()
    .eq('youtube_video_id', youtubeVideoId)
    .eq('user_id', userId)
  if (error) throw error
}

/** Likes, Educial views, and comment counts for many videos (feed + dedupe). */
export async function fetchEventYoutubeEngagementBatch(
  youtubeVideoIds: string[],
  userId: string | undefined
): Promise<Record<string, EventYoutubeEngagementFeed>> {
  const unique = [...new Set(youtubeVideoIds.filter((id) => id && id.length === 11))]
  const out: Record<string, EventYoutubeEngagementFeed> = {}
  unique.forEach((id) => {
    out[id] = emptyFeedEngagement()
  })
  if (unique.length === 0) return out

  const [viewsRes, likesRes, commentsRes] = await Promise.all([
    supabase.from('event_youtube_view_events').select('youtube_video_id').in('youtube_video_id', unique),
    supabase.from('event_youtube_likes').select('youtube_video_id, user_id').in('youtube_video_id', unique),
    supabase.from('event_youtube_comments').select('youtube_video_id').in('youtube_video_id', unique),
  ])

  if (viewsRes.data) {
    viewsRes.data.forEach((row: { youtube_video_id: string }) => {
      const id = row.youtube_video_id
      if (!out[id]) out[id] = emptyFeedEngagement()
      out[id].viewCount += 1
    })
  }

  if (likesRes.data) {
    likesRes.data.forEach((row: { youtube_video_id: string; user_id: string }) => {
      const id = row.youtube_video_id
      if (!out[id]) out[id] = emptyFeedEngagement()
      out[id].likeCount += 1
      if (userId && row.user_id === userId) {
        out[id].userHasLiked = true
      }
    })
  }

  if (commentsRes.data) {
    commentsRes.data.forEach((row: { youtube_video_id: string }) => {
      const id = row.youtube_video_id
      if (!out[id]) out[id] = emptyFeedEngagement()
      out[id].commentCount += 1
    })
  }

  return out
}
