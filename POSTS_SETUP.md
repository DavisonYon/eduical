# Posts Feature Setup Guide

## Database Setup

### 1. Run the Posts Table Migration

Go to your Supabase Dashboard → **SQL Editor** → **New Query**

Copy and paste the entire contents of `supabase/migrations/001_create_posts_table.sql` and run it.

**Or** run it via Supabase CLI:
```bash
supabase db push
```

### 2. Verify Table Creation

After running the migration, verify the table was created:
- Go to **Table Editor** in Supabase Dashboard
- You should see the `posts` table
- Check that all columns and indexes are created

## Environment Variables

Add the following to your `.env` file (optional, for GIF support):

```env
VITE_GIPHY_API_KEY=your_giphy_api_key_here
```

**To get a Giphy API key:**
1. Go to [https://developers.giphy.com](https://developers.giphy.com)
2. Sign up for a free account
3. Create an app
4. Copy your API key
5. Add it to your `.env` file

**Note:** GIF functionality will show an error message if the API key is not configured, but the rest of the post creation will work.

## Features Implemented

✅ **Post Creation**
- Text content
- Multiple image uploads (stored as base64)
- GIF support (via Giphy API)
- Location tagging
- Visibility settings (Public / Friends Only)
- Draft / Publish status

✅ **Database Schema**
- Posts table with all necessary columns
- Row Level Security (RLS) policies
- Indexes for performance
- Automatic timestamp updates

## Post Creation UI

The post creation form is available on the Home page (`/`) and includes:

1. **Text Input** - Multi-line textarea for post content
2. **Image Upload** - Click "Add Images" to upload multiple images
3. **GIF Picker** - Click "Add GIF" to search and select GIFs
4. **Location Tag** - Click "Add Location" to tag a location
5. **Visibility Toggle** - Choose between "Public" or "Friends Only"
6. **Save Options** - "Save as Draft" or "Publish"

## Data Storage

- **Images**: Stored as base64 strings in JSONB array
- **GIFs**: Stored as URL strings (from Giphy)
- **Location**: Stored as plain text
- **Content**: Stored as TEXT

## Security

- Row Level Security (RLS) is enabled
- Users can only:
  - View published public posts
  - View their own posts (including drafts)
  - Create their own posts
  - Update their own posts
  - Delete their own posts

## Next Steps

- [ ] Create posts feed display component
- [ ] Add post editing functionality
- [ ] Add post deletion
- [ ] Implement friends system for "Friends Only" visibility
- [ ] Add image optimization before storing as base64
- [ ] Add location autocomplete/search

## Troubleshooting

**"relation 'posts' does not exist"**
- Make sure you've run the migration SQL in Supabase

**GIF picker shows error**
- Add `VITE_GIPHY_API_KEY` to your `.env` file
- Restart your dev server after adding the key

**Can't create posts**
- Check that you're logged in
- Verify RLS policies are set up correctly
- Check browser console for errors
