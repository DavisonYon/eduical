import { useState } from 'react'
import CreatePost from '../components/posts/CreatePost'
import PostFeed from '../components/posts/PostFeed'

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handlePostCreated = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <CreatePost onPostCreated={handlePostCreated} />
      <PostFeed refreshKey={refreshKey} />
    </div>
  )
}
