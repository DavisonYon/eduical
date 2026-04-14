import { supabase } from './supabase'
import { fetchEventYoutubeEngagementBatch } from './eventYoutubeEngagement'
import {
  GEORGIA_TECH_CHANNEL_ID,
  fetchChannelVideosFromRss,
  type YoutubeRssVideo,
} from './youtubeRss'
import { buildDashboardFeed, type DashboardFeedRow, type FeedPost } from './buildDashboardFeed'
import { FEED_FINGERPRINT_POST_LIMIT, type FeedSnapshot } from './dashboardFeedCache'

function parseImages(raw: unknown): string[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  return null
}

function fingerprintFromPostRows(rows: { id: string; updated_at: string }[]): string {
  return rows
    .slice(0, FEED_FINGERPRINT_POST_LIMIT)
    .map((p) => `${p.id}:${p.updated_at}`)
    .join('|')
}

/** Single lightweight query: detect new/edited/deleted posts vs cached feed. */
export async function fetchPublishedPostsFingerprint(): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, updated_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(FEED_FINGERPRINT_POST_LIMIT)

  if (error) throw error
  return fingerprintFromPostRows((data ?? []) as { id: string; updated_at: string }[])
}

async function fetchRssHeadVideoId(): Promise<{ videoId: string | null; ok: boolean }> {
  try {
    const list = await fetchChannelVideosFromRss(GEORGIA_TECH_CHANNEL_ID)
    return { videoId: list[0]?.videoId ?? null, ok: true }
  } catch {
    return { videoId: null, ok: false }
  }
}

/**
 * When cache exists and refreshKey unchanged: two cheap checks (DB fingerprint + RSS head).
 * Full feed load runs only if something likely changed (or cache expired).
 */
export async function shouldRefreshDashboardFeed(options: {
  cached: FeedSnapshot | null
  refreshKey: number
}): Promise<boolean> {
  const { cached, refreshKey } = options
  const rk = refreshKey || 0

  if (!cached || !cached.feedRows.length) return true
  if (rk !== cached.refreshKeyAtFetch) return true

  const [fp, rss] = await Promise.all([fetchPublishedPostsFingerprint(), fetchRssHeadVideoId()])
  if (fp !== cached.dbFingerprint) return true
  if (rss.ok && rss.videoId !== cached.rssHeadVideoId) return true
  return false
}

export async function loadDashboardFeed(userId: string): Promise<{
  feedRows: DashboardFeedRow[]
  dbFingerprint: string
  rssHeadVideoId: string | null
}> {
  const rssPromise = fetchChannelVideosFromRss(GEORGIA_TECH_CHANNEL_ID).catch(() => [] as YoutubeRssVideo[])

  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50)

  if (postsError) throw postsError

  const rssVideos = await rssPromise
  const rssHeadVideoId = rssVideos[0]?.videoId ?? null

  if (!postsData || postsData.length === 0) {
    const dbFingerprint = ''
    const sharedIdsEmpty = new Set<string>()
    const channelOnly = rssVideos.filter((v) => v.videoId && !sharedIdsEmpty.has(v.videoId))
    const vids = channelOnly.map((v) => v.videoId)
    const engagementOnly = await fetchEventYoutubeEngagementBatch(vids, userId)
    const merged = buildDashboardFeed(rssVideos, [], engagementOnly)
    return { feedRows: merged, dbFingerprint, rssHeadVideoId }
  }

  const dbFingerprint = fingerprintFromPostRows(postsData as { id: string; updated_at: string }[])

  const userIds = [...new Set(postsData.map((p) => p.user_id))]
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, email, profile_picture')
    .in('id', userIds)

  const postsWithProfiles: FeedPost[] = postsData.map((post: Record<string, unknown>) => {
    const profile = profilesData?.find((p) => p.id === post.user_id)
    return {
      ...(post as unknown as FeedPost),
      images: parseImages(post.images),
      profiles: profile || {
        id: String(post.user_id),
        full_name: null,
        email: null,
        profile_picture: null,
      },
    }
  })

  const nonYoutubePostIds = postsWithProfiles.filter((p) => !p.youtube_video_id).map((p) => p.id)
  const youtubeIdsFromPosts = postsWithProfiles
    .map((p) => p.youtube_video_id)
    .filter((id): id is string => typeof id === 'string' && id.length === 11)

  const likesByPost: Record<string, { count: number; userHasLiked: boolean }> = {}
  postsWithProfiles.forEach((post) => {
    if (!post.youtube_video_id) {
      likesByPost[post.id] = { count: 0, userHasLiked: false }
    }
  })

  if (nonYoutubePostIds.length > 0) {
    const { data: likesData } = await supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', nonYoutubePostIds)

    if (likesData) {
      likesData.forEach((like: { post_id: string; user_id: string }) => {
        if (!likesByPost[like.post_id]) {
          likesByPost[like.post_id] = { count: 0, userHasLiked: false }
        }
        likesByPost[like.post_id].count += 1
        if (userId && like.user_id === userId) {
          likesByPost[like.post_id].userHasLiked = true
        }
      })
    }
  }

  const commentsCountByPost: Record<string, number> = {}
  if (nonYoutubePostIds.length > 0) {
    const { data: commentsData } = await supabase
      .from('post_comments')
      .select('post_id')
      .in('post_id', nonYoutubePostIds)
    if (commentsData) {
      commentsData.forEach((row: { post_id: string }) => {
        commentsCountByPost[row.post_id] = (commentsCountByPost[row.post_id] || 0) + 1
      })
    }
  }

  const sharedIds = new Set(
    postsWithProfiles.map((p) => p.youtube_video_id).filter((id): id is string => !!id && id.length === 11)
  )
  const channelVideoIds = rssVideos.filter((v) => v.videoId && !sharedIds.has(v.videoId)).map((v) => v.videoId)
  const engagementVideoIds = [...new Set([...channelVideoIds, ...youtubeIdsFromPosts])]
  const engagementByVideo = await fetchEventYoutubeEngagementBatch(engagementVideoIds, userId)

  const enrichedPosts: FeedPost[] = postsWithProfiles.map((post) => {
    if (post.youtube_video_id) {
      const e = engagementByVideo[post.youtube_video_id] ?? {
        viewCount: 0,
        likeCount: 0,
        userHasLiked: false,
        commentCount: 0,
      }
      return {
        ...post,
        likesCount: e.likeCount,
        userHasLiked: e.userHasLiked,
        commentsCount: e.commentCount,
      }
    }
    return {
      ...post,
      likesCount: likesByPost[post.id]?.count ?? 0,
      userHasLiked: likesByPost[post.id]?.userHasLiked ?? false,
      commentsCount: commentsCountByPost[post.id] ?? 0,
    }
  })

  const feedRows = buildDashboardFeed(rssVideos, enrichedPosts, engagementByVideo)
  return { feedRows, dbFingerprint, rssHeadVideoId }
}
