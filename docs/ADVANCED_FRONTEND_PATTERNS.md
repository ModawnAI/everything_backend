# 🚀 Advanced Frontend Integration Patterns

## 📋 Overview

This guide covers advanced patterns for React/Next.js integration with the 에뷰리띵 backend, including complex state management, real-time features, file uploads, and performance optimization techniques.

---

## 🔄 Advanced State Management

### **1. Global State with Zustand (`store/index.ts`)**
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { serviceApi } from '@/lib/service-api'

interface AppState {
  // User state
  user: any | null
  userProfile: any | null
  pointBalance: number
  
  // App state
  notifications: any[]
  unreadNotificationCount: number
  
  // Booking state
  currentBooking: {
    shopId?: string
    services?: any[]
    selectedDate?: string
    selectedTime?: string
  } | null
  
  // Actions
  setUser: (user: any) => void
  setUserProfile: (profile: any) => void
  updatePointBalance: (balance: number) => void
  addNotification: (notification: any) => void
  markNotificationRead: (id: string) => void
  setCurrentBooking: (booking: any) => void
  clearCurrentBooking: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      userProfile: null,
      pointBalance: 0,
      notifications: [],
      unreadNotificationCount: 0,
      currentBooking: null,

      // Actions
      setUser: (user) => set({ user }),
      
      setUserProfile: (profile) => set({ userProfile: profile }),
      
      updatePointBalance: (balance) => set({ pointBalance: balance }),
      
      addNotification: (notification) => {
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadNotificationCount: state.unreadNotificationCount + 1
        }))
      },
      
      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
          ),
          unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
        }))
      },
      
      setCurrentBooking: (booking) => set({ currentBooking: booking }),
      
      clearCurrentBooking: () => set({ currentBooking: null })
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        user: state.user,
        userProfile: state.userProfile,
        currentBooking: state.currentBooking
      })
    }
  )
)
```

### **2. Advanced Booking Flow State Machine**
```typescript
// hooks/useBookingFlow.ts
import { useState, useCallback } from 'react'
import { useAppStore } from '@/store'
import { serviceApi } from '@/lib/service-api'

type BookingStep = 'shop-selection' | 'service-selection' | 'datetime-selection' | 'payment' | 'confirmation'

interface BookingState {
  step: BookingStep
  shopId?: string
  shop?: any
  selectedServices: any[]
  selectedDate?: string
  selectedTime?: string
  paymentMethod?: string
  pointsToUse?: number
  specialRequests?: string
}

export function useBookingFlow() {
  const [bookingState, setBookingState] = useState<BookingState>({
    step: 'shop-selection',
    selectedServices: []
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { setCurrentBooking, clearCurrentBooking } = useAppStore()

  const goToStep = useCallback((step: BookingStep) => {
    setBookingState(prev => ({ ...prev, step }))
  }, [])

  const selectShop = useCallback(async (shopId: string) => {
    try {
      setLoading(true)
      const response = await serviceApi.getShopDetails(shopId)
      
      if (response.success) {
        setBookingState(prev => ({
          ...prev,
          shopId,
          shop: response.data,
          step: 'service-selection'
        }))
      }
    } catch (err) {
      setError('Failed to load shop details')
    } finally {
      setLoading(false)
    }
  }, [])

  const selectServices = useCallback((services: any[]) => {
    setBookingState(prev => ({
      ...prev,
      selectedServices: services,
      step: 'datetime-selection'
    }))
  }, [])

  const selectDateTime = useCallback((date: string, time: string) => {
    setBookingState(prev => ({
      ...prev,
      selectedDate: date,
      selectedTime: time,
      step: 'payment'
    }))
  }, [])

  const confirmBooking = useCallback(async () => {
    try {
      setLoading(true)
      
      const response = await serviceApi.createReservation({
        shopId: bookingState.shopId!,
        serviceIds: bookingState.selectedServices.map(s => s.id),
        reservationDate: bookingState.selectedDate!,
        reservationTime: bookingState.selectedTime!,
        specialRequests: bookingState.specialRequests,
        pointsToUse: bookingState.pointsToUse
      })
      
      if (response.success) {
        setBookingState(prev => ({ ...prev, step: 'confirmation' }))
        clearCurrentBooking()
        return response.data
      } else {
        throw new Error(response.error?.message || 'Booking failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [bookingState, clearCurrentBooking])

  const resetBooking = useCallback(() => {
    setBookingState({
      step: 'shop-selection',
      selectedServices: []
    })
    clearCurrentBooking()
    setError(null)
  }, [clearCurrentBooking])

  // Save current booking state
  useCallback(() => {
    setCurrentBooking(bookingState)
  }, [bookingState, setCurrentBooking])

  return {
    bookingState,
    loading,
    error,
    goToStep,
    selectShop,
    selectServices,
    selectDateTime,
    confirmBooking,
    resetBooking
  }
}
```

---

## 📁 File Upload Integration

### **1. Image Upload Component (`components/ImageUpload.tsx`)**
```tsx
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { X, Upload, Image as ImageIcon } from 'lucide-react'

interface ImageUploadProps {
  onUploadComplete: (urls: string[]) => void
  maxFiles?: number
  maxSize?: number
  bucket?: string
  folder?: string
}

export function ImageUpload({ 
  onUploadComplete, 
  maxFiles = 10, 
  maxSize = 8 * 1024 * 1024, // 8MB
  bucket = 'feed-posts',
  folder = 'user-uploads'
}: ImageUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is ${maxSize / 1024 / 1024}MB`)
        return false
      }
      return true
    })

    setFiles(prev => [...prev, ...validFiles].slice(0, maxFiles))
  }, [maxFiles, maxSize])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: maxFiles - files.length,
    disabled: uploading
  })

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    try {
      setUploading(true)
      setUploadProgress(0)
      
      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
        const filePath = `${folder}/${fileName}`

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) throw error

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath)

        setUploadProgress(((index + 1) / files.length) * 100)
        
        return urlData.publicUrl
      })

      const urls = await Promise.all(uploadPromises)
      setUploadedUrls(urls)
      onUploadComplete(urls)
      
      // Clear files after successful upload
      setFiles([])
      
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed: ' + (error as Error).message)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p>Drop the images here...</p>
        ) : (
          <div>
            <p>Drag & drop images here, or click to select</p>
            <p className="text-sm text-gray-500 mt-2">
              Max {maxFiles} files, {maxSize / 1024 / 1024}MB each
            </p>
          </div>
        )}
      </div>

      {/* File Preview */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">Selected Files ({files.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {files.map((file, index) => (
              <div key={index} className="relative">
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  disabled={uploading}
                >
                  <X className="h-3 w-3" />
                </button>
                <p className="text-xs text-center mt-1 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {/* Upload Button */}
      <div className="flex gap-2">
        <Button 
          onClick={uploadFiles} 
          disabled={files.length === 0 || uploading}
          className="flex-1"
        >
          {uploading ? 'Uploading...' : `Upload ${files.length} Files`}
        </Button>
        
        {files.length > 0 && (
          <Button 
            variant="outline" 
            onClick={() => setFiles([])}
            disabled={uploading}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Uploaded URLs Display */}
      {uploadedUrls.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-green-600">
            ✅ Upload Complete ({uploadedUrls.length} files)
          </h4>
          <div className="text-xs text-gray-500">
            Files uploaded successfully and ready to use
          </div>
        </div>
      )}
    </div>
  )
}
```

### **2. Advanced Feed Integration (`components/SocialFeed.tsx`)**
```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { useFeedPosts } from '@/hooks/service'
import { useInfiniteQuery } from '@tanstack/react-query'
import { serviceApi } from '@/lib/service-api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Heart, MessageCircle, Share, MoreHorizontal } from 'lucide-react'
import { ImageUpload } from './ImageUpload'

export function SocialFeed() {
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostImages, setNewPostImages] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  const observerRef = useRef<IntersectionObserver>()

  // Infinite scroll for feed posts
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['feed-posts'],
    queryFn: ({ pageParam = 1 }) => 
      serviceApi.getFeedPosts({ page: pageParam, limit: 10 }),
    getNextPageParam: (lastPage) => 
      lastPage.data?.hasMore ? lastPage.data.pagination.currentPage + 1 : undefined,
    staleTime: 2 * 60 * 1000 // 2 minutes
  })

  // Intersection observer for infinite scroll
  const lastPostRef = useCallback((node: HTMLDivElement) => {
    if (isFetchingNextPage) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage()
      }
    })
    
    if (node) observerRef.current.observe(node)
  }, [isFetchingNextPage, fetchNextPage, hasNextPage])

  const posts = data?.pages.flatMap(page => page.data?.posts || []) || []

  const createPost = async () => {
    if (!newPostContent.trim()) return

    try {
      setPosting(true)
      
      const response = await serviceApi.createFeedPost({
        content: newPostContent,
        images: newPostImages.map((url, index) => ({
          imageUrl: url,
          displayOrder: index + 1
        }))
      })
      
      if (response.success) {
        setNewPostContent('')
        setNewPostImages([])
        refetch() // Refresh feed
      }
    } catch (error) {
      alert('Failed to create post: ' + (error as Error).message)
    } finally {
      setPosting(false)
    }
  }

  const likePost = async (postId: string) => {
    try {
      await serviceApi.likeFeedPost(postId)
      refetch() // Refresh to get updated like count
    } catch (error) {
      console.error('Failed to like post:', error)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Create Post */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Share Your Beauty Experience</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full p-3 border rounded-md resize-none"
            rows={3}
            placeholder="What's on your mind?"
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            maxLength={2000}
          />
          
          <ImageUpload
            onUploadComplete={setNewPostImages}
            maxFiles={10}
            bucket="feed-posts"
            folder="user-posts"
          />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {newPostContent.length}/2000 characters
            </span>
            <Button 
              onClick={createPost}
              disabled={!newPostContent.trim() || posting}
            >
              {posting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feed Posts */}
      <div className="space-y-4">
        {posts.map((post: any, index: number) => (
          <Card 
            key={post.id} 
            ref={index === posts.length - 1 ? lastPostRef : undefined}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={post.author.profileImageUrl} />
                  <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{post.author.name}</h4>
                    {post.author.isInfluencer && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        Influencer
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{post.content}</p>
              
              {/* Images */}
              {post.images && post.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {post.images.map((image: any, imgIndex: number) => (
                    <img
                      key={imgIndex}
                      src={image.imageUrl}
                      alt={image.altText || 'Post image'}
                      className="rounded-lg object-cover aspect-square"
                    />
                  ))}
                </div>
              )}
              
              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {post.hashtags.map((hashtag: string, tagIndex: number) => (
                    <span 
                      key={tagIndex}
                      className="text-blue-600 text-sm hover:underline cursor-pointer"
                    >
                      #{hashtag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Engagement Actions */}
              <div className="flex items-center gap-4 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => likePost(post.id)}
                  className={`flex items-center gap-2 ${
                    post.isLiked ? 'text-red-500' : 'text-gray-500'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                  {post.likeCount || 0}
                </Button>
                
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-gray-500">
                  <MessageCircle className="h-4 w-4" />
                  {post.commentCount || 0}
                </Button>
                
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-gray-500">
                  <Share className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      )}

      {/* End of feed */}
      {!hasNextPage && posts.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          You've reached the end of the feed
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-4 text-red-500">
          Error loading feed: {(error as Error).message}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-2">
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

## 🔄 Real-time Payment Integration

### **1. Payment Flow Component (`components/PaymentFlow.tsx`)**
```tsx
'use client'

import { useState, useEffect } from 'react'
import { serviceApi } from '@/lib/service-api'
import { useAuth } from '@/contexts/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { CreditCard, Coins, Building } from 'lucide-react'

interface PaymentFlowProps {
  reservationId: string
  totalAmount: number
  onPaymentComplete: (paymentId: string) => void
}

export function PaymentFlow({ reservationId, totalAmount, onPaymentComplete }: PaymentFlowProps) {
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [pointsToUse, setPointsToUse] = useState(0)
  const [pointBalance, setPointBalance] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')

  const { user } = useAuth()

  // Fetch user's point balance
  useEffect(() => {
    fetchPointBalance()
  }, [])

  const fetchPointBalance = async () => {
    try {
      const response = await serviceApi.getPointBalance()
      if (response.success) {
        setPointBalance(response.data.availablePoints || 0)
      }
    } catch (error) {
      console.error('Failed to fetch point balance:', error)
    }
  }

  const maxPointsUsage = Math.min(pointBalance, totalAmount)
  const remainingAmount = totalAmount - pointsToUse

  const processPayment = async () => {
    try {
      setProcessing(true)
      setPaymentStatus('processing')
      
      const response = await serviceApi.createPayment({
        reservationId,
        amount: remainingAmount,
        paymentMethod,
        pointsToUse: pointsToUse > 0 ? pointsToUse : undefined
      })
      
      if (response.success) {
        setPaymentStatus('success')
        onPaymentComplete(response.data.paymentId)
      } else {
        throw new Error(response.error?.message || 'Payment failed')
      }
    } catch (error) {
      setPaymentStatus('failed')
      alert('Payment failed: ' + (error as Error).message)
    } finally {
      setProcessing(false)
    }
  }

  if (paymentStatus === 'success') {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-green-600 text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
          <p className="text-gray-600">Your reservation has been confirmed.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Summary */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span>Total Amount:</span>
            <span className="font-semibold">{totalAmount.toLocaleString()}원</span>
          </div>
          {pointsToUse > 0 && (
            <>
              <div className="flex justify-between text-blue-600">
                <span>Points Used:</span>
                <span>-{pointsToUse.toLocaleString()}원</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Amount to Pay:</span>
                <span>{remainingAmount.toLocaleString()}원</span>
              </div>
            </>
          )}
        </div>

        {/* Points Usage */}
        {pointBalance > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-yellow-500" />
                Use Points (Available: {pointBalance.toLocaleString()})
              </Label>
            </div>
            <Slider
              value={[pointsToUse]}
              onValueChange={(value) => setPointsToUse(value[0])}
              max={maxPointsUsage}
              step={100}
              className="w-full"
            />
            <div className="text-sm text-gray-600">
              Using {pointsToUse.toLocaleString()} points
            </div>
          </div>
        )}

        {/* Payment Method Selection */}
        {remainingAmount > 0 && (
          <div className="space-y-3">
            <Label>Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Credit/Debit Card
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bank_transfer" id="bank" />
                <Label htmlFor="bank" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Bank Transfer
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Payment Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={processPayment}
          disabled={processing || paymentStatus === 'processing'}
        >
          {processing ? 'Processing Payment...' : 
           remainingAmount === 0 ? 'Complete with Points' :
           `Pay ${remainingAmount.toLocaleString()}원`}
        </Button>

        {paymentStatus === 'failed' && (
          <div className="text-red-600 text-center">
            Payment failed. Please try again.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 📊 Advanced Admin Dashboard

### **1. Analytics Dashboard (`components/admin/AnalyticsDashboard.tsx`)**
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useAdminDashboard } from '@/hooks/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { TrendingUp, Users, ShoppingBag, CreditCard, Activity } from 'lucide-react'

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const { metrics, loading, error, refetch } = useAdminDashboard({
    period,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate
  })

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">Error loading dashboard: {error}</p>
        <Button onClick={refetch}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-4 items-center">
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="quarter">Quarterly</SelectItem>
            <SelectItem value="year">Yearly</SelectItem>
          </SelectContent>
        </Select>
        
        <input
          type="date"
          value={dateRange.startDate}
          onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          className="px-3 py-2 border rounded-md"
        />
        
        <span>to</span>
        
        <input
          type="date"
          value={dateRange.endDate}
          onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          className="px-3 py-2 border rounded-md"
        />
        
        <Button onClick={refetch} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* User Growth */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.userGrowth?.totalUsers?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{metrics?.userGrowth?.newUsersThisMonth} this month
            </p>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.revenue?.totalRevenue?.toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              +{metrics?.revenue?.revenueGrowthRate?.toFixed(1)}% from last period
            </p>
          </CardContent>
        </Card>

        {/* Reservations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reservations</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.reservations?.totalReservations?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.reservations?.reservationSuccessRate?.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.systemHealth?.uptime?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.systemHealth?.activeUsers} active users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Charts and Tables would go here */}
      {/* Implementation depends on your preferred charting library */}
    </div>
  )
}
```

---

## 🔧 Troubleshooting Guide

### **Common Issues & Solutions**

#### **1. Authentication Issues**
```typescript
// Problem: Token expiration not handled
// Solution: Automatic token refresh
const { data: { session }, error } = await supabase.auth.getSession()
if (error || !session) {
  await supabase.auth.refreshSession()
}
```

#### **2. CORS Issues**
```typescript
// Problem: CORS errors in development
// Solution: Proxy API calls through Next.js
// In next.config.js:
async rewrites() {
  return [
    {
      source: '/api/proxy/:path*',
      destination: 'http://localhost:3000/api/:path*',
    },
  ]
}
```

#### **3. Real-time Connection Issues**
```typescript
// Problem: WebSocket disconnections
// Solution: Automatic reconnection with exponential backoff
const reconnectWithBackoff = (attempt: number = 1) => {
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
  setTimeout(() => connectWebSocket(), delay)
}
```

#### **4. Performance Issues**
```typescript
// Problem: Too many API calls
// Solution: Debounced search and caching
import { useDebouncedCallback } from 'use-debounce'

const debouncedSearch = useDebouncedCallback(
  (query: string) => {
    searchShops({ query })
  },
  500
)
```

---

## 📱 Mobile Responsiveness

### **Mobile-First Components**
```tsx
// Responsive design patterns for mobile devices
export function MobileReservationCard({ reservation }: { reservation: any }) {
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Mobile-optimized layout */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-sm">{reservation.shop.name}</h3>
              <p className="text-xs text-gray-500">{reservation.services[0]?.name}</p>
            </div>
            <Badge variant={getStatusVariant(reservation.status)}>
              {reservation.status}
            </Badge>
          </div>
          
          <div className="text-sm">
            📅 {new Date(reservation.reservationDatetime).toLocaleDateString()}
            <br />
            🕒 {new Date(reservation.reservationDatetime).toLocaleTimeString()}
          </div>
          
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1">
              Details
            </Button>
            {reservation.status === 'confirmed' && (
              <Button size="sm" variant="destructive" className="flex-1">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

This comprehensive guide provides everything needed for robust frontend integration with clear separation between admin and service APIs, practical examples, and production-ready patterns.
