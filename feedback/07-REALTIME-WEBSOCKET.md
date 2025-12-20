# Implementation Plan: Real-time WebSocket Integration

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 8-12 hours |
| **Risk Level** | Low |
| **Components Affected** | Frontend only (Backend ready) |
| **Dependencies** | Backend WebSocket service (implemented) |

## Problem Statement

The WebSocket backend is **fully implemented** but the frontend is not connected. The evaluation identified:

```
Backend: WebSocket events implemented ✅
Frontend: Not connected ❌
```

**Current Backend State** (`src/services/websocket.service.ts`):
- Socket.io server configured
- Authentication handling
- Room management (admin, user, shop, reservation)
- Event types: `reservation_update`, `payment_update`, `notification`, `activity_update`
- Admin real-time dashboards

**Missing Frontend:**
- Socket.io client connection
- Event subscriptions
- Real-time notification display
- Booking status live updates

---

## Backend Capabilities (Already Implemented)

### Available Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `authenticate` | Client → Server | JWT authentication |
| `auth_success` | Server → Client | Authentication confirmed |
| `auth_error` | Server → Client | Authentication failed |
| `join_room` | Client → Server | Join a notification room |
| `leave_room` | Client → Server | Leave a room |
| `reservation_update` | Bidirectional | Booking status changes |
| `payment_update` | Server → Client | Payment confirmations |
| `notification` | Server → Client | General notifications |
| `admin_notification` | Server → Client | Admin-specific alerts |
| `settings_update` | Server → Client | User settings sync |
| `user_activity` | Server → Client | Admin activity monitoring |

### Room Types

| Room | Purpose | Participants |
|------|---------|--------------|
| `user-{userId}` | Personal notifications | Single user |
| `shop-{shopId}` | Shop updates | Shop owner + staff |
| `reservation-{id}` | Booking updates | User + shop |
| `admin-general` | Admin dashboard | All admins |
| `admin-reservations` | Reservation alerts | Admins |
| `admin-payments` | Payment alerts | Admins |

---

## Frontend Implementation

### Step 1: Install Socket.io Client

```bash
cd /home/bitnami/ebeautything-app
npm install socket.io-client
```

### Step 2: Create WebSocket Context

**File:** `src/contexts/WebSocketContext.tsx`

```tsx
/**
 * WebSocket Context
 * Manages Socket.io connection and real-time updates
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

// Event types
export interface ReservationUpdateEvent {
  reservationId: string;
  status: string;
  shopId: string;
  userId: string;
  updateType: 'created' | 'confirmed' | 'cancelled' | 'modified' | 'completed';
  timestamp: string;
  data?: Record<string, any>;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface PaymentUpdateEvent {
  paymentId: string;
  reservationId: string;
  status: string;
  amount: number;
  timestamp: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  isAuthenticated: boolean;
  connect: () => void;
  disconnect: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  onReservationUpdate: (callback: (data: ReservationUpdateEvent) => void) => () => void;
  onNotification: (callback: (data: NotificationEvent) => void) => () => void;
  onPaymentUpdate: (callback: (data: PaymentUpdateEvent) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

const SOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001';

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Event listeners map
  const reservationListeners = useRef<Set<(data: ReservationUpdateEvent) => void>>(new Set());
  const notificationListeners = useRef<Set<(data: NotificationEvent) => void>>(new Set());
  const paymentListeners = useRef<Set<(data: PaymentUpdateEvent) => void>>(new Set());

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Connection events
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);

      // Authenticate if we have a session
      if (session?.access_token) {
        socket.emit('authenticate', { token: session.access_token });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
    });

    // Authentication events
    socket.on('auth_success', (data) => {
      console.log('✅ WebSocket authenticated:', data.userId);
      setIsAuthenticated(true);

      // Auto-join user's personal room
      socket.emit('join_room', {
        roomId: `user-${data.userId}`,
        userId: data.userId,
      });
    });

    socket.on('auth_error', (data) => {
      console.error('❌ WebSocket auth error:', data.message);
      setIsAuthenticated(false);
    });

    // Reservation updates
    socket.on('reservation_update', (data: ReservationUpdateEvent) => {
      console.log('📅 Reservation update:', data);
      reservationListeners.current.forEach((callback) => callback(data));

      // Show toast notification
      const statusMessages: Record<string, string> = {
        confirmed: '예약이 확정되었습니다!',
        cancelled: '예약이 취소되었습니다.',
        modified: '예약이 변경되었습니다.',
        completed: '서비스가 완료되었습니다.',
      };

      if (statusMessages[data.updateType]) {
        toast({
          title: '예약 알림',
          description: statusMessages[data.updateType],
        });
      }
    });

    // General notifications
    socket.on('notification', (data: NotificationEvent) => {
      console.log('🔔 Notification:', data);
      notificationListeners.current.forEach((callback) => callback(data));

      toast({
        title: data.title,
        description: data.body,
      });
    });

    // Payment updates
    socket.on('payment_update', (data: PaymentUpdateEvent) => {
      console.log('💳 Payment update:', data);
      paymentListeners.current.forEach((callback) => callback(data));
    });

    socket.connect();
    socketRef.current = socket;
  }, [session?.access_token, toast]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsAuthenticated(false);
    }
  }, []);

  // Join a room
  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('join_room', { roomId, userId: user.id });
    }
  }, [user?.id]);

  // Leave a room
  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('leave_room', { roomId, userId: user.id });
    }
  }, [user?.id]);

  // Event subscription hooks
  const onReservationUpdate = useCallback(
    (callback: (data: ReservationUpdateEvent) => void) => {
      reservationListeners.current.add(callback);
      return () => {
        reservationListeners.current.delete(callback);
      };
    },
    []
  );

  const onNotification = useCallback(
    (callback: (data: NotificationEvent) => void) => {
      notificationListeners.current.add(callback);
      return () => {
        notificationListeners.current.delete(callback);
      };
    },
    []
  );

  const onPaymentUpdate = useCallback(
    (callback: (data: PaymentUpdateEvent) => void) => {
      paymentListeners.current.add(callback);
      return () => {
        paymentListeners.current.delete(callback);
      };
    },
    []
  );

  // Auto-connect when user is authenticated
  useEffect(() => {
    if (user && session?.access_token && !isConnected) {
      connect();
    }

    return () => {
      // Don't disconnect on unmount to maintain connection
    };
  }, [user, session?.access_token, isConnected, connect]);

  // Cleanup on logout
  useEffect(() => {
    if (!user && isConnected) {
      disconnect();
    }
  }, [user, isConnected, disconnect]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        isAuthenticated,
        connect,
        disconnect,
        joinRoom,
        leaveRoom,
        onReservationUpdate,
        onNotification,
        onPaymentUpdate,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}

export default WebSocketContext;
```

### Step 3: Create useRealtimeBooking Hook

**File:** `src/hooks/use-realtime-booking.ts`

```typescript
/**
 * useRealtimeBooking Hook
 * Provides real-time booking status updates
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { useWebSocket, ReservationUpdateEvent } from '@/contexts/WebSocketContext';
import { useQueryClient } from '@tanstack/react-query';

interface UseRealtimeBookingOptions {
  reservationId?: string;
  shopId?: string;
  onUpdate?: (update: ReservationUpdateEvent) => void;
}

export function useRealtimeBooking(options: UseRealtimeBookingOptions = {}) {
  const { reservationId, shopId, onUpdate } = options;
  const { isConnected, isAuthenticated, joinRoom, leaveRoom, onReservationUpdate } = useWebSocket();
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<ReservationUpdateEvent | null>(null);

  // Handle reservation updates
  const handleUpdate = useCallback(
    (update: ReservationUpdateEvent) => {
      // Filter updates if specific reservation/shop is specified
      if (reservationId && update.reservationId !== reservationId) return;
      if (shopId && update.shopId !== shopId) return;

      setLastUpdate(update);

      // Invalidate booking queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', update.reservationId] });

      // Call custom callback
      onUpdate?.(update);
    },
    [reservationId, shopId, queryClient, onUpdate]
  );

  // Subscribe to reservation updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = onReservationUpdate(handleUpdate);

    // Join specific reservation room if provided
    if (reservationId) {
      joinRoom(`reservation-${reservationId}`);
    }

    // Join shop room if provided
    if (shopId) {
      joinRoom(`shop-${shopId}`);
    }

    return () => {
      unsubscribe();
      if (reservationId) {
        leaveRoom(`reservation-${reservationId}`);
      }
      if (shopId) {
        leaveRoom(`shop-${shopId}`);
      }
    };
  }, [isAuthenticated, reservationId, shopId, handleUpdate, joinRoom, leaveRoom, onReservationUpdate]);

  return {
    isConnected,
    isAuthenticated,
    lastUpdate,
  };
}

export default useRealtimeBooking;
```

### Step 4: Create Connection Status Indicator

**File:** `src/components/websocket/connection-status.tsx`

```tsx
/**
 * WebSocket Connection Status Indicator
 * Shows connection status in the UI
 */

'use client';

import { useWebSocket } from '@/contexts/WebSocketContext';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function ConnectionStatus({ showLabel = false, className }: ConnectionStatusProps) {
  const { isConnected, isAuthenticated } = useWebSocket();

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {isConnected ? (
        <>
          <div className="relative">
            <Wifi className={cn(
              'h-4 w-4',
              isAuthenticated ? 'text-green-500' : 'text-yellow-500'
            )} />
            {isAuthenticated && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          {showLabel && (
            <span className="text-xs text-muted-foreground">
              {isAuthenticated ? '실시간 연결' : '연결 중...'}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-gray-400" />
          {showLabel && (
            <span className="text-xs text-muted-foreground">오프라인</span>
          )}
        </>
      )}
    </div>
  );
}

export default ConnectionStatus;
```

### Step 5: Add Provider to App Layout

**File:** `src/app/layout.tsx`

```tsx
// Add WebSocketProvider to the provider tree
import { WebSocketProvider } from '@/contexts/WebSocketContext';

// In the layout:
<AuthProvider>
  <WebSocketProvider>
    {/* ... other providers */}
    {children}
  </WebSocketProvider>
</AuthProvider>
```

### Step 6: Integrate with Booking Pages

**File:** `src/app/(dashboard)/dashboard/bookings/page.tsx`

Add real-time updates:

```tsx
import { useRealtimeBooking } from '@/hooks/use-realtime-booking';

// Inside component:
const { lastUpdate } = useRealtimeBooking({
  onUpdate: (update) => {
    // Optionally handle specific updates
    console.log('Booking updated:', update);
  },
});

// The booking list will auto-refresh when updates come in
```

### Step 7: Add Environment Variable

**File:** `.env.local.dev`

```bash
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:4001
```

**File:** `.env.production`

```bash
NEXT_PUBLIC_WEBSOCKET_URL=https://api.e-beautything.com
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/contexts/WebSocketContext.tsx` | **CREATE** | Main WebSocket context |
| `src/hooks/use-realtime-booking.ts` | **CREATE** | Booking updates hook |
| `src/components/websocket/connection-status.tsx` | **CREATE** | Connection indicator |
| `src/app/layout.tsx` | **MODIFY** | Add WebSocketProvider |
| `src/app/(dashboard)/dashboard/bookings/page.tsx` | **MODIFY** | Add real-time updates |
| `.env.local.dev` | **MODIFY** | Add WebSocket URL |
| `package.json` | **MODIFY** | Add socket.io-client |

---

## Testing Plan

### Manual Testing

- [ ] WebSocket connects on login
- [ ] WebSocket disconnects on logout
- [ ] Connection status indicator updates
- [ ] Reservation updates received in real-time
- [ ] Toast notifications appear
- [ ] Query cache invalidated on updates
- [ ] Reconnection works after network loss
- [ ] Room joining/leaving works

### Test Scenarios

1. **Login flow**: WebSocket connects and authenticates
2. **Booking update**: Create booking on another device, see update
3. **Network loss**: Disconnect network, verify reconnection
4. **Multiple tabs**: Updates sync across tabs

---

## Deployment Checklist

- [ ] Install socket.io-client
- [ ] Create WebSocket context
- [ ] Create hooks
- [ ] Create status component
- [ ] Add provider to layout
- [ ] Configure environment variables
- [ ] Test connection
- [ ] Test real-time updates
- [ ] Deploy to staging
- [ ] Verify production WebSocket URL
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Connection success rate | >95% |
| Message delivery latency | <500ms |
| Reconnection success | >90% |
| User satisfaction with real-time updates | Positive |
