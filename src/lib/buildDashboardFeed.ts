import type { YoutubeRssVideo } from './youtubeRss'
import type { EventYoutubeEngagementFeed } from './eventYoutubeEngagement'

export type FeedPost = {
  id: string
  user_id: string
  content: string | null
  images: string[] | null
  gif_url: string | null
  youtube_video_id?: string | null
  youtube_published_at?: string | null
  location: string | null
  visibility: 'public' | 'friends'
  status: 'published' | 'draft'
  created_at: string
  updated_at: string
  profiles?: {
    id: string
    full_name: string | null
    email: string | null
    profile_picture: string | null
  } | null
  likesCount?: number
  userHasLiked?: boolean
  commentsCount?: number
}

export type ChannelFeedRow = {
  kind: 'channel'
  id: string
  video: YoutubeRssVideo
  engagement: EventYoutubeEngagementFeed
}

export type PostFeedRow = {
  kind: 'post'
  id: string
  post: FeedPost
}

export type DashboardFeedRow = ChannelFeedRow | PostFeedRow

function rowSortMs(row: DashboardFeedRow): number {
  if (row.kind === 'channel') {
    const t = Date.parse(row.video.published || '')
    return Number.isFinite(t) ? t : 0
  }
  const p = row.post
  // User posts (including shared videos) sort like normal posts — by share time, not YouTube publish date.
  const t = Date.parse(p.created_at)
  return Number.isFinite(t) ? t : 0
}

/** Merge channel RSS items with posts; omit RSS entries when a published post already references that video. */
export function buildDashboardFeed(
  rssVideos: YoutubeRssVideo[],
  posts: FeedPost[],
  engagementByVideo: Record<string, EventYoutubeEngagementFeed>
): DashboardFeedRow[] {
  const defaultEngagement: EventYoutubeEngagementFeed = {
    viewCount: 0,
    likeCount: 0,
    userHasLiked: false,
    commentCount: 0,
  }

  const sharedIds = new Set(
    posts.map((p) => p.youtube_video_id).filter((id): id is string => !!id && id.length === 11)
  )

  const channelRows: ChannelFeedRow[] = rssVideos
    .filter((v) => v.videoId && !sharedIds.has(v.videoId))
    .map((video) => ({
      kind: 'channel' as const,
      id: `channel-${video.videoId}`,
      video,
      engagement: engagementByVideo[video.videoId] ?? defaultEngagement,
    }))

  const postRows: PostFeedRow[] = posts.map((post) => ({
    kind: 'post' as const,
    id: post.id,
    post,
  }))

  return [...channelRows, ...postRows].sort((a, b) => rowSortMs(b) - rowSortMs(a))
}
