# Database Schema Documentation

This document tracks all database tables, their schemas, and relationships for the Educial social media application.

**Last Updated:** 2024-01-22

**Note:** Always refer to this document when making database changes and update it accordingly.

---

## Tables

### 1. `profiles` (User Profiles)

Stores additional user profile information beyond authentication.

**Columns:**
- `id` (UUID, PRIMARY KEY) - References `auth.users(id)`
- `full_name` (TEXT) - User's full name
- `email` (TEXT) - User's email address
- `degree_type` (TEXT) - Degree type: 'undergrad', 'masters', 'phd', 'post-bach', 'continuing-edu'
- `graduation_year` (INTEGER) - Expected or actual graduation year (optional)
- `past_schools` (JSONB) - Array of past schools/degrees (optional)
- `major` (TEXT) - User's major/field of study (optional)
- `linkedin_url` (TEXT) - LinkedIn profile URL (optional)
- `github_url` (TEXT) - GitHub profile URL (optional)
- `website_url` (TEXT) - Personal website URL (optional)
- `profile_picture` (TEXT) - Base64 encoded profile picture or URL (optional)
- `created_at` (TIMESTAMP WITH TIME ZONE) - Account creation timestamp
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Last update timestamp

**Indexes:**
- Index on `degree_type` for filtering by degree type
- Index on `graduation_year` for sorting/filtering by year

**Row Level Security (RLS):**
- Users can view their own profile
- Users can update their own profile
- Users can insert their own profile

**Status:** ✅ Created (Run migrations: `000_create_profiles_table.sql`, `002_update_profiles_rls.sql`, `004_update_profiles_add_fields.sql`)

---

### 2. `posts`

Stores user posts/content in the social media feed.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique post identifier
- `user_id` (UUID, FOREIGN KEY) - References `auth.users(id)`
- `content` (TEXT) - Post text content
- `images` (JSONB) - Array of base64 encoded images
- `gif_url` (TEXT) - URL to GIF (from Giphy/Tenor)
- `location` (TEXT) - Location tag/name
- `visibility` (TEXT) - Post visibility: 'public' or 'friends'
- `status` (TEXT) - Post status: 'published' or 'draft'
- `created_at` (TIMESTAMP WITH TIME ZONE) - Post creation timestamp
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Last update timestamp

**Indexes:**
- Index on `user_id` for user posts queries
- Index on `status` for filtering published/draft posts
- Index on `created_at` for chronological ordering

**Row Level Security (RLS):**
- Users can view published posts (public or from friends)
- Users can create their own posts
- Users can update their own posts
- Users can delete their own posts

**Status:** ✅ Created (Run migration: `supabase/migrations/001_create_posts_table.sql`)

---

### 3. `friendships`

Stores friend requests and relationships between users.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Unique friendship identifier
- `requester_id` (UUID, FOREIGN KEY) - References `auth.users(id)` - User who sent the request
- `addressee_id` (UUID, FOREIGN KEY) - References `auth.users(id)` - User who received the request
- `status` (TEXT) - Friendship status: 'pending', 'accepted', or 'blocked'
- `created_at` (TIMESTAMP WITH TIME ZONE) - Request creation timestamp
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Last update timestamp

**Constraints:**
- `no_self_friendship` - Users cannot friend themselves
- `unique_friendship` - Only one friendship record per user pair

**Indexes:**
- Index on `requester_id` for finding sent requests
- Index on `addressee_id` for finding received requests
- Index on `status` for filtering by status
- Index on `created_at` for chronological ordering
- Composite index on `(requester_id, addressee_id)` for pair lookups

**Row Level Security (RLS):**
- Users can view friendships where they are requester or addressee
- Users can create friend requests (as requester)
- Users can update received requests (to accept/decline)
- Users can cancel pending requests they sent
- Users can delete friendships they're part of

**Helper Functions:**
- `get_mutual_friends_count(user1_id, user2_id)` - Returns count of mutual friends between two users

**Status:** ✅ Created (Run migration: `supabase/migrations/003_create_friendships_table.sql`)

---

## Relationships

- `posts.user_id` → `auth.users(id)` (Many-to-One)
- `profiles.id` → `auth.users(id)` (One-to-One)
- `friendships.requester_id` → `auth.users(id)` (Many-to-One)
- `friendships.addressee_id` → `auth.users(id)` (Many-to-One)

---

## Future Tables (Planned)

### `comments`
- Comments on posts

### `likes` / `reactions`
- User reactions to posts

### `notifications`
- User notifications

---

## Notes

- All tables use UUID for primary keys
- All tables have `created_at` and `updated_at` timestamps
- Row Level Security (RLS) is enabled on all tables
- Timestamps use UTC timezone
