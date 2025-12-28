# Implementation Plan: Feed Enhancements

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 7-10 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Frontend + Admin |
| **Dependencies** | None |

## Feedback Items Covered

| # | Feedback | Component |
|---|----------|-----------|
| 1 | 피드 부분, '발견' 부분을 없애고 피드 + 옆 부분에 같은 사이즈로 내 프로필 보이기 | Frontend |
| 2 | 프로필로 이동하면 '설명' 과 내가 쓴 피드들이 나오길 희망 | Frontend + Backend |
| 3 | 피드 부분에 내가 저장한 피드 모음 볼 수 있으면 희망 | Backend + Frontend |
| 4 | 리뷰를 남길 때 '피드 업로드' 체크되면 피드에 자동 업로드 | Backend + Frontend |
| 5 | 피드 글을 예시 폼에서 불러오기로 바로 불러와서 편하게 작성 (샵 관리자용) | Backend + Admin |

---

## Database Schema Changes

**File:** `src/migrations/XXX_add_feed_tables.sql`

```sql
-- Saved feeds table
CREATE TABLE IF NOT EXISTS saved_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_saved_feeds_user ON saved_feeds(user_id, created_at DESC);

-- Feed templates table (for shop owners)
CREATE TABLE IF NOT EXISTS feed_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50), -- event, promotion, daily, announcement
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feed_templates_shop ON feed_templates(shop_id);

-- Add user bio field if not exists
ALTER TABLE users
ADD COLUMN IF NOT EXISTS bio TEXT;
```

---

## Backend Implementation

### Step 1: Create Saved Feeds Types

**File:** `src/types/feed.types.ts` (add)

```typescript
// Saved feed
export interface SavedFeed {
  id: string;
  userId: string;
  postId: string;
  savedAt: string;
}

// Feed template
export interface FeedTemplate {
  id: string;
  shopId: string;
  name: string;
  content: string;
  category: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// User feed profile
export interface UserFeedProfile {
  id: string;
  nickname: string;
  profileImage: string | null;
  bio: string | null;
  postCount: number;
  posts: any[]; // Post type
}
```

### Step 2: Update Feed Service

**File:** `src/services/feed.service.ts` (add methods)

```typescript
/**
 * Save a post
 */
async savePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_feeds')
    .insert({
      user_id: userId,
      post_id: postId,
      created_at: new Date().toISOString(),
    });

  if (error && error.code !== '23505') { // Ignore duplicate
    throw new Error(`Failed to save post: ${error.message}`);
  }
}

/**
 * Unsave a post
 */
async unsavePost(userId: string, postId: string): Promise<void> {
  await supabase
    .from('saved_feeds')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);
}

/**
 * Get saved posts
 */
async getSavedPosts(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ posts: any[]; total: number }> {
  const { data, error, count } = await supabase
    .from('saved_feeds')
    .select(
      `
      id,
      created_at,
      post:posts (
        id,
        content,
        images,
        created_at,
        user:users (
          id,
          nickname,
          profile_image
        ),
        shop:shops (
          id,
          name
        ),
        _count:post_likes(count),
        _comment_count:post_comments(count)
      )
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get saved posts: ${error.message}`);
  }

  const posts = (data || []).map((s) => ({
    ...s.post,
    savedAt: s.created_at,
    isSaved: true,
  }));

  return { posts, total: count || 0 };
}

/**
 * Check if post is saved
 */
async isPostSaved(userId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('saved_feeds')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .single();

  return !!data;
}

/**
 * Get user's feed profile
 */
async getUserFeedProfile(
  userId: string,
  viewerId?: string
): Promise<UserFeedProfile> {
  // Get user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, nickname, profile_image, bio')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // Get user's posts
  const { data: posts, count } = await supabase
    .from('posts')
    .select(
      `
      id,
      content,
      images,
      created_at,
      _count:post_likes(count),
      _comment_count:post_comments(count)
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);

  return {
    id: user.id,
    nickname: user.nickname,
    profileImage: user.profile_image,
    bio: user.bio,
    postCount: count || 0,
    posts: posts || [],
  };
}
```

### Step 3: Create Review Auto-Post Logic

**File:** `src/services/review.service.ts` (modify)

```typescript
/**
 * Create review with optional auto-post to feed
 */
async createReview(
  data: CreateReviewData,
  options: { autoPostToFeed?: boolean } = {}
): Promise<Review> {
  const { autoPostToFeed = false } = options;

  // Create the review
  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      user_id: data.userId,
      shop_id: data.shopId,
      reservation_id: data.reservationId,
      rating: data.rating,
      content: data.content,
      images: data.images,
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create review: ${error.message}`);
  }

  // Auto-post to feed if requested
  if (autoPostToFeed) {
    await this.createFeedPostFromReview(review, data);
  }

  return this.mapReview(review);
}

/**
 * Create feed post from review
 */
private async createFeedPostFromReview(
  review: any,
  data: CreateReviewData
): Promise<void> {
  // Get shop info
  const { data: shop } = await supabase
    .from('shops')
    .select('name')
    .eq('id', data.shopId)
    .single();

  // Create feed content
  const content = `${shop?.name}에서 시술 받았어요! ⭐ ${data.rating}점\n\n${data.content}`;

  await supabase.from('posts').insert({
    user_id: data.userId,
    shop_id: data.shopId,
    content,
    images: data.images,
    type: 'review',
    source_id: review.id, // Link to original review
    status: 'active',
    created_at: new Date().toISOString(),
  });
}
```

### Step 4: Create Feed Template Service

**File:** `src/services/feed-template.service.ts`

```typescript
/**
 * Feed Template Service
 * For shop owner feed template management
 */

import { supabase } from '@/config/supabase';
import { FeedTemplate } from '@/types/feed.types';

export class FeedTemplateService {
  /**
   * Get templates for a shop
   */
  async getTemplates(shopId: string): Promise<FeedTemplate[]> {
    const { data, error } = await supabase
      .from('feed_templates')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }

    return (data || []).map(this.mapTemplate);
  }

  /**
   * Create template
   */
  async createTemplate(
    shopId: string,
    data: { name: string; content: string; category?: string }
  ): Promise<FeedTemplate> {
    const { data: template, error } = await supabase
      .from('feed_templates')
      .insert({
        shop_id: shopId,
        name: data.name,
        content: data.content,
        category: data.category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return this.mapTemplate(template);
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    shopId: string,
    data: Partial<{ name: string; content: string; category: string }>
  ): Promise<FeedTemplate> {
    const { data: template, error } = await supabase
      .from('feed_templates')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return this.mapTemplate(template);
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, shopId: string): Promise<void> {
    await supabase
      .from('feed_templates')
      .delete()
      .eq('id', templateId)
      .eq('shop_id', shopId);
  }

  private mapTemplate(data: any): FeedTemplate {
    return {
      id: data.id,
      shopId: data.shop_id,
      name: data.name,
      content: data.content,
      category: data.category,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export const feedTemplateService = new FeedTemplateService();
```

### Step 5: Create API Endpoints

**File:** `src/controllers/feed.controller.ts` (add)

```typescript
// Save post
async savePost(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { postId } = req.params;

  await feedService.savePost(userId, postId);
  res.json({ success: true, message: '저장되었습니다.' });
}

// Unsave post
async unsavePost(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { postId } = req.params;

  await feedService.unsavePost(userId, postId);
  res.json({ success: true, message: '저장이 취소되었습니다.' });
}

// Get saved posts
async getSavedPosts(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { limit = '20', offset = '0' } = req.query;

  const result = await feedService.getSavedPosts(
    userId,
    parseInt(limit as string),
    parseInt(offset as string)
  );

  res.json({ success: true, data: result });
}

// Get user feed profile
async getUserFeedProfile(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const viewerId = req.user?.id;

  const profile = await feedService.getUserFeedProfile(userId, viewerId);
  res.json({ success: true, data: profile });
}
```

**File:** `src/routes/feed.routes.ts` (add)

```typescript
router.post('/posts/:postId/save', authenticate, asyncHandler((req, res) => feedController.savePost(req, res)));
router.delete('/posts/:postId/save', authenticate, asyncHandler((req, res) => feedController.unsavePost(req, res)));
router.get('/saved', authenticate, asyncHandler((req, res) => feedController.getSavedPosts(req, res)));
router.get('/users/:userId/profile', asyncHandler((req, res) => feedController.getUserFeedProfile(req, res)));
```

---

## Frontend Implementation

### Step 6: Update Feed Header

**File:** `src/app/feed/page.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// New Feed Header - Remove '발견', add profile
function FeedHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-10 bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">피드</h1>
          {/* Profile Avatar next to title */}
          <Link href={`/feed/profile/${user?.id}`}>
            <Avatar className="h-8 w-8 ring-2 ring-primary/20">
              <AvatarImage src={user?.profileImage} />
              <AvatarFallback>
                {user?.nickname?.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>

        {/* Saved Posts */}
        <Link href="/feed/saved">
          <Button variant="ghost" size="icon">
            <Bookmark className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
}

// Main feed page - NO more tabs, just single feed
export default function FeedPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <FeedHeader />
      {/* Feed content */}
    </div>
  );
}
```

### Step 7: Create User Feed Profile Page

**File:** `src/app/feed/profile/[userId]/page.tsx`

```tsx
'use client';

import React from 'react';
import { ArrowLeft, Edit } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { FeedPostCard } from '@/components/feed/FeedPostCard';

export default function UserFeedProfilePage() {
  const router = useRouter();
  const { userId } = useParams();
  const { user: currentUser } = useAuth();

  const isOwnProfile = currentUser?.id === userId;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['userFeedProfile', userId],
    queryFn: async () => {
      const response = await api.get(`/feed/users/${userId}/profile`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Skeleton className="h-40 w-full mb-4" />
        <Skeleton className="h-20 w-full mb-2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">프로필</h1>
          </div>
          {isOwnProfile && (
            <Link href="/profile/edit">
              <Button variant="ghost" size="icon">
                <Edit className="h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Profile Card */}
      <Card className="m-4">
        <div className="p-6 text-center">
          <Avatar className="h-20 w-20 mx-auto mb-3">
            <AvatarImage src={profile?.profileImage} />
            <AvatarFallback className="text-2xl">
              {profile?.nickname?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-semibold">{profile?.nickname}</h2>
          {profile?.bio && (
            <p className="text-sm text-gray-600 mt-2">{profile.bio}</p>
          )}
          <p className="text-sm text-gray-400 mt-2">
            게시물 {profile?.postCount}개
          </p>
        </div>
      </Card>

      {/* User's Posts */}
      <div className="px-4 pb-4">
        <h3 className="font-medium mb-3">게시물</h3>
        <div className="space-y-4">
          {profile?.posts?.map((post: any) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
          {profile?.posts?.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              아직 게시물이 없습니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 8: Create Saved Feeds Page

**File:** `src/app/feed/saved/page.tsx`

```tsx
'use client';

import React from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FeedPostCard } from '@/components/feed/FeedPostCard';

export default function SavedFeedsPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['savedFeeds'],
    queryFn: async () => {
      const response = await api.get('/feed/saved');
      return response.data.data;
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">저장한 피드</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {data?.posts?.map((post: any) => (
          <FeedPostCard key={post.id} post={post} isSaved />
        ))}

        {data?.posts?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Bookmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>저장한 피드가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 9: Add Save Button to Post Card

**File:** `src/components/feed/FeedPostCard.tsx` (modify)

```tsx
// Add save/bookmark functionality
const [isSaved, setIsSaved] = useState(post.isSaved || false);

const handleSave = async () => {
  try {
    if (isSaved) {
      await api.delete(`/feed/posts/${post.id}/save`);
      setIsSaved(false);
      toast({ title: '저장이 취소되었습니다.' });
    } else {
      await api.post(`/feed/posts/${post.id}/save`);
      setIsSaved(true);
      toast({ title: '저장되었습니다.' });
    }
  } catch (error) {
    toast({ title: '오류가 발생했습니다.', variant: 'destructive' });
  }
};

// In the JSX, add bookmark button next to like
<Button variant="ghost" size="icon" onClick={handleSave}>
  <Bookmark
    className={cn(
      'h-5 w-5',
      isSaved ? 'fill-current text-primary' : 'text-gray-600'
    )}
  />
</Button>
```

### Step 10: Add Auto-Post Checkbox to Review Form

**File:** `src/components/reviews/ReviewForm.tsx` (modify)

```tsx
const [autoPostToFeed, setAutoPostToFeed] = useState(true);

// In the JSX, add checkbox
<div className="flex items-center gap-2 mt-4">
  <Checkbox
    id="autoPost"
    checked={autoPostToFeed}
    onCheckedChange={(checked) => setAutoPostToFeed(!!checked)}
  />
  <label htmlFor="autoPost" className="text-sm text-gray-600">
    피드에 자동 업로드
  </label>
</div>

// On submit, include the flag
const handleSubmit = async () => {
  await api.post('/reviews', {
    ...reviewData,
    autoPostToFeed,
  });
};
```

---

## Admin Implementation

### Step 11: Feed Template Management

**File:** `src/app/dashboard/my-shop/feed/page.tsx` (add template section)

```tsx
'use client';

import React, { useState } from 'react';
import { Plus, FileText, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { toast } from 'sonner';

const templateCategories = [
  { value: 'event', label: '이벤트' },
  { value: 'promotion', label: '프로모션' },
  { value: 'daily', label: '일상' },
  { value: 'announcement', label: '공지' },
];

export function FeedTemplateSection({ onSelectTemplate }) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    category: '',
  });

  const { data: templates } = useQuery({
    queryKey: ['feedTemplates'],
    queryFn: async () => {
      const response = await adminApi.get('/shop-owner/feed-templates');
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await adminApi.post('/shop-owner/feed-templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['feedTemplates']);
      setIsDialogOpen(false);
      setNewTemplate({ name: '', content: '', category: '' });
      toast.success('템플릿이 저장되었습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await adminApi.delete(`/shop-owner/feed-templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['feedTemplates']);
      toast.success('템플릿이 삭제되었습니다.');
    },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">피드 템플릿</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              새 템플릿
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 템플릿 만들기</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="템플릿 이름"
                value={newTemplate.name}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, name: e.target.value })
                }
              />
              <Select
                value={newTemplate.category}
                onValueChange={(v) =>
                  setNewTemplate({ ...newTemplate, category: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {templateCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="템플릿 내용"
                rows={5}
                value={newTemplate.content}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, content: e.target.value })
                }
              />
              <Button
                className="w-full"
                onClick={() => createMutation.mutate(newTemplate)}
                disabled={!newTemplate.name || !newTemplate.content}
              >
                저장
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {templates?.map((template: any) => (
          <div
            key={template.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div
              className="flex-1 cursor-pointer"
              onClick={() => onSelectTemplate(template)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-sm">{template.name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {template.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteMutation.mutate(template.id)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}

        {templates?.length === 0 && (
          <p className="text-center text-gray-500 py-4 text-sm">
            저장된 템플릿이 없습니다
          </p>
        )}
      </div>
    </Card>
  );
}
```

---

## Files Summary

### Backend

| File | Action |
|------|--------|
| `src/migrations/XXX_add_feed_tables.sql` | CREATE |
| `src/types/feed.types.ts` | MODIFY |
| `src/services/feed.service.ts` | MODIFY |
| `src/services/review.service.ts` | MODIFY |
| `src/services/feed-template.service.ts` | CREATE |
| `src/controllers/feed.controller.ts` | MODIFY |
| `src/controllers/shop-owner/feed.controller.ts` | MODIFY |
| `src/routes/feed.routes.ts` | MODIFY |
| `src/routes/shop-owner/feed.routes.ts` | MODIFY |

### Frontend

| File | Action |
|------|--------|
| `src/app/feed/page.tsx` | MODIFY |
| `src/app/feed/profile/[userId]/page.tsx` | CREATE |
| `src/app/feed/saved/page.tsx` | CREATE |
| `src/components/feed/FeedPostCard.tsx` | MODIFY |
| `src/components/reviews/ReviewForm.tsx` | MODIFY |

### Admin

| File | Action |
|------|--------|
| `src/app/dashboard/my-shop/feed/page.tsx` | MODIFY |

---

## Testing Checklist

- [ ] '발견' tab removed, profile avatar visible
- [ ] User feed profile shows bio and posts
- [ ] Posts can be saved/unsaved
- [ ] Saved posts page works
- [ ] Auto-post checkbox in review form
- [ ] Reviews can auto-post to feed
- [ ] Feed templates can be created
- [ ] Templates can be loaded into post
- [ ] Templates can be deleted
