/** Official Georgia Tech YouTube channel (@georgiatech) — used with public RSS (no API key). */
export const GEORGIA_TECH_CHANNEL_ID = 'UCFkaWOGpyFBVRf5jEeD_wrA'

const YT_NS = 'http://www.youtube.com/xml/schemas/2015'
const MEDIA_NS = 'http://search.yahoo.com/mrss/'

export type YoutubeRssVideo = {
  videoId: string
  title: string
  link: string
  published: string
  thumbnailUrl: string
  description: string
}

/** Same-origin path proxied in dev/preview (see vite.config.ts). YouTube does not send CORS for feeds. */
export function getChannelRssFetchUrl(channelId: string): string {
  const q = `channel_id=${encodeURIComponent(channelId)}`
  return `/youtube-rss?${q}`
}

function isYoutubeShortWatchUrl(href: string): boolean {
  try {
    const u = new URL(href)
    return u.pathname.toLowerCase().startsWith('/shorts/')
  } catch {
    return /\/shorts\//i.test(href)
  }
}

export function parseYoutubeAtomFeed(xml: string): YoutubeRssVideo[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const parseErr = doc.querySelector('parsererror')
  if (parseErr) {
    throw new Error('Could not parse YouTube RSS XML')
  }

  const feed = doc.querySelector('feed')
  if (!feed) return []

  const entries = [...feed.querySelectorAll(':scope > entry')]
  return entries
    .map((entry) => {
      const videoId =
        entry.getElementsByTagNameNS(YT_NS, 'videoId')[0]?.textContent?.trim() ||
        (() => {
          const id = entry.querySelector(':scope > id')?.textContent || ''
          const m = id.match(/yt:video:([^:]+)\s*$/)
          return m?.[1] || ''
        })()

      const title = entry.querySelector(':scope > title')?.textContent?.trim() || ''
      const published = entry.querySelector(':scope > published')?.textContent?.trim() || ''

      const linkEl = [...entry.querySelectorAll(':scope > link')].find(
        (l) => l.getAttribute('rel') === 'alternate' || !l.getAttribute('rel')
      )
      const link =
        linkEl?.getAttribute('href') ||
        (videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '')

      const thumb =
        entry.getElementsByTagNameNS(MEDIA_NS, 'thumbnail')[0]?.getAttribute('url') ||
        (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '')

      const desc =
        entry.getElementsByTagNameNS(MEDIA_NS, 'description')[0]?.textContent?.trim() || ''

      return { videoId, title, link, published, thumbnailUrl: thumb, description: desc }
    })
    .filter((v) => v.videoId && !isYoutubeShortWatchUrl(v.link))
}

export async function fetchChannelVideosFromRss(channelId: string): Promise<YoutubeRssVideo[]> {
  const url = getChannelRssFetchUrl(channelId)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`YouTube RSS returned ${res.status}`)
  }
  const xml = await res.text()
  return parseYoutubeAtomFeed(xml)
}
