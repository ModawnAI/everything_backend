# Implementation Plan: Post Editing UI

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 4-6 hours |
| **Risk Level** | Low |
| **Components Affected** | Frontend App |
| **Dependencies** | Backend API (already implemented) |

## Problem Statement

Post creation works, but editing is disabled in the frontend:

```typescript
// Frontend: Post editing is disabled
// Users can create posts but cannot edit them after publishing
// Backend API supports post editing, frontend does not expose it
```

**Current State:**
- `FeedCreatePost` component exists for creating new posts
- No `FeedEditPost` component exists
- Backend `PUT /api/posts/:id` endpoint exists and works
- Users have no way to correct typos or update their posts

**Impact:**
1. Poor user experience - cannot fix mistakes
2. Users may delete and recreate posts instead
3. Missing standard social media functionality

---

## Backend API (Already Implemented)

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts/:id` | Get post details |
| PUT | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |

### Update Post Request

```typescript
// PUT /api/posts/:id
interface UpdatePostRequest {
  content?: string;
  image_urls?: string[];
  hashtags?: string[];
  mentioned_shop_ids?: string[];
  visibility?: 'public' | 'followers' | 'private';
}

// Response
interface UpdatePostResponse {
  success: boolean;
  data: {
    id: string;
    user_id: string;
    content: string;
    image_urls: string[];
    hashtags: string[];
    visibility: string;
    updated_at: string;
  };
}
```

---

## Frontend Implementation

### Step 1: Create Edit Post Types

**File:** `src/types/post.types.ts` (update existing)

```typescript
/**
 * Post types - Add edit-related types
 */

// Edit mode state
export interface PostEditState {
  isEditing: boolean;
  originalPost: Post | null;
  hasChanges: boolean;
}

// Edit post form data
export interface EditPostFormData {
  content: string;
  image_urls: string[];
  hashtags: string[];
  mentioned_shop_ids: string[];
  visibility: 'public' | 'followers' | 'private';
}

// Post with edit permissions
export interface PostWithPermissions extends Post {
  canEdit: boolean;
  canDelete: boolean;
  isOwner: boolean;
}
```

### Step 2: Create useEditPost Hook

**File:** `src/hooks/use-edit-post.ts`

```typescript
/**
 * useEditPost Hook
 * Handles post editing functionality
 */

'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Post, EditPostFormData } from '@/types/post.types';

interface UseEditPostOptions {
  onSuccess?: (post: Post) => void;
  onError?: (error: Error) => void;
}

export function useEditPost(options: UseEditPostOptions = {}) {
  const { onSuccess, onError } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  // Update post mutation
  const updateMutation = useMutation({
    mutationFn: async ({ postId, data }: { postId: string; data: EditPostFormData }) => {
      const response = await api.put(`/posts/${postId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', data.id] });
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });

      toast({
        title: '게시물 수정 완료',
        description: '게시물이 성공적으로 수정되었습니다.',
      });

      setIsEditing(false);
      setEditingPostId(null);
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: '수정 실패',
        description: error.message || '게시물 수정에 실패했습니다.',
        variant: 'destructive',
      });
      onError?.(error);
    },
  });

  // Start editing
  const startEditing = useCallback((postId: string) => {
    setIsEditing(true);
    setEditingPostId(postId);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditingPostId(null);
  }, []);

  // Save changes
  const saveChanges = useCallback(
    async (postId: string, data: EditPostFormData) => {
      await updateMutation.mutateAsync({ postId, data });
    },
    [updateMutation]
  );

  return {
    isEditing,
    editingPostId,
    isLoading: updateMutation.isPending,
    startEditing,
    cancelEditing,
    saveChanges,
  };
}

export default useEditPost;
```

### Step 3: Create FeedEditPost Component

**File:** `src/components/feed/FeedEditPost.tsx`

```tsx
/**
 * FeedEditPost Component
 * Modal dialog for editing existing posts
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Image as ImageIcon, Hash, AtSign, Globe, Users, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useEditPost } from '@/hooks/use-edit-post';
import { cn } from '@/lib/utils';
import type { Post, EditPostFormData } from '@/types/post.types';

interface FeedEditPostProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (post: Post) => void;
}

const MAX_CONTENT_LENGTH = 2000;
const MAX_HASHTAGS = 10;
const MAX_IMAGES = 5;

const visibilityOptions = [
  { value: 'public', label: '전체 공개', icon: Globe, description: '모든 사용자가 볼 수 있습니다' },
  { value: 'followers', label: '팔로워 공개', icon: Users, description: '팔로워만 볼 수 있습니다' },
  { value: 'private', label: '비공개', icon: Lock, description: '나만 볼 수 있습니다' },
] as const;

export function FeedEditPost({ post, isOpen, onClose, onSuccess }: FeedEditPostProps) {
  const { saveChanges, isLoading } = useEditPost({
    onSuccess: (updatedPost) => {
      onSuccess?.(updatedPost);
      onClose();
    },
  });

  // Form state
  const [content, setContent] = useState(post.content || '');
  const [imageUrls, setImageUrls] = useState<string[]>(post.image_urls || []);
  const [hashtags, setHashtags] = useState<string[]>(post.hashtags || []);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>(
    (post.visibility as 'public' | 'followers' | 'private') || 'public'
  );
  const [hashtagInput, setHashtagInput] = useState('');

  // Track changes
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form when post changes
  useEffect(() => {
    setContent(post.content || '');
    setImageUrls(post.image_urls || []);
    setHashtags(post.hashtags || []);
    setVisibility((post.visibility as 'public' | 'followers' | 'private') || 'public');
    setHasChanges(false);
  }, [post]);

  // Check for changes
  useEffect(() => {
    const changed =
      content !== (post.content || '') ||
      JSON.stringify(imageUrls) !== JSON.stringify(post.image_urls || []) ||
      JSON.stringify(hashtags) !== JSON.stringify(post.hashtags || []) ||
      visibility !== (post.visibility || 'public');
    setHasChanges(changed);
  }, [content, imageUrls, hashtags, visibility, post]);

  // Handle content change
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CONTENT_LENGTH) {
      setContent(value);
    }
  }, []);

  // Add hashtag
  const addHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && hashtags.length < MAX_HASHTAGS && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    }
  }, [hashtagInput, hashtags]);

  // Remove hashtag
  const removeHashtag = useCallback((tagToRemove: string) => {
    setHashtags(hashtags.filter((tag) => tag !== tagToRemove));
  }, [hashtags]);

  // Handle hashtag input keydown
  const handleHashtagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addHashtag();
      }
    },
    [addHashtag]
  );

  // Remove image
  const removeImage = useCallback((indexToRemove: number) => {
    setImageUrls(imageUrls.filter((_, index) => index !== indexToRemove));
  }, [imageUrls]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!hasChanges || isLoading) return;

    const formData: EditPostFormData = {
      content,
      image_urls: imageUrls,
      hashtags,
      mentioned_shop_ids: post.mentioned_shop_ids || [],
      visibility,
    };

    await saveChanges(post.id, formData);
  }, [hasChanges, isLoading, content, imageUrls, hashtags, visibility, post, saveChanges]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmClose = window.confirm('변경사항이 저장되지 않았습니다. 닫으시겠습니까?');
      if (!confirmClose) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            게시물 수정
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Content */}
          <div>
            <Textarea
              value={content}
              onChange={handleContentChange}
              placeholder="내용을 입력하세요..."
              className="min-h-[150px] resize-none"
              disabled={isLoading}
            />
            <div className="flex justify-end mt-1">
              <span
                className={cn(
                  'text-xs',
                  content.length > MAX_CONTENT_LENGTH * 0.9
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {content.length}/{MAX_CONTENT_LENGTH}
              </span>
            </div>
          </div>

          {/* Images preview */}
          {imageUrls.length > 0 && (
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                <ImageIcon className="h-4 w-4" />
                이미지 ({imageUrls.length}/{MAX_IMAGES})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                    <img
                      src={url}
                      alt={`Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                * 새 이미지 추가는 지원되지 않습니다. 기존 이미지만 제거할 수 있습니다.
              </p>
            </div>
          )}

          {/* Hashtags */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <Hash className="h-4 w-4" />
              해시태그 ({hashtags.length}/{MAX_HASHTAGS})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={handleHashtagKeyDown}
                placeholder="해시태그 입력"
                className="flex-1 px-3 py-2 text-sm border rounded-md"
                disabled={isLoading || hashtags.length >= MAX_HASHTAGS}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHashtag}
                disabled={isLoading || !hashtagInput.trim() || hashtags.length >= MAX_HASHTAGS}
              >
                추가
              </Button>
            </div>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => !isLoading && removeHashtag(tag)}
                  >
                    #{tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Visibility */}
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <Globe className="h-4 w-4" />
              공개 범위
            </label>
            <Select
              value={visibility}
              onValueChange={(value: 'public' | 'followers' | 'private') => setVisibility(value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FeedEditPost;
```

### Step 4: Update FeedPostCard Component

**File:** `src/components/feed/FeedPostCard.tsx` (update existing)

Add edit button to post actions menu:

```tsx
// Add to imports
import { FeedEditPost } from './FeedEditPost';
import { MoreHorizontal, Edit, Trash2, Flag, Share2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';

// Add to component
interface FeedPostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
}

export function FeedPostCard({ post, onDelete, onEdit }: FeedPostCardProps) {
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.id === post.user_id;

  const handleDelete = async () => {
    if (!window.confirm('이 게시물을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await api.delete(`/posts/${post.id}`);
      onDelete?.(post.id);
    } catch (error) {
      console.error('Failed to delete post:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      {/* Post header with actions menu */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* User avatar and name */}
          <Avatar>
            <AvatarImage src={post.user?.profile_image_url} />
            <AvatarFallback>{post.user?.nickname?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{post.user?.nickname || '사용자'}</p>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(post.created_at)}
              {post.updated_at !== post.created_at && ' (수정됨)'}
            </p>
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && (
              <>
                <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  수정
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem>
              <Share2 className="h-4 w-4 mr-2" />
              공유
            </DropdownMenuItem>
            {!isOwner && (
              <DropdownMenuItem className="text-destructive">
                <Flag className="h-4 w-4 mr-2" />
                신고
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Post content */}
      {/* ... existing post content ... */}

      {/* Edit modal */}
      <FeedEditPost
        post={post}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updatedPost) => {
          onEdit?.(updatedPost);
          setIsEditModalOpen(false);
        }}
      />
    </div>
  );
}
```

### Step 5: Update Profile Posts Section

**File:** `src/app/(dashboard)/profile/posts/page.tsx` (update)

```tsx
// Add edit functionality to profile posts page

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedPostCard } from '@/components/feed/FeedPostCard';
import { api } from '@/lib/api';
import type { Post } from '@/types/post.types';

export default function ProfilePostsPage() {
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ['user-posts'],
    queryFn: async () => {
      const response = await api.get('/posts/my');
      return response.data;
    },
  });

  const handlePostDelete = useCallback((postId: string) => {
    // Optimistically remove from cache
    queryClient.setQueryData(['user-posts'], (old: Post[] | undefined) =>
      old?.filter((p) => p.id !== postId)
    );
    // Invalidate to refetch
    queryClient.invalidateQueries({ queryKey: ['user-posts'] });
  }, [queryClient]);

  const handlePostEdit = useCallback((updatedPost: Post) => {
    // Update in cache
    queryClient.setQueryData(['user-posts'], (old: Post[] | undefined) =>
      old?.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  }, [queryClient]);

  if (isLoading) {
    return <div className="p-4">로딩 중...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">내 게시물</h1>

      {posts?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          아직 작성한 게시물이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {posts?.map((post: Post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              onDelete={handlePostDelete}
              onEdit={handlePostEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/types/post.types.ts` | **MODIFY** | Add edit-related types |
| `src/hooks/use-edit-post.ts` | **CREATE** | Edit post hook |
| `src/components/feed/FeedEditPost.tsx` | **CREATE** | Edit post modal |
| `src/components/feed/FeedPostCard.tsx` | **MODIFY** | Add edit button |
| `src/app/(dashboard)/profile/posts/page.tsx` | **MODIFY** | Handle edit/delete |

---

## Testing Plan

### Manual Testing

- [ ] Edit button only visible for post owner
- [ ] Edit modal opens with current content
- [ ] Content changes are tracked
- [ ] Hashtags can be added/removed
- [ ] Images can be removed
- [ ] Visibility can be changed
- [ ] Save button disabled when no changes
- [ ] Unsaved changes warning on close
- [ ] Post updates immediately after save
- [ ] "(수정됨)" label appears after edit
- [ ] Query cache invalidated properly

### Test Scenarios

1. **Edit content**: Change text and save
2. **Edit hashtags**: Add/remove hashtags
3. **Remove image**: Remove an image from post
4. **Change visibility**: Change from public to private
5. **Cancel with changes**: Attempt to close with unsaved changes
6. **Multiple edits**: Edit same post multiple times

---

## Deployment Checklist

- [ ] Add FeedEditPost component
- [ ] Create use-edit-post hook
- [ ] Update post types
- [ ] Update FeedPostCard with edit menu
- [ ] Update profile posts page
- [ ] Test on mobile viewport (375-428px)
- [ ] Deploy to staging
- [ ] Test edit functionality
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Edit success rate | >95% |
| User complaints about editing | 0 |
| Delete rate reduction | -20% (users edit instead of delete) |
