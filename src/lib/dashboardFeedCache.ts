import type { DashboardFeedRow } from './buildDashboardFeed'

/** How many newest posts participate in the DB fingerprint (must match loader). */
export const FEED_FINGERPRINT_POST_LIMIT = 15

export type FeedSnapshot = {
  userId: string
  feedRows: DashboardFeedRow[]
  dbFingerprint: string
  rssHeadVideoId: string | null
  refreshKeyAtFetch: number
  savedAt: number
}

let snapshot: FeedSnapshot | null = null

export function readFeedSnapshot(userId: string): FeedSnapshot | null {
  if (snapshot?.userId === userId) return snapshot
  return null
}

export function writeFeedSnapshot(next: FeedSnapshot): void {
  snapshot = next
}

/** Call on sign-out or when forcing a hard reload. */
export function invalidateDashboardFeedCache(userId?: string): void {
  if (userId == null || snapshot?.userId === userId) {
    snapshot = null
  }
}
