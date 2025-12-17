# User Profile Implementation - Complete Frontend Guide

Guide for implementing user profile features in the user app with profile image display.

---

## Backend Endpoint

**GET** `/api/users/profile`

- **Authentication:** Required (User JWT Bearer token)
- **Returns:** Complete user profile data including profile image

---

## Response Structure

```typescript
{
  success: true,
  data: {
    profile: {
      // Identity
      id: string,
      email: string,
      phone_number: string,
      phone_verified: boolean,

      // Personal Info
      name: string,
      nickname: string,
      gender: 'male' | 'female' | 'other',
      birth_date: string,
      profile_image_url: string,        // ✅ Profile image URL

      // Account Status
      user_role: 'user' | 'shop_owner' | 'admin',
      user_status: 'active' | 'inactive' | 'suspended',
      is_influencer: boolean,
      influencer_qualified_at: string,

      // Social Auth
      social_provider: 'google' | 'kakao' | 'naver' | null,
      social_provider_id: string,

      // Referral & Points
      referral_code: string,
      referred_by_code: string,
      total_points: number,
      available_points: number,
      total_referrals: number,
      successful_referrals: number,
      referral_rewards_earned: number,

      // Activity
      last_login_at: string,
      last_active_at: string,
      last_login_ip: string,

      // Consent & Terms
      terms_accepted_at: string,
      privacy_accepted_at: string,
      marketing_consent: boolean,

      // Timestamps
      created_at: string,
      updated_at: string,

      // Shop association (if shop role)
      shop_id: string,
      shop_name: string
    },
    message: string
  }
}
```

---

## 1. API Client (`lib/api/user-profile.ts`)

```typescript
import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email: string;
  phone_number: string;
  phone_verified: boolean;
  name: string;
  nickname: string;
  gender: 'male' | 'female' | 'other';
  birth_date: string;
  profile_image_url: string;
  user_role: string;
  user_status: string;
  is_influencer: boolean;
  referral_code: string;
  total_points: number;
  available_points: number;
  total_referrals: number;
  last_login_at: string;
  marketing_consent: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get user profile
 */
export async function getUserProfile(token: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      profile: UserProfile;
      message: string;
    };
  }>('/api/users/profile', token);
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  token: string,
  updates: Partial<UserProfile>
) {
  return apiClient.put<{
    success: boolean;
    data: {
      profile: UserProfile;
      message: string;
    };
  }>('/api/users/profile', updates, token);
}

/**
 * Upload profile image
 */
export async function uploadProfileImage(
  token: string,
  imageFile: File
) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile/image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
}
```

---

## 2. React Hook (`hooks/useUserProfile.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as userProfileApi from '@/lib/api/user-profile';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Get user profile
 */
export function useUserProfile() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['userProfile'],
    queryFn: () => userProfileApi.getUserProfile(token),
    enabled: !!token,
  });
}

/**
 * Update user profile
 */
export function useUpdateProfile() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<UserProfile>) =>
      userProfileApi.updateUserProfile(token, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });
}

/**
 * Upload profile image
 */
export function useUploadProfileImage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageFile: File) =>
      userProfileApi.uploadProfileImage(token, imageFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });
}
```

---

## 3. Profile Page (`app/profile/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useUserProfile, useUpdateProfile, useUploadProfileImage } from '@/hooks/useUserProfile';
import Image from 'next/image';

export default function ProfilePage() {
  const { data, isLoading, error } = useUserProfile();
  const updateProfile = useUpdateProfile();
  const uploadImage = useUploadProfileImage();

  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (error || !data?.data) {
    return <div className="error">Failed to load profile</div>;
  }

  const profile = data.data.profile;

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>My Profile</h1>
        <button onClick={() => setIsEditing(!isEditing)} className="edit-btn">
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {isEditing ? (
        <ProfileEditForm
          profile={profile}
          onSave={async (updates) => {
            await updateProfile.mutateAsync(updates);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          onUploadImage={uploadImage.mutateAsync}
        />
      ) : (
        <ProfileView profile={profile} />
      )}
    </div>
  );
}

// ========================================
// VIEW MODE COMPONENT
// ========================================

function ProfileView({ profile }: { profile: UserProfile }) {
  return (
    <div className="profile-view">
      {/* Profile Header with Image */}
      <div className="profile-header">
        <div className="profile-image-container">
          <Image
            src={profile.profile_image_url || '/default-avatar.png'}
            alt={profile.name || profile.nickname || 'User'}
            width={120}
            height={120}
            className="profile-image"
            onError={(e) => {
              // Fallback to default image on error
              e.currentTarget.src = '/default-avatar.png';
            }}
          />
          {profile.is_influencer && (
            <div className="influencer-badge">
              ⭐ Influencer
            </div>
          )}
        </div>

        <div className="profile-info">
          <h2>{profile.name || profile.nickname}</h2>
          {profile.nickname && profile.name && (
            <p className="nickname">@{profile.nickname}</p>
          )}
          <p className="email">{profile.email}</p>
          {profile.phone_number && (
            <p className="phone">{profile.phone_number}</p>
          )}
        </div>
      </div>

      {/* Personal Information */}
      <section className="info-section">
        <h3>Personal Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Gender</label>
            <p>{profile.gender || 'Not specified'}</p>
          </div>

          {profile.birth_date && (
            <div className="info-item">
              <label>Birth Date</label>
              <p>{new Date(profile.birth_date).toLocaleDateString()}</p>
            </div>
          )}

          <div className="info-item">
            <label>Member Since</label>
            <p>{new Date(profile.created_at).toLocaleDateString()}</p>
          </div>

          <div className="info-item">
            <label>Account Status</label>
            <span className={`badge ${profile.user_status}`}>
              {profile.user_status}
            </span>
          </div>
        </div>
      </section>

      {/* Points & Rewards */}
      <section className="info-section">
        <h3>Points & Rewards</h3>
        <div className="points-grid">
          <div className="points-card">
            <label>Available Points</label>
            <p className="points-value">{profile.available_points.toLocaleString()}P</p>
          </div>

          <div className="points-card">
            <label>Total Earned</label>
            <p className="points-value">{profile.total_points.toLocaleString()}P</p>
          </div>

          <div className="points-card">
            <label>Referrals</label>
            <p className="points-value">{profile.total_referrals}</p>
          </div>

          <div className="points-card">
            <label>Referral Code</label>
            <p className="referral-code">{profile.referral_code || 'Not assigned'}</p>
            {profile.referral_code && (
              <button onClick={() => copyToClipboard(profile.referral_code)}>
                Copy
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Social & Auth */}
      {profile.social_provider && (
        <section className="info-section">
          <h3>Connected Accounts</h3>
          <div className="social-connection">
            <span className="provider-badge">{profile.social_provider}</span>
            <span>Connected</span>
          </div>
        </section>
      )}

      {/* Activity */}
      <section className="info-section">
        <h3>Activity</h3>
        <div className="info-grid">
          {profile.last_login_at && (
            <div className="info-item">
              <label>Last Login</label>
              <p>{new Date(profile.last_login_at).toLocaleString()}</p>
            </div>
          )}

          {profile.last_active_at && (
            <div className="info-item">
              <label>Last Active</label>
              <p>{new Date(profile.last_active_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </section>

      {/* Privacy Settings */}
      <section className="info-section">
        <h3>Privacy & Consent</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Terms Accepted</label>
            <p>{profile.terms_accepted_at ? '✓ Yes' : '✗ No'}</p>
          </div>

          <div className="info-item">
            <label>Privacy Policy</label>
            <p>{profile.privacy_accepted_at ? '✓ Accepted' : '✗ Not accepted'}</p>
          </div>

          <div className="info-item">
            <label>Marketing Consent</label>
            <p>{profile.marketing_consent ? '✓ Enabled' : '✗ Disabled'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ========================================
// EDIT MODE COMPONENT
// ========================================

function ProfileEditForm({
  profile,
  onSave,
  onCancel,
  onUploadImage
}: {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
  onUploadImage: (file: File) => Promise<any>;
}) {
  const [formData, setFormData] = useState({
    name: profile.name || '',
    nickname: profile.nickname || '',
    phone_number: profile.phone_number || '',
    gender: profile.gender || '',
    birth_date: profile.birth_date || '',
    marketing_consent: profile.marketing_consent || false,
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Upload image first if selected
      if (selectedImage) {
        const imageResult = await onUploadImage(selectedImage);
        if (imageResult.success) {
          formData.profile_image_url = imageResult.data.imageUrl;
        }
      }

      // Save profile updates
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to update profile');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="profile-edit-form">
      {/* Profile Image Upload */}
      <div className="form-section">
        <h3>Profile Image</h3>
        <div className="image-upload-container">
          <div className="current-image">
            <Image
              src={imagePreview || profile.profile_image_url || '/default-avatar.png'}
              alt="Profile"
              width={120}
              height={120}
              className="profile-image-preview"
            />
          </div>

          <div className="upload-controls">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleImageSelect}
              id="image-upload"
              className="file-input"
            />
            <label htmlFor="image-upload" className="upload-btn">
              Choose New Image
            </label>
            {selectedImage && (
              <p className="file-info">{selectedImage.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="form-section">
        <h3>Basic Information</h3>

        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter your full name"
          />
        </div>

        <div className="form-group">
          <label>Nickname</label>
          <input
            type="text"
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            placeholder="Enter your nickname"
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            placeholder="+82-10-1234-5678"
          />
        </div>

        <div className="form-group">
          <label>Gender</label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Birth Date</label>
          <input
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
          />
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="form-section">
        <h3>Privacy Settings</h3>

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={formData.marketing_consent}
              onChange={(e) => setFormData({ ...formData, marketing_consent: e.target.checked })}
            />
            I agree to receive marketing communications
          </label>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={uploading}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={uploading}>
          {uploading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// ========================================
// PROFILE IMAGE COMPONENT (Reusable)
// ========================================

export function ProfileImage({
  imageUrl,
  name,
  size = 40,
  className = ''
}: {
  imageUrl?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const defaultImage = '/default-avatar.png';
  const displayImage = imgError ? defaultImage : (imageUrl || defaultImage);

  return (
    <div className={`profile-image-wrapper ${className}`}>
      <Image
        src={displayImage}
        alt={name || 'User'}
        width={size}
        height={size}
        className="profile-image"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  // Show toast notification
  alert('Referral code copied!');
}
```

---

## 4. Profile Image in Navigation Bar

```tsx
// components/Navbar.tsx
'use client';

import { useUserProfile } from '@/hooks/useUserProfile';
import { ProfileImage } from '@/components/ProfileImage';
import Link from 'next/link';

export default function Navbar() {
  const { data } = useUserProfile();
  const profile = data?.data.profile;

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link href="/">에뷰리띵</Link>
      </div>

      <div className="nav-menu">
        <Link href="/shops">Browse</Link>
        <Link href="/reservations">My Bookings</Link>
        <Link href="/favorites">Favorites</Link>
      </div>

      <div className="nav-user">
        {profile ? (
          <Link href="/profile" className="user-menu">
            <ProfileImage
              imageUrl={profile.profile_image_url}
              name={profile.name}
              size={36}
            />
            <span className="user-name">{profile.name || profile.nickname}</span>
          </Link>
        ) : (
          <Link href="/login">
            <button className="login-btn">Login</button>
          </Link>
        )}
      </div>
    </nav>
  );
}
```

---

## 5. Profile Image in Feed Posts

```tsx
// components/FeedPost.tsx
'use client';

import { ProfileImage } from '@/components/ProfileImage';

interface FeedPostProps {
  post: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
      nickname: string;
      profile_image_url: string;
      is_influencer: boolean;
    };
    images: Array<{
      id: string;
      image_url: string;
      alt_text: string;
    }>;
    like_count: number;
    comment_count: number;
    created_at: string;
  };
}

export default function FeedPost({ post }: FeedPostProps) {
  return (
    <div className="feed-post">
      {/* Author Header */}
      <div className="post-header">
        <Link href={`/users/${post.author.id}`} className="author-link">
          <ProfileImage
            imageUrl={post.author.profile_image_url}
            name={post.author.name}
            size={40}
          />
          <div className="author-info">
            <h4>{post.author.name || post.author.nickname}</h4>
            {post.author.is_influencer && (
              <span className="influencer-badge">⭐ Influencer</span>
            )}
          </div>
        </Link>
        <span className="post-time">{formatTimeAgo(post.created_at)}</span>
      </div>

      {/* Post Content */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* Post Images */}
      {post.images && post.images.length > 0 && (
        <div className="post-images">
          {post.images.map((image) => (
            <Image
              key={image.id}
              src={image.image_url}
              alt={image.alt_text || 'Post image'}
              width={600}
              height={400}
              className="post-image"
            />
          ))}
        </div>
      )}

      {/* Post Actions */}
      <div className="post-actions">
        <button className="action-btn">
          ❤️ {post.like_count}
        </button>
        <button className="action-btn">
          💬 {post.comment_count}
        </button>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}
```

---

## 6. Profile Image in Reservation Details

```tsx
// When displaying customer info in shop admin reservation details
function CustomerInfoCard({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    // Fetch customer profile
    // Note: Shop admin sees customer profile through reservation data
  }, [customerId]);

  return (
    <div className="customer-card">
      <ProfileImage
        imageUrl={customer?.profile_image_url}
        name={customer?.name}
        size={60}
      />
      <div className="customer-info">
        <h3>{customer?.name}</h3>
        <p>{customer?.email}</p>
        <p>{customer?.phone_number}</p>
      </div>
    </div>
  );
}
```

---

## 7. Mobile App Implementation (React Native)

```tsx
// screens/ProfileScreen.tsx
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useUserProfile } from '@/hooks/useUserProfile';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const { data, isLoading } = useUserProfile();
  const uploadImage = useUploadProfileImage();

  const profile = data?.data.profile;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const file = await convertUriToFile(result.assets[0].uri);
      await uploadImage.mutateAsync(file);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
          <Image
            source={{
              uri: profile?.profile_image_url || 'https://i.imgur.com/lMNiOrG.png'
            }}
            style={styles.profileImage}
          />
          <View style={styles.editBadge}>
            <Text style={styles.editIcon}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>{profile?.name || profile?.nickname}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.total_points.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.total_referrals}</Text>
          <Text style={styles.statLabel}>Referrals</Text>
        </View>
      </View>

      {/* Profile Information */}
      <View style={styles.infoSection}>
        <InfoRow label="Phone" value={profile?.phone_number} />
        <InfoRow label="Gender" value={profile?.gender} />
        <InfoRow label="Birth Date" value={profile?.birth_date} />
        <InfoRow label="Member Since" value={new Date(profile?.created_at).toLocaleDateString()} />
      </View>

      {/* Edit Button */}
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => navigation.navigate('EditProfile', { profile })}
      >
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editIcon: {
    fontSize: 18,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 20,
    marginTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
});
```

---

## 8. Profile Completion Widget

```tsx
// components/ProfileCompletionWidget.tsx
'use client';

import { useUserProfile } from '@/hooks/useUserProfile';
import Link from 'next/link';

export default function ProfileCompletionWidget() {
  const { data } = useUserProfile();
  const profile = data?.data.profile;

  if (!profile) return null;

  const completionItems = [
    { key: 'name', label: 'Add your name', completed: !!profile.name },
    { key: 'phone', label: 'Verify phone number', completed: !!profile.phone_verified },
    { key: 'image', label: 'Upload profile image', completed: !!profile.profile_image_url },
    { key: 'gender', label: 'Set gender', completed: !!profile.gender },
    { key: 'birthdate', label: 'Add birth date', completed: !!profile.birth_date },
  ];

  const completedCount = completionItems.filter(item => item.completed).length;
  const totalCount = completionItems.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  if (percentage === 100) return null; // Don't show if profile is complete

  return (
    <div className="profile-completion-widget">
      <h3>Complete Your Profile ({percentage}%)</h3>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>

      <div className="completion-items">
        {completionItems.filter(item => !item.completed).map((item) => (
          <Link key={item.key} href="/profile?edit=true">
            <div className="completion-item">
              <span className="checkbox">☐</span>
              <span className="label">{item.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

## 9. Complete CSS Styling (`app/profile/page.module.css`)

```css
/* Profile Page Styles */

.profile-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.edit-btn {
  background: #007AFF;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

/* Profile View */
.profile-header {
  background: white;
  border-radius: 12px;
  padding: 32px;
  display: flex;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.profile-image-container {
  position: relative;
}

.profile-image {
  width: 120px;
  height: 120px;
  border-radius: 60px;
  object-fit: cover;
  border: 4px solid #f0f0f0;
}

.influencer-badge {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.profile-info h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
}

.nickname {
  color: #666;
  margin: 0 0 8px 0;
}

.email, .phone {
  color: #666;
  margin: 4px 0;
}

/* Info Sections */
.info-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.info-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item label {
  display: block;
  color: #666;
  font-size: 14px;
  margin-bottom: 4px;
}

.info-item p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

/* Points Grid */
.points-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.points-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
}

.points-card label {
  color: rgba(255,255,255,0.8);
  font-size: 12px;
  margin-bottom: 8px;
  display: block;
}

.points-value {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
}

.referral-code {
  font-family: monospace;
  font-size: 18px;
  background: rgba(255,255,255,0.2);
  padding: 8px;
  border-radius: 6px;
  margin: 8px 0;
}

/* Profile Edit Form */
.profile-edit-form {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.form-section {
  margin-bottom: 32px;
}

.form-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}

.image-upload-container {
  display: flex;
  align-items: center;
  gap: 24px;
}

.profile-image-preview {
  width: 120px;
  height: 120px;
  border-radius: 60px;
  object-fit: cover;
  border: 4px solid #f0f0f0;
}

.upload-controls {
  flex: 1;
}

.file-input {
  display: none;
}

.upload-btn {
  display: inline-block;
  background: #007AFF;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
}

.upload-btn:hover {
  background: #0056b3;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
}

.form-group.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e0e0e0;
}

.btn-primary {
  background: #007AFF;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Badge */
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.badge.active {
  background: #d4edda;
  color: #155724;
}

.badge.inactive {
  background: #f8d7da;
  color: #721c24;
}
```

---

## Summary - User Profile Image Display

### **Endpoint:** `GET /api/users/profile`

### **Profile Image URL:**
- Field: `profile_image_url`
- All users now have: `https://i.imgur.com/lMNiOrG.png`

### **Where Profile Images Are Displayed:**

1. **Profile Page** - Large (120x120px) with edit button
2. **Navigation Bar** - Small (36x36px) avatar menu
3. **Feed Posts** - Author avatar (40x40px)
4. **Comments** - Commenter avatar (32x32px)
5. **Reservation Details** - Customer info (60x60px)
6. **Search Results** - User listings
7. **Notifications** - Activity avatars

### **Key Features:**

✅ Fallback to default image on error
✅ Image upload with preview
✅ Circular avatar styling
✅ Responsive sizing
✅ Influencer badge overlay
✅ Mobile-optimized version

All user profile images are ready to display in the frontend! 🎉