# User Reservation Detail - Complete Frontend Implementation

Complete guide for displaying user reservation details in the user app.

---

## Backend Endpoint

**GET** `/api/reservations/:id`

- **Authentication:** Required (User JWT)
- **Path Parameter:** `id` - Reservation UUID
- **Authorization:** User can only view their own reservations

---

## Enhanced Response Structure

```typescript
{
  success: true,
  data: {
    reservation: {
      // Basic Reservation Info
      id: string,
      shopId: string,
      userId: string,
      reservationDate: string,        // "2025-11-13"
      reservationTime: string,        // "14:00"
      status: 'requested' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
      totalAmount: number,
      depositAmount: number,
      remainingAmount: number,
      pointsUsed: number,
      specialRequests: string,
      createdAt: string,
      updatedAt: string,

      // ✅ Complete Shop Information
      shop: {
        id: string,
        name: string,
        description: string,
        phoneNumber: string,
        email: string,
        address: string,
        detailedAddress: string,
        postalCode: string,
        latitude: number,
        longitude: number,
        mainCategory: string,
        operatingHours: {
          monday: { open: string, close: string, closed: boolean },
          // ... other days
        },
        kakaoChannelUrl: string
      },

      // ✅ Service Details Array
      services: [
        {
          id: string,
          serviceId: string,
          serviceName: string,
          description: string,
          category: string,
          durationMinutes: number,
          quantity: number,
          unitPrice: number,
          totalPrice: number
        }
      ],

      // ✅ Payment Information
      payments: [
        {
          id: string,
          amount: number,
          paymentMethod: string,
          paymentStatus: string,
          paidAt: string,
          transactionId: string
        }
      ]
    }
  }
}
```

---

## 1. API Client (`lib/api/reservations.ts`)

```typescript
import { apiClient } from './client';

export interface ReservationDetail {
  id: string;
  shopId: string;
  userId: string;
  reservationDate: string;
  reservationTime: string;
  status: 'requested' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  pointsUsed: number;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  shop: ShopInfo;
  services: ServiceDetail[];
  payments: PaymentDetail[];
}

export interface ShopInfo {
  id: string;
  name: string;
  description: string;
  phoneNumber: string;
  email: string;
  address: string;
  detailedAddress: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  mainCategory: string;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }>;
  kakaoChannelUrl?: string;
}

export interface ServiceDetail {
  id: string;
  serviceId: string;
  serviceName: string;
  description: string;
  category: string;
  durationMinutes: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentDetail {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paidAt: string;
  transactionId: string;
}

/**
 * Get reservation details by ID
 */
export async function getReservationById(reservationId: string, token: string) {
  return apiClient.get<{
    success: boolean;
    data: {
      reservation: ReservationDetail;
    };
  }>(`/api/reservations/${reservationId}`, token);
}

/**
 * Get refund preview before cancellation
 */
export async function getRefundPreview(
  reservationId: string,
  token: string,
  cancellationType: 'user_request' | 'shop_request' = 'user_request'
) {
  return apiClient.get<{
    success: boolean;
    data: {
      refundAmount: number;
      refundPercentage: number;
      cancellationFee: number;
      cancellationWindow: string;
      isEligible: boolean;
      reason: string;
    };
  }>(`/api/reservations/${reservationId}/refund-preview?cancellationType=${cancellationType}`, token);
}

/**
 * Cancel reservation
 */
export async function cancelReservation(
  reservationId: string,
  token: string,
  data: {
    reason?: string;
    cancellationType?: 'user_request' | 'shop_request';
    refundPreference?: 'full_refund' | 'partial_refund' | 'no_refund';
  }
) {
  return apiClient.put<{
    success: boolean;
    data: {
      reservationId: string;
      status: string;
      cancelledAt: string;
      refundAmount: number;
      refundStatus: string;
    };
  }>(`/api/reservations/${reservationId}/cancel`, data, token);
}
```

---

## 2. React Hook (`hooks/useReservations.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as reservationApi from '@/lib/api/reservations';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Get reservation details
 */
export function useReservation(reservationId: string) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => reservationApi.getReservationById(reservationId, token),
    enabled: !!token && !!reservationId,
  });
}

/**
 * Get refund preview
 */
export function useRefundPreview(reservationId: string, cancellationType: 'user_request' | 'shop_request' = 'user_request') {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['refundPreview', reservationId, cancellationType],
    queryFn: () => reservationApi.getRefundPreview(reservationId, token, cancellationType),
    enabled: !!token && !!reservationId,
  });
}

/**
 * Cancel reservation mutation
 */
export function useCancelReservation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reservationId, ...data }: { reservationId: string; reason?: string }) =>
      reservationApi.cancelReservation(reservationId, token, data),
    onSuccess: (response, variables) => {
      // Invalidate and refetch reservation data
      queryClient.invalidateQueries({ queryKey: ['reservation', variables.reservationId] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}
```

---

## 3. Reservation Detail Page (`app/reservations/[id]/page.tsx`)

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useReservation, useCancelReservation, useRefundPreview } from '@/hooks/useReservations';
import Image from 'next/image';
import Link from 'next/link';

export default function ReservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;

  const { data, isLoading, error } = useReservation(reservationId);
  const cancelMutation = useCancelReservation();

  const [showCancelModal, setShowCancelModal] = useState(false);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner">Loading reservation...</div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="error-container">
        <h2>Reservation Not Found</h2>
        <p>This reservation doesn't exist or you don't have permission to view it.</p>
        <Link href="/reservations">
          <button>Back to Reservations</button>
        </Link>
      </div>
    );
  }

  const reservation = data.data.reservation;

  return (
    <div className="reservation-detail-page">
      {/* Header with Status */}
      <div className="page-header">
        <button onClick={() => router.back()} className="back-button">
          ← Back
        </button>
        <div className="header-content">
          <h1>Reservation Details</h1>
          <StatusBadge status={reservation.status} />
        </div>
      </div>

      {/* ========================================
          SHOP INFORMATION SECTION
          ======================================== */}
      <section className="shop-section">
        <h2>Shop Information</h2>
        <div className="shop-card">
          <div className="shop-header">
            <h3>{reservation.shop.name}</h3>
            <span className="category-badge">{reservation.shop.mainCategory}</span>
          </div>

          {reservation.shop.description && (
            <p className="shop-description">{reservation.shop.description}</p>
          )}

          {/* Contact Information */}
          <div className="shop-contact">
            <h4>Contact</h4>
            <div className="contact-methods">
              <a href={`tel:${reservation.shop.phoneNumber}`} className="contact-link">
                📞 {reservation.shop.phoneNumber}
              </a>

              {reservation.shop.email && (
                <a href={`mailto:${reservation.shop.email}`} className="contact-link">
                  ✉️ {reservation.shop.email}
                </a>
              )}

              {reservation.shop.kakaoChannelUrl && (
                <a
                  href={reservation.shop.kakaoChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link"
                >
                  💬 Kakao Channel
                </a>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="shop-location">
            <h4>Location</h4>
            <p className="address">{reservation.shop.address}</p>
            {reservation.shop.detailedAddress && (
              <p className="detailed-address">{reservation.shop.detailedAddress}</p>
            )}
            {reservation.shop.postalCode && (
              <p className="postal-code">Postal Code: {reservation.shop.postalCode}</p>
            )}

            {/* Map Link */}
            {reservation.shop.latitude && reservation.shop.longitude && (
              <a
                href={`https://www.google.com/maps?q=${reservation.shop.latitude},${reservation.shop.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="map-link"
              >
                📍 View on Map
              </a>
            )}
          </div>

          {/* Operating Hours */}
          <div className="operating-hours">
            <h4>Operating Hours</h4>
            <div className="hours-list">
              {Object.entries(reservation.shop.operatingHours || {}).map(([day, hours]) => (
                <div key={day} className="hours-row">
                  <span className="day">{capitalize(day)}</span>
                  <span className="time">
                    {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          RESERVATION INFORMATION SECTION
          ======================================== */}
      <section className="reservation-section">
        <h2>Reservation Details</h2>
        <div className="reservation-info-grid">
          <div className="info-item">
            <label>Reservation ID</label>
            <p className="mono">{reservation.id}</p>
          </div>

          <div className="info-item">
            <label>Date</label>
            <p className="date">{formatDate(reservation.reservationDate)}</p>
          </div>

          <div className="info-item">
            <label>Time</label>
            <p className="time">{reservation.reservationTime}</p>
          </div>

          <div className="info-item">
            <label>Status</label>
            <StatusBadge status={reservation.status} />
          </div>

          <div className="info-item">
            <label>Booked On</label>
            <p>{formatDateTime(reservation.createdAt)}</p>
          </div>

          {reservation.updatedAt !== reservation.createdAt && (
            <div className="info-item">
              <label>Last Updated</label>
              <p>{formatDateTime(reservation.updatedAt)}</p>
            </div>
          )}
        </div>
      </section>

      {/* ========================================
          SERVICES SECTION
          ======================================== */}
      <section className="services-section">
        <h2>Services Booked</h2>
        <div className="services-list">
          {reservation.services.map((service) => (
            <div key={service.id} className="service-item">
              <div className="service-header">
                <h3>{service.serviceName}</h3>
                <span className="category-badge">{service.category}</span>
              </div>

              {service.description && (
                <p className="service-description">{service.description}</p>
              )}

              <div className="service-details">
                <div className="detail-row">
                  <span className="label">Duration</span>
                  <span className="value">{service.durationMinutes} minutes</span>
                </div>

                <div className="detail-row">
                  <span className="label">Quantity</span>
                  <span className="value">×{service.quantity}</span>
                </div>

                <div className="detail-row">
                  <span className="label">Unit Price</span>
                  <span className="value">₩{service.unitPrice.toLocaleString()}</span>
                </div>

                <div className="detail-row total">
                  <span className="label">Subtotal</span>
                  <span className="value">₩{service.totalPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Duration */}
        <div className="total-duration">
          <span>Total Duration:</span>
          <span>
            {reservation.services.reduce((total, s) => total + (s.durationMinutes * s.quantity), 0)} minutes
          </span>
        </div>
      </section>

      {/* ========================================
          PAYMENT SECTION
          ======================================== */}
      <section className="payment-section">
        <h2>Payment Information</h2>
        <div className="payment-summary">
          <div className="payment-row">
            <span>Subtotal</span>
            <span>₩{reservation.totalAmount.toLocaleString()}</span>
          </div>

          {reservation.pointsUsed > 0 && (
            <div className="payment-row discount">
              <span>Points Used</span>
              <span>-₩{reservation.pointsUsed.toLocaleString()}</span>
            </div>
          )}

          {reservation.depositAmount > 0 && (
            <>
              <div className="payment-row deposit">
                <span>Deposit Paid</span>
                <span>₩{reservation.depositAmount.toLocaleString()}</span>
              </div>

              <div className="payment-row remaining">
                <span>Remaining Balance</span>
                <span className="highlight">₩{reservation.remainingAmount.toLocaleString()}</span>
              </div>
            </>
          )}

          <div className="payment-row total">
            <span>Total Amount</span>
            <span>₩{reservation.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment History */}
        {reservation.payments && reservation.payments.length > 0 && (
          <div className="payment-history">
            <h3>Payment History</h3>
            {reservation.payments.map((payment) => (
              <div key={payment.id} className="payment-item">
                <div className="payment-info">
                  <span className="payment-method">{payment.paymentMethod}</span>
                  <span className={`payment-status ${payment.paymentStatus}`}>
                    {payment.paymentStatus}
                  </span>
                </div>
                <div className="payment-details">
                  <span className="amount">₩{payment.amount.toLocaleString()}</span>
                  {payment.paidAt && (
                    <span className="date">{formatDateTime(payment.paidAt)}</span>
                  )}
                </div>
                {payment.transactionId && (
                  <p className="transaction-id">Transaction: {payment.transactionId}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Payment Due Notice */}
        {reservation.remainingAmount > 0 && reservation.status === 'confirmed' && (
          <div className="payment-notice">
            <p>
              ⚠️ Please pay the remaining balance of{' '}
              <strong>₩{reservation.remainingAmount.toLocaleString()}</strong>{' '}
              at the shop on {formatDate(reservation.reservationDate)}.
            </p>
          </div>
        )}
      </section>

      {/* ========================================
          SPECIAL REQUESTS SECTION
          ======================================== */}
      {reservation.specialRequests && (
        <section className="special-requests-section">
          <h2>Special Requests</h2>
          <div className="requests-box">
            <p>{reservation.specialRequests}</p>
          </div>
        </section>
      )}

      {/* ========================================
          ACTION BUTTONS SECTION
          ======================================== */}
      <section className="actions-section">
        {/* Status-specific actions */}
        {reservation.status === 'requested' && (
          <div className="actions-group">
            <div className="status-message pending">
              <p>⏳ Your reservation is pending approval from the shop.</p>
              <p>You'll receive a notification once it's confirmed.</p>
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              className="btn-danger"
            >
              Cancel Request
            </button>
          </div>
        )}

        {reservation.status === 'confirmed' && (
          <div className="actions-group">
            <div className="status-message confirmed">
              <p>✅ Your reservation is confirmed!</p>
              <p>Please arrive on time: {reservation.reservationDate} at {reservation.reservationTime}</p>
            </div>

            <div className="action-buttons">
              <button onClick={() => addToCalendar(reservation)} className="btn-secondary">
                📅 Add to Calendar
              </button>

              <a
                href={`https://www.google.com/maps?q=${reservation.shop.latitude},${reservation.shop.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                🗺️ Get Directions
              </a>

              <Link href={`/reservations/${reservationId}/reschedule`}>
                <button className="btn-secondary">
                  🔄 Reschedule
                </button>
              </Link>

              <button
                onClick={() => setShowCancelModal(true)}
                className="btn-danger"
              >
                ❌ Cancel Reservation
              </button>
            </div>
          </div>
        )}

        {reservation.status === 'completed' && (
          <div className="actions-group">
            <div className="status-message completed">
              <p>✨ Service completed!</p>
            </div>
            <Link href={`/shops/${reservation.shopId}/review?reservationId=${reservationId}`}>
              <button className="btn-primary">
                ⭐ Write a Review
              </button>
            </Link>
            <Link href={`/shops/${reservation.shopId}`}>
              <button className="btn-secondary">
                🔁 Book Again
              </button>
            </Link>
          </div>
        )}

        {reservation.status === 'cancelled' && (
          <div className="actions-group">
            <div className="status-message cancelled">
              <p>This reservation was cancelled.</p>
            </div>
            <Link href={`/shops/${reservation.shopId}`}>
              <button className="btn-primary">
                Book Again
              </button>
            </Link>
          </div>
        )}

        {/* Contact Shop (always available) */}
        <div className="contact-shop-section">
          <h3>Need Help?</h3>
          <div className="contact-buttons">
            <a href={`tel:${reservation.shop.phoneNumber}`} className="contact-btn">
              📞 Call Shop
            </a>
            <a href={`sms:${reservation.shop.phoneNumber}`} className="contact-btn">
              💬 Send Message
            </a>
            {reservation.shop.kakaoChannelUrl && (
              <a
                href={reservation.shop.kakaoChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-btn"
              >
                💬 Kakao Chat
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ========================================
          CANCELLATION MODAL
          ======================================== */}
      {showCancelModal && (
        <CancellationModal
          reservation={reservation}
          onClose={() => setShowCancelModal(false)}
          onConfirm={async (reason) => {
            await cancelMutation.mutateAsync({
              reservationId: reservation.id,
              reason,
            });
            setShowCancelModal(false);
            router.push('/reservations');
          }}
        />
      )}
    </div>
  );
}

// ========================================
// STATUS BADGE COMPONENT
// ========================================

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    requested: { label: '예약 요청', color: 'yellow', icon: '⏳' },
    confirmed: { label: '예약 확정', color: 'green', icon: '✅' },
    in_progress: { label: '진행 중', color: 'blue', icon: '🔄' },
    completed: { label: '완료', color: 'gray', icon: '✨' },
    cancelled: { label: '취소됨', color: 'red', icon: '❌' },
    no_show: { label: '노쇼', color: 'red', icon: '⚠️' },
  };

  const config = statusConfig[status] || { label: status, color: 'gray', icon: '' };

  return (
    <span className={`status-badge ${config.color}`}>
      {config.icon} {config.label}
    </span>
  );
}

// ========================================
// CANCELLATION MODAL COMPONENT
// ========================================

function CancellationModal({
  reservation,
  onClose,
  onConfirm,
}: {
  reservation: ReservationDetail;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: refundData } = useRefundPreview(reservation.id, 'user_request');
  const refundPreview = refundData?.data;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason);
    } catch (error) {
      alert('Failed to cancel reservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Cancel Reservation</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-body">
          {/* Refund Information */}
          {refundPreview && (
            <div className="refund-info">
              <h3>Refund Information</h3>
              {refundPreview.isEligible ? (
                <div className="refund-details">
                  <div className="refund-row">
                    <span>Refund Amount</span>
                    <span className="amount">₩{refundPreview.refundAmount.toLocaleString()}</span>
                  </div>
                  <div className="refund-row">
                    <span>Refund Percentage</span>
                    <span>{refundPreview.refundPercentage}%</span>
                  </div>
                  {refundPreview.cancellationFee > 0 && (
                    <div className="refund-row fee">
                      <span>Cancellation Fee</span>
                      <span>₩{refundPreview.cancellationFee.toLocaleString()}</span>
                    </div>
                  )}
                  <p className="refund-notice">{refundPreview.cancellationWindow}</p>
                </div>
              ) : (
                <div className="refund-ineligible">
                  <p>⚠️ {refundPreview.reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Cancellation Reason */}
          <div className="form-group">
            <label>Reason for Cancellation (Optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please let us know why you're cancelling..."
              rows={4}
              maxLength={500}
            />
            <small>{reason.length}/500 characters</small>
          </div>

          {/* Warning */}
          <div className="warning-box">
            <p>⚠️ This action cannot be undone.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={loading}>
            Keep Reservation
          </button>
          <button
            onClick={handleConfirm}
            className="btn-danger"
            disabled={loading}
          >
            {loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function addToCalendar(reservation: ReservationDetail) {
  const startDate = new Date(`${reservation.reservationDate}T${reservation.reservationTime}`);
  const totalDuration = reservation.services.reduce(
    (total, s) => total + s.durationMinutes * s.quantity,
    0
  );
  const endDate = new Date(startDate.getTime() + totalDuration * 60000);

  const title = `${reservation.shop.name} - ${reservation.services.map(s => s.serviceName).join(', ')}`;
  const description = `Reservation at ${reservation.shop.name}\n${reservation.shop.address}\n\nServices:\n${reservation.services.map(s => `- ${s.serviceName} (x${s.quantity})`).join('\n')}`;
  const location = `${reservation.shop.address} ${reservation.shop.detailedAddress || ''}`;

  // Google Calendar URL
  const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
  googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
  googleCalendarUrl.searchParams.set('text', title);
  googleCalendarUrl.searchParams.set('dates', `${formatISOForCalendar(startDate)}/${formatISOForCalendar(endDate)}`);
  googleCalendarUrl.searchParams.set('details', description);
  googleCalendarUrl.searchParams.set('location', location);

  window.open(googleCalendarUrl.toString(), '_blank');
}

function formatISOForCalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
```

---

## 4. Reservation List Page with Links (`app/reservations/page.tsx`)

```tsx
'use client';

import { useReservations } from '@/hooks/useReservations';
import Link from 'next/link';
import { useState } from 'react';

export default function ReservationsListPage() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  const { data, isLoading } = useReservations({
    status: filter,
    limit: 20,
  });

  if (isLoading) return <div>Loading...</div>;

  const reservations = data?.data.reservations || [];

  return (
    <div className="reservations-list-page">
      <h1>My Reservations</h1>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          onClick={() => setFilter('upcoming')}
          className={filter === 'upcoming' ? 'active' : ''}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('past')}
          className={filter === 'past' ? 'active' : ''}
        >
          Past
        </button>
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'active' : ''}
        >
          All
        </button>
      </div>

      {/* Reservations List */}
      <div className="reservations-grid">
        {reservations.map((reservation) => (
          <Link
            key={reservation.id}
            href={`/reservations/${reservation.id}`}
            className="reservation-card-link"
          >
            <div className="reservation-card">
              <div className="card-header">
                <StatusBadge status={reservation.status} />
                <span className="date">
                  {reservation.reservationDate} {reservation.reservationTime}
                </span>
              </div>

              <div className="card-body">
                <h3>{reservation.shop?.name || 'Shop'}</h3>
                <p className="services">
                  {reservation.services?.map(s => s.serviceName).join(', ')}
                </p>
                <p className="address">{reservation.shop?.address}</p>
              </div>

              <div className="card-footer">
                <span className="amount">₩{reservation.totalAmount.toLocaleString()}</span>
                <span className="view-details">View Details →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {reservations.length === 0 && (
        <div className="empty-state">
          <p>You don't have any {filter} reservations.</p>
          <Link href="/shops">
            <button className="btn-primary">Browse Shops</button>
          </Link>
        </div>
      )}
    </div>
  );
}
```

---

## 5. Mobile App Implementation (`screens/ReservationDetailScreen.tsx`)

```tsx
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useReservation, useCancelReservation } from '@/hooks/useReservations';

export default function ReservationDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const reservationId = route.params?.reservationId;

  const { data, isLoading } = useReservation(reservationId);
  const cancelMutation = useCancelReservation();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!data?.data) {
    return (
      <View style={styles.error}>
        <Text>Reservation not found</Text>
      </View>
    );
  }

  const reservation = data.data.reservation;

  const handleCancel = () => {
    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel this reservation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await cancelMutation.mutateAsync({ reservationId: reservation.id });
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleCallShop = () => {
    Linking.openURL(`tel:${reservation.shop.phoneNumber}`);
  };

  const handleGetDirections = () => {
    const url = `https://www.google.com/maps?q=${reservation.shop.latitude},${reservation.shop.longitude}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <StatusBadge status={reservation.status} />
        <Text style={styles.reservationId}>ID: {reservation.id.slice(0, 8)}...</Text>
      </View>

      {/* Shop Info Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shop</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ShopDetail', { shopId: reservation.shopId })}
          style={styles.shopCard}
        >
          <Text style={styles.shopName}>{reservation.shop.name}</Text>
          <Text style={styles.category}>{reservation.shop.mainCategory}</Text>
          <Text style={styles.address}>{reservation.shop.address}</Text>

          <View style={styles.contactRow}>
            <TouchableOpacity onPress={handleCallShop}>
              <Text style={styles.contactLink}>📞 Call</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleGetDirections}>
              <Text style={styles.contactLink}>🗺️ Directions</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      {/* Reservation Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date & Time</Text>
        <View style={styles.infoCard}>
          <Text style={styles.dateTime}>
            {formatDate(reservation.reservationDate)}
          </Text>
          <Text style={styles.time}>{reservation.reservationTime}</Text>
        </View>
      </View>

      {/* Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Services</Text>
        {reservation.services.map((service) => (
          <View key={service.id} style={styles.serviceItem}>
            <View style={styles.serviceHeader}>
              <Text style={styles.serviceName}>{service.serviceName}</Text>
              <Text style={styles.quantity}>×{service.quantity}</Text>
            </View>
            {service.description && (
              <Text style={styles.serviceDescription}>{service.description}</Text>
            )}
            <View style={styles.serviceFooter}>
              <Text style={styles.duration}>{service.durationMinutes} min</Text>
              <Text style={styles.price}>₩{service.totalPrice.toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Payment Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <Text>Total Amount</Text>
            <Text style={styles.amount}>₩{reservation.totalAmount.toLocaleString()}</Text>
          </View>

          {reservation.depositAmount > 0 && (
            <>
              <View style={styles.paymentRow}>
                <Text>Deposit Paid</Text>
                <Text style={styles.paid}>₩{reservation.depositAmount.toLocaleString()}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text>Remaining Balance</Text>
                <Text style={styles.remaining}>₩{reservation.remainingAmount.toLocaleString()}</Text>
              </View>
            </>
          )}

          {reservation.pointsUsed > 0 && (
            <View style={styles.paymentRow}>
              <Text>Points Used</Text>
              <Text style={styles.points}>-{reservation.pointsUsed.toLocaleString()}P</Text>
            </View>
          )}
        </View>
      </View>

      {/* Special Requests */}
      {reservation.specialRequests && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Requests</Text>
          <View style={styles.requestsBox}>
            <Text>{reservation.specialRequests}</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {reservation.status === 'confirmed' && (
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={handleGetDirections}>
              <Text style={styles.buttonText}>Get Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleCallShop}>
              <Text style={styles.buttonText}>Call Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerButton}
              onPress={handleCancel}
            >
              <Text style={styles.buttonText}>Cancel Reservation</Text>
            </TouchableOpacity>
          </>
        )}

        {reservation.status === 'completed' && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('WriteReview', {
              shopId: reservation.shopId,
              reservationId: reservation.id
            })}
          >
            <Text style={styles.buttonText}>⭐ Write Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusHeader: {
    padding: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  section: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  shopCard: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  shopName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 16,
  },
  contactLink: {
    color: '#007AFF',
    fontSize: 14,
  },
  serviceItem: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  duration: {
    fontSize: 14,
    color: '#666',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  paymentCard: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## 6. Styling (`app/reservations/[id]/page.module.css`)

```css
/* Reservation Detail Page Styles */

.reservation-detail-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.back-button {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #007AFF;
  margin-bottom: 8px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Shop Section */
.shop-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.shop-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
}

.shop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.category-badge {
  background: #f0f0f0;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
}

.shop-contact {
  margin-top: 16px;
}

.contact-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.contact-link {
  padding: 8px 16px;
  background: #f0f0f0;
  border-radius: 8px;
  text-decoration: none;
  color: #007AFF;
  font-size: 14px;
}

.contact-link:hover {
  background: #e0e0e0;
}

.shop-location {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.map-link {
  display: inline-block;
  margin-top: 8px;
  color: #007AFF;
  text-decoration: none;
}

.operating-hours {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.hours-list {
  margin-top: 8px;
}

.hours-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}

.day {
  font-weight: 500;
  text-transform: capitalize;
  color: #666;
  min-width: 100px;
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
}

.status-badge.yellow {
  background: #fff3cd;
  color: #856404;
}

.status-badge.green {
  background: #d4edda;
  color: #155724;
}

.status-badge.blue {
  background: #d1ecf1;
  color: #0c5460;
}

.status-badge.gray {
  background: #e9ecef;
  color: #495057;
}

.status-badge.red {
  background: #f8d7da;
  color: #721c24;
}

/* Services Section */
.services-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.service-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.service-details {
  margin-top: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 14px;
}

.detail-row.total {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
  font-weight: 600;
}

.total-duration {
  margin-top: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  font-weight: 500;
}

/* Payment Section */
.payment-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.payment-summary {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
}

.payment-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.payment-row.discount {
  color: #28a745;
}

.payment-row.deposit {
  color: #007AFF;
}

.payment-row.remaining {
  font-weight: 600;
}

.payment-row.total {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 2px solid #333;
  font-size: 18px;
  font-weight: bold;
}

.payment-notice {
  margin-top: 16px;
  padding: 12px;
  background: #fff3cd;
  border-radius: 8px;
  color: #856404;
}

/* Actions Section */
.actions-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.status-message {
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.status-message.pending {
  background: #fff3cd;
  color: #856404;
}

.status-message.confirmed {
  background: #d4edda;
  color: #155724;
}

.status-message.completed {
  background: #d1ecf1;
  color: #0c5460;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.btn-danger {
  background: #dc3545;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.contact-shop-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e0e0e0;
}

.contact-buttons {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.contact-btn {
  flex: 1;
  padding: 12px;
  text-align: center;
  background: #f0f0f0;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
}

.contact-btn:hover {
  background: #e0e0e0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.refund-info {
  margin-bottom: 20px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
}

.refund-details {
  margin-top: 12px;
}

.refund-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.warning-box {
  margin-top: 16px;
  padding: 12px;
  background: #fff3cd;
  border-radius: 8px;
  color: #856404;
}
```

---

## 7. Complete Data Flow Diagram

```
User clicks "View Details" on reservation
    ↓
Navigate to /reservations/:id
    ↓
GET /api/reservations/:id with JWT token
    ↓
Backend validates:
  - User is authenticated
  - User owns this reservation
    ↓
Backend fetches:
  - Reservation data
  - Shop details (JOIN shops table)
  - Services details (JOIN reservation_services + shop_services)
  - Payment history (JOIN reservation_payments)
    ↓
Response with complete nested data
    ↓
Frontend displays:
  - Shop info with contact methods
  - Reservation date/time/status
  - All services with prices
  - Payment summary
  - Action buttons (cancel, reschedule, review)
```

---

## Summary - What User Gets

### **Endpoint:** `GET /api/reservations/:id`

### **Complete Information Displayed:**

✅ **Shop Details:**
- Name, description, category
- Phone, email, Kakao channel
- Full address with map link
- Operating hours

✅ **Reservation Info:**
- Date, time, status
- Booking ID
- Created/updated timestamps

✅ **Services:**
- Each service name, description
- Duration, quantity, pricing
- Category tags

✅ **Payment:**
- Total amount
- Deposit paid
- Remaining balance
- Points used
- Payment history

✅ **Actions:**
- Call/message shop
- Get directions
- Add to calendar
- Cancel (with refund preview)
- Reschedule
- Write review (if completed)

Everything is included for a complete, professional reservation detail view! 🎉
