# Complete User App Implementation Guide

Comprehensive guide for implementing ALL user-facing features in the frontend.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Shop Discovery & Details](#2-shop-discovery--details)
3. [Booking/Reservations](#3-bookingreservations)
4. [Reservation Details](#4-reservation-details)
5. [User Profile](#5-user-profile)
6. [Favorites](#6-favorites)
7. [Reviews](#7-reviews)
8. [Referral System](#8-referral-system)
9. [Notifications](#9-notifications)
10. [WebSocket Real-time Updates](#10-websocket-real-time-updates)

---

## 1. Authentication

### Endpoints

```typescript
// Social Login (Google)
POST /api/auth/social-login
Body: { provider: 'google', id_token: 'google-jwt-token' }

// Refresh Token
POST /api/auth/refresh
Body: { refreshToken: 'refresh-token' }

// Logout
POST /api/auth/logout
Headers: { Authorization: 'Bearer <token>' }
```

### Implementation

```typescript
// lib/api/auth.ts
export async function socialLogin(provider: 'google', idToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/social-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, id_token: idToken })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'Login failed');
  }

  return data.data; // { user, token, refreshToken, expiresAt }
}

// Hook
export function useSocialLogin() {
  const router = useRouter();

  return useMutation({
    mutationFn: ({ provider, idToken }: { provider: 'google'; idToken: string }) =>
      socialLogin(provider, idToken),
    onSuccess: (data) => {
      // Store tokens
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Redirect to home
      router.push('/');
    }
  });
}
```

---

## 2. Shop Discovery & Details

### Endpoints

```typescript
// Browse all shops
GET /api/shops?status=active&category=hair&limit=20

// Nearby shops
GET /api/shops/nearby?latitude=37.5665&longitude=126.9780&radius=5

// Popular shops
GET /api/shops/popular?category=hair&limit=10

// Single shop details
GET /api/shops/:id
```

### Implementation

```typescript
// app/shops/page.tsx
'use client';

import { useState } from 'react';

export default function ShopsPage() {
  const [category, setCategory] = useState('');
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchShops();
  }, [category]);

  async function fetchShops() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'active');
      params.set('limit', '20');
      if (category) params.set('category', category);

      const response = await fetch(`${API_BASE_URL}/api/shops?${params}`);
      const data = await response.json();

      if (data.success) {
        setShops(data.data.shops);
      }
    } catch (error) {
      console.error('Failed to fetch shops:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shops-page">
      <h1>Browse Shops</h1>

      {/* Category Filter */}
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All Categories</option>
        <option value="hair">Hair</option>
        <option value="nail">Nail</option>
        <option value="makeup">Makeup</option>
        <option value="skincare">Skincare</option>
        <option value="massage">Massage</option>
        <option value="eyelash">Eyelash</option>
        <option value="eyebrow">Eyebrow</option>
      </select>

      {/* Shop Grid */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="shops-grid">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}

// ShopCard Component
function ShopCard({ shop }) {
  return (
    <Link href={`/shops/${shop.id}`}>
      <div className="shop-card">
        <img src={shop.shop_images?.[0]?.image_url || '/placeholder.jpg'} />
        <h3>{shop.name}</h3>
        <p>{shop.address}</p>
        <div className="rating">
          ⭐ {shop.statistics?.averageRating || 0} ({shop.statistics?.totalReviews || 0})
        </div>
        <span className="category">{shop.main_category}</span>
      </div>
    </Link>
  );
}
```

---

## 3. Booking/Reservations

### Endpoints

```typescript
// Get available slots
GET /api/shops/:shopId/available-slots?date=2025-11-13&serviceIds[]=uuid1&serviceIds[]=uuid2

// Create reservation
POST /api/reservations
Body: {
  shopId: 'uuid',
  services: [{ serviceId: 'uuid', quantity: 1 }],
  reservationDate: '2025-11-13',
  reservationTime: '14:00',
  specialRequests: 'Optional notes',
  pointsToUse: 0,
  paymentInfo: {
    depositAmount: 10000,
    remainingAmount: 40000,
    paymentMethod: 'card',
    depositRequired: true
  }
}
```

### Implementation

```typescript
// app/booking/[shopId]/page.tsx
'use client';

export default function BookingPage() {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);

  // Step 1: Select services
  // Step 2: Select date
  // Step 3: Fetch available time slots

  useEffect(() => {
    if (selectedDate && selectedServices.length > 0) {
      fetchAvailableSlots();
    }
  }, [selectedDate, selectedServices]);

  async function fetchAvailableSlots() {
    const serviceIds = selectedServices.map(s => s.id);
    const params = new URLSearchParams();
    params.set('date', selectedDate);
    serviceIds.forEach(id => params.append('serviceIds[]', id));

    const response = await fetch(
      `${API_BASE_URL}/api/shops/${shopId}/available-slots?${params}`
    );
    const data = await response.json();

    if (data.success) {
      setAvailableSlots(data.data.slots);
    }
  }

  // Step 4: Submit booking
  async function submitBooking() {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/api/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shopId,
        services: selectedServices.map(s => ({
          serviceId: s.id,
          quantity: 1
        })),
        reservationDate: selectedDate,
        reservationTime: selectedTime,
        specialRequests: specialRequests,
        pointsToUse: pointsToUse,
        paymentInfo: {
          depositAmount: depositAmount,
          remainingAmount: remainingAmount,
          paymentMethod: 'card',
          depositRequired: depositRequired
        }
      })
    });

    const data = await response.json();

    if (data.success) {
      router.push(`/reservations/${data.data.reservation.id}`);
    } else {
      alert(data.error?.message || 'Booking failed');
    }
  }

  return (
    <div className="booking-page">
      {/* Booking wizard implementation */}
    </div>
  );
}
```

---

## 4. Reservation Details

### Endpoint

```typescript
GET /api/reservations/:id
Headers: { Authorization: 'Bearer <token>' }
```

### Implementation

```typescript
// app/reservations/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';

export default function ReservationDetailPage() {
  const params = useParams();
  const reservationId = params.id;

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservationDetails();
  }, [reservationId]);

  async function fetchReservationDetails() {
    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reservations/${reservationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setReservation(data.data.reservation);
      } else {
        console.error('Failed to load reservation:', data.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!reservation) return <div>Reservation not found</div>;

  return (
    <div className="reservation-detail">
      {/* Status Badge */}
      <div className="status">
        <StatusBadge status={reservation.status} />
      </div>

      {/* Shop Information */}
      <section className="shop-info">
        <h2>{reservation.shop.name}</h2>
        <p>{reservation.shop.address}</p>
        <a href={`tel:${reservation.shop.phoneNumber}`}>
          📞 {reservation.shop.phoneNumber}
        </a>
        <a href={`mailto:${reservation.shop.email}`}>
          ✉️ {reservation.shop.email}
        </a>
        {reservation.shop.kakaoChannelUrl && (
          <a href={reservation.shop.kakaoChannelUrl} target="_blank">
            💬 Kakao Channel
          </a>
        )}
      </section>

      {/* Reservation Details */}
      <section className="reservation-info">
        <h3>Booking Information</h3>
        <p>Date: {reservation.reservationDate}</p>
        <p>Time: {reservation.reservationTime}</p>
        <p>Booked on: {new Date(reservation.createdAt).toLocaleString()}</p>
      </section>

      {/* Services */}
      <section className="services">
        <h3>Services</h3>
        {reservation.services.map((service) => (
          <div key={service.id} className="service-item">
            <h4>{service.serviceName}</h4>
            <p>{service.description}</p>
            <div className="service-details">
              <span>{service.durationMinutes} min</span>
              <span>×{service.quantity}</span>
              <span>₩{service.totalPrice.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Payment Summary */}
      <section className="payment">
        <h3>Payment</h3>
        <div className="payment-row">
          <span>Total</span>
          <span>₩{reservation.totalAmount.toLocaleString()}</span>
        </div>
        {reservation.depositAmount > 0 && (
          <>
            <div className="payment-row">
              <span>Deposit Paid</span>
              <span>₩{reservation.depositAmount.toLocaleString()}</span>
            </div>
            <div className="payment-row">
              <span>Remaining</span>
              <span>₩{reservation.remainingAmount.toLocaleString()}</span>
            </div>
          </>
        )}
        {reservation.pointsUsed > 0 && (
          <div className="payment-row">
            <span>Points Used</span>
            <span>-{reservation.pointsUsed.toLocaleString()}P</span>
          </div>
        )}
      </section>

      {/* Actions */}
      {reservation.status === 'confirmed' && (
        <div className="actions">
          <button onClick={() => addToCalendar(reservation)}>
            📅 Add to Calendar
          </button>
          <button onClick={() => getDirections(reservation.shop)}>
            🗺️ Get Directions
          </button>
          <button onClick={() => cancelReservation(reservation.id)}>
            ❌ Cancel
          </button>
        </div>
      )}

      {reservation.status === 'completed' && (
        <button onClick={() => router.push(`/reviews/write?reservationId=${reservation.id}`)}>
          ⭐ Write Review
        </button>
      )}
    </div>
  );
}

function addToCalendar(reservation) {
  const start = new Date(`${reservation.reservationDate}T${reservation.reservationTime}`);
  const duration = reservation.services.reduce((sum, s) => sum + s.durationMinutes * s.quantity, 0);
  const end = new Date(start.getTime() + duration * 60000);

  const googleUrl = new URL('https://calendar.google.com/calendar/render');
  googleUrl.searchParams.set('action', 'TEMPLATE');
  googleUrl.searchParams.set('text', `${reservation.shop.name} - Appointment`);
  googleUrl.searchParams.set('dates', `${formatICS(start)}/${formatICS(end)}`);
  googleUrl.searchParams.set('location', reservation.shop.address);

  window.open(googleUrl.toString(), '_blank');
}

function formatICS(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
```

---

## 5. User Profile

### Endpoints

```typescript
// Get user profile
GET /api/user/profile
Headers: { Authorization: 'Bearer <token>' }

// Update profile
PUT /api/user/profile
Body: { name, phone_number, birth_date, gender, etc. }
```

### Implementation

```typescript
// app/profile/page.tsx
'use client';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (data.success) {
      setProfile(data.data);
    }
  }

  async function updateProfile(updates) {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();
    if (data.success) {
      setProfile(data.data);
      setEditing(false);
    }
  }

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="profile-page">
      <h1>My Profile</h1>

      {editing ? (
        <ProfileEditForm
          profile={profile}
          onSave={updateProfile}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ProfileView profile={profile} onEdit={() => setEditing(true)} />
      )}
    </div>
  );
}

function ProfileView({ profile, onEdit }) {
  return (
    <div className="profile-view">
      <div className="profile-header">
        <img
          src={profile.profile_image_url || '/default-avatar.png'}
          alt={profile.name}
          className="profile-image"
        />
        <div>
          <h2>{profile.name || profile.nickname}</h2>
          <p>{profile.email}</p>
        </div>
        <button onClick={onEdit}>Edit</button>
      </div>

      <div className="profile-details">
        <div className="detail-item">
          <label>Phone</label>
          <p>{profile.phone_number}</p>
        </div>
        <div className="detail-item">
          <label>Gender</label>
          <p>{profile.gender}</p>
        </div>
        <div className="detail-item">
          <label>Birth Date</label>
          <p>{profile.birth_date}</p>
        </div>
        <div className="detail-item">
          <label>Points</label>
          <p>{profile.available_points.toLocaleString()}P</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Favorites

### Endpoints

```typescript
// Get user favorites
GET /api/user/favorites?limit=20
Headers: { Authorization: 'Bearer <token>' }

// Add favorite
POST /api/user/favorites
Body: { shopId: 'uuid' }

// Remove favorite
DELETE /api/user/favorites/:shopId
```

### Implementation

```typescript
// app/favorites/page.tsx
'use client';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/api/user/favorites?limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (data.success) {
      setFavorites(data.data.favorites);
    }
  }

  async function removeFavorite(shopId) {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/api/user/favorites/${shopId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      setFavorites(favorites.filter(f => f.shop_id !== shopId));
    }
  }

  return (
    <div className="favorites-page">
      <h1>My Favorite Shops</h1>

      <div className="favorites-grid">
        {favorites.map((favorite) => (
          <div key={favorite.id} className="favorite-card">
            <Link href={`/shops/${favorite.shop_id}`}>
              <h3>{favorite.shop_name}</h3>
              <p>{favorite.shop_address}</p>
            </Link>
            <button onClick={() => removeFavorite(favorite.shop_id)}>
              ❤️ Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Add to favorites button (in shop detail page)
async function addToFavorites(shopId) {
  const token = localStorage.getItem('authToken');

  const response = await fetch(`${API_BASE_URL}/api/user/favorites`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ shopId })
  });

  return response.json();
}
```

---

## 7. Reviews

### Endpoints

```typescript
// Get shop reviews
GET /api/shops/:shopId/reviews?page=1&limit=20

// Write review
POST /api/reviews
Body: {
  shopId: 'uuid',
  reservationId: 'uuid',
  rating: 5,
  comment: 'Great service!',
  serviceRatings: [{ serviceId: 'uuid', rating: 5 }]
}
```

### Implementation

```typescript
// app/reviews/write/page.tsx
'use client';

export default function WriteReviewPage() {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  async function submitReview() {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shopId,
        reservationId,
        rating,
        comment
      })
    });

    const data = await response.json();
    if (data.success) {
      router.push(`/reservations/${reservationId}`);
    }
  }

  return (
    <div className="write-review">
      <h1>Write Review</h1>

      {/* Star Rating */}
      <div className="rating-selector">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className={rating >= star ? 'active' : ''}
          >
            ⭐
          </button>
        ))}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience..."
        maxLength={1000}
      />

      <button onClick={submitReview}>Submit Review</button>
    </div>
  );
}
```

---

## 8. Referral System (FIXED)

### Endpoints

```typescript
// Get referral stats
GET /api/referrals/stats
Headers: { Authorization: 'Bearer <token>' }

// Get referral history
GET /api/referrals/history?page=1&limit=20
Headers: { Authorization: 'Bearer <token>' }
```

### Implementation

```typescript
// app/referrals/page.tsx
'use client';

export default function ReferralsPage() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferralData();
  }, []);

  async function fetchReferralData() {
    const token = localStorage.getItem('authToken');

    try {
      // Fetch stats
      const statsResponse = await fetch(`${API_BASE_URL}/api/referrals/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsResponse.json();

      if (statsData.success) {
        setStats(statsData.data.stats);
      }

      // Fetch history
      const historyResponse = await fetch(
        `${API_BASE_URL}/api/referrals/history?page=1&limit=20`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const historyData = await historyResponse.json();

      if (historyData.success) {
        setHistory(historyData.data.referrals);
      }

    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="referrals-page">
      <h1>Referral Program</h1>

      {/* Referral Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Your Referral Code</h3>
            <div className="referral-code">{stats.referralCode}</div>
            <button onClick={() => copyToClipboard(stats.referralCode)}>
              📋 Copy Code
            </button>
          </div>

          <div className="stat-card">
            <h3>Total Referrals</h3>
            <p className="value">{stats.totalReferrals}</p>
          </div>

          <div className="stat-card">
            <h3>Completed</h3>
            <p className="value">{stats.completedReferrals}</p>
          </div>

          <div className="stat-card">
            <h3>Pending</h3>
            <p className="value">{stats.pendingReferrals}</p>
          </div>

          <div className="stat-card">
            <h3>Total Bonus Earned</h3>
            <p className="value">₩{stats.totalBonusEarned.toLocaleString()}</p>
          </div>

          <div className="stat-card">
            <h3>Bonus Paid</h3>
            <p className="value">₩{stats.totalBonusPaid.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Referral History */}
      <section className="referral-history">
        <h2>Referral History</h2>
        <div className="history-list">
          {history.map((referral) => (
            <div key={referral.id} className="referral-item">
              <div className="user-info">
                <h4>{referral.referredUser.name}</h4>
                <p>{referral.referredUser.email}</p>
                <p>Joined: {new Date(referral.referredUser.joinedAt).toLocaleDateString()}</p>
              </div>

              <div className="referral-status">
                <span className={`status-badge ${referral.status}`}>
                  {referral.status}
                </span>
                <p className="bonus">
                  ₩{referral.bonusAmount.toLocaleString()}
                  {referral.bonusPaid && ' ✓ Paid'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Share Referral Code */}
      <section className="share-section">
        <h2>Share Your Code</h2>
        <div className="share-buttons">
          <button onClick={() => shareViaKakao(stats.referralCode)}>
            💬 Share on Kakao
          </button>
          <button onClick={() => shareViaLink(stats.referralCode)}>
            🔗 Copy Link
          </button>
        </div>
      </section>
    </div>
  );
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert('Referral code copied!');
}
```

---

## 9. Notifications

### Endpoints

```typescript
// Get user notifications
GET /api/user/notifications?page=1&limit=20&unreadOnly=false
Headers: { Authorization: 'Bearer <token>' }

// Mark as read
PUT /api/user/notifications/:id/read
```

### Implementation

```typescript
// app/notifications/page.tsx
'use client';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly]);

  async function fetchNotifications() {
    const token = localStorage.getItem('authToken');

    const params = new URLSearchParams({
      page: '1',
      limit: '50',
      unreadOnly: unreadOnly.toString()
    });

    const response = await fetch(
      `${API_BASE_URL}/api/user/notifications?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    const data = await response.json();
    if (data.success) {
      setNotifications(data.data.notifications);
    }
  }

  async function markAsRead(notificationId) {
    const token = localStorage.getItem('authToken');

    await fetch(`${API_BASE_URL}/api/user/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    fetchNotifications();
  }

  return (
    <div className="notifications-page">
      <h1>Notifications</h1>

      <div className="filter">
        <button onClick={() => setUnreadOnly(false)} className={!unreadOnly ? 'active' : ''}>
          All
        </button>
        <button onClick={() => setUnreadOnly(true)} className={unreadOnly ? 'active' : ''}>
          Unread
        </button>
      </div>

      <div className="notifications-list">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
            onClick={() => !notification.is_read && markAsRead(notification.id)}
          >
            <div className="notification-content">
              <h3>{notification.title}</h3>
              <p>{notification.body}</p>
              <span className="time">{formatTimeAgo(notification.created_at)}</span>
            </div>
            {!notification.is_read && <div className="unread-badge">•</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 10. WebSocket Real-time Updates

### Implementation

```typescript
// contexts/WebSocketContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WebSocketContext = createContext<{ socket: Socket | null }>({ socket: null });

export function WebSocketProvider({ children, userId, token }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketInstance = io('http://localhost:3001', {
      auth: { token }
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to WebSocket');

      // Join user's private room
      socketInstance.emit('join_room', `user-${userId}`);
    });

    // Listen for reservation updates
    socketInstance.on('reservation_update', (data) => {
      console.log('📬 Reservation update:', data);

      // Show notification
      if (Notification.permission === 'granted') {
        new Notification('Reservation Update', {
          body: `Your reservation status: ${data.status}`,
          icon: '/icon.png'
        });
      }

      // Optionally refresh data
      // queryClient.invalidateQueries(['reservations']);
    });

    // Listen for notifications
    socketInstance.on('notification', (data) => {
      console.log('🔔 New notification:', data);
      // Show notification banner
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [userId, token]);

  return (
    <WebSocketContext.Provider value={{ socket }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}

// Usage in root layout
// app/layout.tsx
export default function RootLayout({ children }) {
  const { user, token } = useAuth();

  return (
    <html>
      <body>
        {user && token ? (
          <WebSocketProvider userId={user.id} token={token}>
            {children}
          </WebSocketProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
```

---

## Complete API Summary

| Feature | Endpoint | Method | Auth | Description |
|---------|----------|--------|------|-------------|
| **Authentication** |
| Social Login | `/api/auth/social-login` | POST | No | Google login |
| Refresh Token | `/api/auth/refresh` | POST | No | Refresh JWT |
| Logout | `/api/auth/logout` | POST | Yes | Logout |
| **Shops** |
| Browse Shops | `/api/shops` | GET | No | List all shops |
| Shop Details | `/api/shops/:id` | GET | No | Shop details with images/services |
| Nearby Shops | `/api/shops/nearby` | GET | No | Location-based search |
| Popular Shops | `/api/shops/popular` | GET | No | Top rated shops |
| **Reservations** |
| Available Slots | `/api/shops/:shopId/available-slots` | GET | No | Get time slots |
| Create Booking | `/api/reservations` | POST | Yes | Create reservation |
| My Reservations | `/api/reservations` | GET | Yes | List user's reservations |
| Reservation Detail | `/api/reservations/:id` | GET | Yes | Full reservation details |
| Cancel Reservation | `/api/reservations/:id/cancel` | PUT | Yes | Cancel booking |
| Refund Preview | `/api/reservations/:id/refund-preview` | GET | Yes | Check refund amount |
| **Profile** |
| Get Profile | `/api/user/profile` | GET | Yes | User profile data |
| Update Profile | `/api/user/profile` | PUT | Yes | Update user info |
| **Favorites** |
| Get Favorites | `/api/user/favorites` | GET | Yes | List favorite shops |
| Add Favorite | `/api/user/favorites` | POST | Yes | Add shop to favorites |
| Remove Favorite | `/api/user/favorites/:shopId` | DELETE | Yes | Remove favorite |
| **Reviews** |
| Get Reviews | `/api/shops/:shopId/reviews` | GET | No | Shop reviews |
| Write Review | `/api/reviews` | POST | Yes | Submit review |
| **Referrals** |
| Get Stats | `/api/referrals/stats` | GET | Yes | Referral statistics |
| Get History | `/api/referrals/history` | GET | Yes | Referral history |
| **Notifications** |
| Get Notifications | `/api/user/notifications` | GET | Yes | User notifications |
| Mark as Read | `/api/user/notifications/:id/read` | PUT | Yes | Mark notification read |

---

## Implementation Checklist

### Essential Pages:
- ✅ `/shops` - Browse shops with filters
- ✅ `/shops/[id]` - Shop details with booking button
- ✅ `/booking/[shopId]` - Booking wizard
- ✅ `/reservations` - My reservations list
- ✅ `/reservations/[id]` - Reservation detail with actions
- ✅ `/profile` - User profile view/edit
- ✅ `/favorites` - Favorite shops
- ✅ `/reviews/write` - Write review
- ✅ `/referrals` - Referral dashboard
- ✅ `/notifications` - Notifications center

### Essential Features:
- ✅ Authentication (Google OAuth)
- ✅ Token management (access + refresh)
- ✅ WebSocket for real-time updates
- ✅ Error handling
- ✅ Loading states
- ✅ Responsive design

All endpoints are documented and ready to implement! 🚀
