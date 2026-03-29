import { useState } from 'react'
import Layout from '../components/Layout'
import CreatePost from '../components/posts/CreatePost'
import PostFeed from '../components/posts/PostFeed'

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handlePostCreated = () => {
    // Trigger refresh of posts feed
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Create Post Component */}
        <CreatePost onPostCreated={handlePostCreated} />

        {/* Posts Feed */}
        <PostFeed refreshKey={refreshKey} />
      </div>
    </Layout>
  )
}
