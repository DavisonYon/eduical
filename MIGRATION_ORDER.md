# Migration Order

Run these migrations in Supabase SQL Editor in this exact order:

## 1. Create Profiles Table
**File:** `supabase/migrations/000_create_profiles_table.sql`

This creates the `profiles` table with:
- User profile information
- RLS policies
- Auto-create trigger for new users

**Run this FIRST** before any other migrations that reference the profiles table.

## 2. Create Posts Table
**File:** `supabase/migrations/001_create_posts_table.sql`

This creates the `posts` table with:
- Post content, images, GIFs, location
- Visibility and status fields
- RLS policies

## 3. Update Profiles RLS
**File:** `supabase/migrations/002_update_profiles_rls.sql`

This updates the profiles RLS to allow viewing other users' profiles (for displaying names in posts).

**Run this AFTER** the profiles table is created.

## 4. Create Friendships Table
**File:** `supabase/migrations/003_create_friendships_table.sql`

This creates the `friendships` table for friend requests and relationships with:
- Friend request system (pending, accepted, blocked)
- RLS policies for managing friendships
- Helper function for mutual friends

**Run this AFTER** the profiles table is created.

## 5. Update Profiles with Additional Fields
**File:** `supabase/migrations/004_update_profiles_add_fields.sql`

This adds additional profile fields to the `profiles` table:
- Degree type (undergrad, masters, phd, post-bach, continuing-edu)
- Graduation year
- Past schools/degrees (JSONB array)
- Major
- LinkedIn, GitHub, and website URLs
- Profile picture (base64)

**Run this AFTER** the profiles table is created.

## 6. Create Post Likes and Comments Tables
**File:** `supabase/migrations/005_create_post_likes_and_comments.sql`

This creates the `post_likes` and `post_comments` tables:
- `post_likes` for tracking which users have liked which posts
- `post_comments` for storing comments on posts
- RLS policies allowing any user to read likes/comments
- RLS policies allowing users to manage their own likes and comments

## 7. Create Comment Likes Table
**File:** `supabase/migrations/006_create_comment_likes_table.sql`

This creates the `comment_likes` table:
- Tracks which users have liked which comments
- Enforces one like per user per comment
- Allows anyone to read like counts
- Allows users to like/unlike comments they see

## 8. Add User Roles to Profiles
**File:** `supabase/migrations/007_add_user_roles.sql`

This adds a `role` field to the `profiles` table for basic role-based access control:
- Supported roles: `super_admin`, `admin`, `member`, `unverified`, `banned`
- Defaults all users to `member`
- Sets `davison.yon@gmail.com` as `super_admin` and keeps everyone else as `member`

## 9. Create Organizations and Memberships
**File:** `supabase/migrations/008_create_organizations.sql`

This creates the `organizations` and `organization_memberships` tables:
- `organizations` holds the core group info (name, description, image, privacy)
- `organization_memberships` tracks which users belong to which org and their role/status
- Basic RLS allows authenticated users to read orgs/memberships, and manage their own membership rows

## 10. Update Organization Membership Policies
**File:** `supabase/migrations/009_update_org_membership_policies.sql`

This expands RLS so that:
- `super_admin` and `admin` users (based on `profiles.role`) can manage any membership row
- Normal users can still only manage their own membership rows

## 11. Add Slugs to Organizations
**File:** `supabase/migrations/010_add_org_slugs.sql`

This adds a `slug` field to `organizations` for clean URLs:
- Backfills a slug from each existing org name (lowercased, spaces to dashes, symbols stripped)
- Enforces that every organization has a unique, non-null slug

## 12. Create Chat Tables
**File:** `supabase/migrations/011_create_chat_tables.sql`

This creates the live chat feature:
- `user_blocks` – when users block others
- `conversations` – 1:1 direct message threads (active or request_pending)
- `messages` – individual messages with read receipts
- Enables Supabase Realtime on `messages` for live updates
- RLS policies for secure access

**Run this AFTER** the profiles and friendships tables exist.

## 13. Add Desktop Toasts Preference
**File:** `supabase/migrations/012_add_desktop_toasts_preference.sql`

Adds `desktop_toasts_enabled` to profiles - controls whether bottom-right toast notifications are shown (e.g. new messages). Default: true.

**Run this AFTER** the profiles table exists.

---

## Quick Setup

If you're setting up for the first time, run all five migrations in order:

1. `000_create_profiles_table.sql`
2. `001_create_posts_table.sql`
3. `002_update_profiles_rls.sql`
4. `003_create_friendships_table.sql`
5. `004_update_profiles_add_fields.sql`

## Troubleshooting

**Error: "relation 'public.profiles' does not exist"**
- You need to run `000_create_profiles_table.sql` first

**Error: "relation 'public.posts' does not exist"**
- You need to run `001_create_posts_table.sql`

**Error: "policy does not exist"**
- Make sure you've run the table creation migrations first
