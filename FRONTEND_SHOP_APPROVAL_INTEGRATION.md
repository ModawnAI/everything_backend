# Frontend Shop Approval Integration Guide

## 🎯 Overview

This guide shows how to integrate the shop approval system into your admin frontend.

**Backend Endpoints Available:**
- `GET /api/admin/shops/approval` - List shops for approval with filtering
- `GET /api/admin/shops/approval/statistics` - Get approval statistics
- `GET /api/admin/shops/:id/approval/details` - Get detailed shop info
- `PUT /api/admin/shops/:id/approval` - Approve or reject a shop
- `POST /api/admin/shops/bulk-approval` - Bulk approve/reject

---

## 📦 Step 1: TypeScript Interfaces

```typescript
// src/types/shop-approval.types.ts

export type ShopStatus = 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted';
export type ShopVerificationStatus = 'pending' | 'verified' | 'rejected';
export type ServiceCategory = 'nail' | 'eyelash' | 'waxing' | 'eyebrow_tattoo' | 'hair';

export interface ShopApprovalFilters {
  status?: ShopStatus;
  verificationStatus?: ShopVerificationStatus;
  category?: ServiceCategory;
  search?: string;
  startDate?: string;
  endDate?: string;
  hasBusinessLicense?: boolean;
  isFeatured?: boolean;
  sortBy?: 'created_at' | 'name' | 'verification_status' | 'total_bookings';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ShopOwner {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  userStatus: string;
}

export interface ShopForApproval {
  id: string;
  name: string;
  description?: string;
  phoneNumber?: string;
  email?: string;
  address: string;
  detailedAddress?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  shopType: string;
  shopStatus: ShopStatus;
  verificationStatus: ShopVerificationStatus;
  businessLicenseNumber?: string;
  businessLicenseImageUrl?: string;
  mainCategory: ServiceCategory;
  subCategories?: ServiceCategory[];
  operatingHours?: Record<string, any>;
  paymentMethods?: string[];
  kakaoChannelUrl?: string;
  totalBookings: number;
  partnershipStartedAt?: string;
  featuredUntil?: string;
  isFeatured: boolean;
  commissionRate: number;
  createdAt: string;
  updatedAt: string;
  owner?: ShopOwner;
  daysSinceSubmission?: number;
  isUrgent: boolean;
  hasCompleteDocuments: boolean;
}

export interface ShopApprovalResponse {
  shops: ShopForApproval[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  filters: ShopApprovalFilters;
}

export interface ShopVerificationStatistics {
  totalShops: number;
  pendingShops: number;
  approvedShops: number;
  rejectedShops: number;
  verifiedShops: number;
  newShopsThisMonth: number;
  newShopsThisWeek: number;
  shopsByCategory: Record<ServiceCategory, number>;
  shopsByStatus: Record<ShopStatus, number>;
  shopsByVerificationStatus: Record<ShopVerificationStatus, number>;
  averageApprovalTime: number;
  topCategories: Array<{
    category: ServiceCategory;
    count: number;
    percentage: number;
  }>;
  recentApprovals: Array<{
    id: string;
    shopName: string;
    action: string;
    adminName: string;
    timestamp: string;
  }>;
}

export interface ShopApprovalRequest {
  action: 'approve' | 'reject';
  reason?: string;
  adminNotes?: string;
  verificationNotes?: string;
  notifyOwner?: boolean;
  autoActivate?: boolean;
}
```

---

## 🔧 Step 2: API Service Layer

```typescript
// src/services/shop-approval.service.ts

import { api } from './api';
import type {
  ShopApprovalFilters,
  ShopApprovalResponse,
  ShopVerificationStatistics,
  ShopForApproval,
  ShopApprovalRequest
} from '@/types/shop-approval.types';

export class ShopApprovalService {
  /**
   * Get shops for approval with filtering
   */
  static async getShopsForApproval(
    filters: ShopApprovalFilters = {}
  ): Promise<ShopApprovalResponse> {
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.verificationStatus) params.append('verificationStatus', filters.verificationStatus);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.hasBusinessLicense !== undefined)
      params.append('hasBusinessLicense', String(filters.hasBusinessLicense));
    if (filters.isFeatured !== undefined)
      params.append('isFeatured', String(filters.isFeatured));
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const response = await api.get<{ success: boolean; data: ShopApprovalResponse }>(
      `/admin/shops/approval?${params.toString()}`
    );

    return response.data.data;
  }

  /**
   * Get shop approval statistics
   */
  static async getStatistics(): Promise<ShopVerificationStatistics> {
    const response = await api.get<{ success: boolean; data: ShopVerificationStatistics }>(
      '/admin/shops/approval/statistics'
    );

    return response.data.data;
  }

  /**
   * Get detailed shop approval info
   */
  static async getShopDetails(shopId: string): Promise<ShopForApproval> {
    const response = await api.get<{ success: boolean; data: ShopForApproval }>(
      `/admin/shops/${shopId}/approval/details`
    );

    return response.data.data;
  }

  /**
   * Approve or reject a shop
   */
  static async processApproval(
    shopId: string,
    request: ShopApprovalRequest
  ): Promise<any> {
    const response = await api.put<{ success: boolean; data: any }>(
      `/admin/shops/${shopId}/approval`,
      request
    );

    return response.data.data;
  }

  /**
   * Bulk approve/reject shops
   */
  static async bulkApproval(
    shopIds: string[],
    action: 'approve' | 'reject',
    reason?: string,
    adminNotes?: string,
    autoActivate?: boolean
  ): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      '/admin/shops/bulk-approval',
      {
        shopIds,
        action,
        reason,
        adminNotes,
        autoActivate
      }
    );

    return response.data.data;
  }
}
```

---

## 🪝 Step 3: React Query Hooks

```typescript
// src/hooks/useShopApproval.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShopApprovalService } from '@/services/shop-approval.service';
import type { ShopApprovalFilters, ShopApprovalRequest } from '@/types/shop-approval.types';

/**
 * Hook to fetch shops for approval
 */
export function useShopsForApproval(filters: ShopApprovalFilters = {}) {
  return useQuery({
    queryKey: ['shops', 'approval', filters],
    queryFn: () => ShopApprovalService.getShopsForApproval(filters),
    staleTime: 30000, // 30 seconds
    retry: 2
  });
}

/**
 * Hook to fetch approval statistics
 */
export function useApprovalStatistics() {
  return useQuery({
    queryKey: ['shops', 'approval', 'statistics'],
    queryFn: () => ShopApprovalService.getStatistics(),
    staleTime: 60000, // 1 minute
    retry: 2
  });
}

/**
 * Hook to fetch shop details
 */
export function useShopDetails(shopId: string | null) {
  return useQuery({
    queryKey: ['shops', 'approval', 'details', shopId],
    queryFn: () => ShopApprovalService.getShopDetails(shopId!),
    enabled: !!shopId,
    staleTime: 30000
  });
}

/**
 * Hook to approve/reject a shop
 */
export function useProcessApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shopId, request }: { shopId: string; request: ShopApprovalRequest }) =>
      ShopApprovalService.processApproval(shopId, request),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['shops', 'approval'] });
      queryClient.invalidateQueries({ queryKey: ['shops', 'approval', 'statistics'] });
    }
  });
}

/**
 * Hook for bulk approval
 */
export function useBulkApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      shopIds,
      action,
      reason,
      adminNotes,
      autoActivate
    }: {
      shopIds: string[];
      action: 'approve' | 'reject';
      reason?: string;
      adminNotes?: string;
      autoActivate?: boolean;
    }) => ShopApprovalService.bulkApproval(shopIds, action, reason, adminNotes, autoActivate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shops', 'approval'] });
      queryClient.invalidateQueries({ queryKey: ['shops', 'approval', 'statistics'] });
    }
  });
}
```

---

## 🎨 Step 4: Components

### 4.1 Statistics Dashboard

```tsx
// src/components/admin/ShopApprovalStatistics.tsx

import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import { useApprovalStatistics } from '@/hooks/useShopApproval';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

export function ShopApprovalStatistics() {
  const { data: stats, isLoading, error } = useApprovalStatistics();

  if (isLoading) {
    return <LoadingOutlined spin style={{ fontSize: 24 }} />;
  }

  if (error) {
    return <div>통계를 불러오는 중 오류가 발생했습니다.</div>;
  }

  if (!stats) {
    return <div>통계 데이터가 없습니다.</div>;
  }

  return (
    <div className="shop-approval-statistics">
      {/* Key Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="전체 매장"
              value={stats.totalShops}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="승인 대기"
              value={stats.pendingShops}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="승인 완료"
              value={stats.approvedShops}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="거절됨"
              value={stats.rejectedShops}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Additional Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card title="이번 주 신규">
            <Statistic value={stats.newShopsThisWeek} suffix="개" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="이번 달 신규">
            <Statistic value={stats.newShopsThisMonth} suffix="개" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="평균 승인 시간">
            <Statistic value={stats.averageApprovalTime.toFixed(1)} suffix="일" />
          </Card>
        </Col>
      </Row>

      {/* Top Categories */}
      <Card title="카테고리별 매장 수" style={{ marginTop: 16 }}>
        <Table
          dataSource={stats.topCategories}
          columns={[
            {
              title: '카테고리',
              dataIndex: 'category',
              key: 'category',
              render: (category: string) => {
                const labels: Record<string, string> = {
                  nail: '네일',
                  eyelash: '속눈썹',
                  waxing: '왁싱',
                  eyebrow_tattoo: '눈썹문신',
                  hair: '헤어'
                };
                return labels[category] || category;
              }
            },
            {
              title: '매장 수',
              dataIndex: 'count',
              key: 'count'
            },
            {
              title: '비율',
              dataIndex: 'percentage',
              key: 'percentage',
              render: (percentage: number) => `${percentage.toFixed(1)}%`
            }
          ]}
          pagination={false}
          rowKey="category"
        />
      </Card>

      {/* Recent Approvals */}
      <Card title="최근 승인 내역" style={{ marginTop: 16 }}>
        <Table
          dataSource={stats.recentApprovals}
          columns={[
            {
              title: '매장명',
              dataIndex: 'shopName',
              key: 'shopName'
            },
            {
              title: '처리',
              dataIndex: 'action',
              key: 'action',
              render: (action: string) => (
                <Tag color={action === 'approve' ? 'green' : 'red'}>
                  {action === 'approve' ? '승인' : '거절'}
                </Tag>
              )
            },
            {
              title: '관리자',
              dataIndex: 'adminName',
              key: 'adminName'
            },
            {
              title: '시간',
              dataIndex: 'timestamp',
              key: 'timestamp',
              render: (timestamp: string) => new Date(timestamp).toLocaleString('ko-KR')
            }
          ]}
          pagination={false}
          rowKey="id"
        />
      </Card>
    </div>
  );
}
```

### 4.2 Shop Approval List

```tsx
// src/components/admin/ShopApprovalList.tsx

import { useState } from 'react';
import { Table, Button, Tag, Space, Input, Select, DatePicker, Modal, Form, message } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useShopsForApproval, useProcessApproval } from '@/hooks/useShopApproval';
import type { ShopApprovalFilters, ShopForApproval } from '@/types/shop-approval.types';

const { RangePicker } = DatePicker;

export function ShopApprovalList() {
  const [filters, setFilters] = useState<ShopApprovalFilters>({
    page: 1,
    limit: 20
  });

  const [selectedShop, setSelectedShop] = useState<ShopForApproval | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading, error } = useShopsForApproval(filters);
  const processApproval = useProcessApproval();

  const handleApprove = async (shopId: string) => {
    setApprovalModalOpen(true);
    const shop = data?.shops.find(s => s.id === shopId);
    setSelectedShop(shop || null);
    form.setFieldsValue({ action: 'approve', autoActivate: true, notifyOwner: true });
  };

  const handleReject = async (shopId: string) => {
    setApprovalModalOpen(true);
    const shop = data?.shops.find(s => s.id === shopId);
    setSelectedShop(shop || null);
    form.setFieldsValue({ action: 'reject', autoActivate: false, notifyOwner: true });
  };

  const handleSubmitApproval = async () => {
    if (!selectedShop) return;

    try {
      const values = await form.validateFields();

      await processApproval.mutateAsync({
        shopId: selectedShop.id,
        request: {
          action: values.action,
          reason: values.reason,
          adminNotes: values.adminNotes,
          verificationNotes: values.verificationNotes,
          notifyOwner: values.notifyOwner,
          autoActivate: values.autoActivate
        }
      });

      message.success(`매장이 ${values.action === 'approve' ? '승인' : '거절'}되었습니다.`);
      setApprovalModalOpen(false);
      setSelectedShop(null);
      form.resetFields();
    } catch (error) {
      message.error('처리 중 오류가 발생했습니다.');
    }
  };

  const columns = [
    {
      title: '매장명',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ShopForApproval) => (
        <div>
          <div>{name}</div>
          {record.isUrgent && <Tag color="red">긴급</Tag>}
        </div>
      )
    },
    {
      title: '카테고리',
      dataIndex: 'mainCategory',
      key: 'mainCategory',
      render: (category: string) => {
        const labels: Record<string, string> = {
          nail: '네일',
          eyelash: '속눈썹',
          waxing: '왁싱',
          eyebrow_tattoo: '눈썹문신',
          hair: '헤어'
        };
        return labels[category] || category;
      }
    },
    {
      title: '상태',
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: 'orange',
          verified: 'green',
          rejected: 'red'
        };
        const labels: Record<string, string> = {
          pending: '대기',
          verified: '승인',
          rejected: '거절'
        };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    },
    {
      title: '서류 완성도',
      key: 'documents',
      render: (record: ShopForApproval) => (
        <Tag color={record.hasCompleteDocuments ? 'green' : 'orange'}>
          {record.hasCompleteDocuments ? '완료' : '미완료'}
        </Tag>
      )
    },
    {
      title: '제출일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('ko-KR')
    },
    {
      title: '대기일',
      dataIndex: 'daysSinceSubmission',
      key: 'daysSinceSubmission',
      render: (days: number) => `${days}일`
    },
    {
      title: '작업',
      key: 'actions',
      render: (record: ShopForApproval) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record.id)}
            disabled={record.verificationStatus !== 'pending'}
          >
            승인
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={() => handleReject(record.id)}
            disabled={record.verificationStatus !== 'pending'}
          >
            거절
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="shop-approval-list">
      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="매장명, 주소 검색"
          prefix={<SearchOutlined />}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
        />
        <Select
          placeholder="승인 상태"
          style={{ width: 150 }}
          onChange={(value) => setFilters({ ...filters, verificationStatus: value, page: 1 })}
          allowClear
        >
          <Select.Option value="pending">대기</Select.Option>
          <Select.Option value="verified">승인</Select.Option>
          <Select.Option value="rejected">거절</Select.Option>
        </Select>
        <Select
          placeholder="카테고리"
          style={{ width: 150 }}
          onChange={(value) => setFilters({ ...filters, category: value, page: 1 })}
          allowClear
        >
          <Select.Option value="nail">네일</Select.Option>
          <Select.Option value="eyelash">속눈썹</Select.Option>
          <Select.Option value="waxing">왁싱</Select.Option>
          <Select.Option value="eyebrow_tattoo">눈썹문신</Select.Option>
          <Select.Option value="hair">헤어</Select.Option>
        </Select>
      </Space>

      {/* Table */}
      <Table
        dataSource={data?.shops || []}
        columns={columns}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: filters.page,
          pageSize: filters.limit,
          total: data?.totalCount || 0,
          onChange: (page, pageSize) => setFilters({ ...filters, page, limit: pageSize })
        }}
      />

      {/* Approval Modal */}
      <Modal
        title={`매장 ${form.getFieldValue('action') === 'approve' ? '승인' : '거절'}`}
        open={approvalModalOpen}
        onOk={handleSubmitApproval}
        onCancel={() => {
          setApprovalModalOpen(false);
          setSelectedShop(null);
          form.resetFields();
        }}
        confirmLoading={processApproval.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="action" label="처리 방식" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="approve">승인</Select.Option>
              <Select.Option value="reject">거절</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="reason" label="사유">
            <Input.TextArea rows={3} placeholder="승인/거절 사유를 입력하세요" />
          </Form.Item>

          <Form.Item name="adminNotes" label="관리자 메모">
            <Input.TextArea rows={2} placeholder="내부 메모 (선택)" />
          </Form.Item>

          <Form.Item name="verificationNotes" label="검증 노트">
            <Input.TextArea rows={2} placeholder="검증 내용 (선택)" />
          </Form.Item>

          <Form.Item name="notifyOwner" valuePropName="checked">
            <input type="checkbox" /> 매장 소유자에게 알림 전송
          </Form.Item>

          <Form.Item name="autoActivate" valuePropName="checked">
            <input type="checkbox" /> 승인 시 자동으로 활성화
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

---

## 🐛 Fixing Your Current Errors

Based on your error logs, the issue is that React Query is receiving `undefined`. Here's the fix:

### Problem: Query data cannot be undefined

```tsx
// ❌ WRONG - This causes undefined error
const { data } = useQuery({
  queryKey: ['shops', 'approval'],
  queryFn: async () => {
    const response = await api.get('/admin/shops/approval');
    // If response is { success: true, data: {...} }
    // But you return nothing or wrong field
  }
});

// ✅ CORRECT - Properly unwrap the data
const { data } = useQuery({
  queryKey: ['shops', 'approval'],
  queryFn: async () => {
    const response = await api.get('/admin/shops/approval');
    return response.data.data; // Unwrap: response -> response.data -> response.data.data
  }
});
```

### Updated Service with Proper Unwrapping

```typescript
// Make sure your API service properly unwraps data
export class ShopApprovalService {
  static async getShopsForApproval(filters: ShopApprovalFilters = {}) {
    const params = new URLSearchParams();
    // ... build params ...

    const response = await api.get(`/admin/shops/approval?${params}`);

    // Backend returns: { success: true, data: {...} }
    // So we need: response.data.data
    return response.data.data;
  }

  static async getStatistics() {
    const response = await api.get('/admin/shops/approval/statistics');
    return response.data.data; // Unwrap properly
  }
}
```

---

## 📋 Complete Example Page

```tsx
// src/pages/admin/ShopApprovalPage.tsx

import { Tabs } from 'antd';
import { ShopApprovalStatistics } from '@/components/admin/ShopApprovalStatistics';
import { ShopApprovalList } from '@/components/admin/ShopApprovalList';

export default function ShopApprovalPage() {
  return (
    <div className="shop-approval-page">
      <h1>매장 승인 관리</h1>

      <Tabs
        defaultActiveKey="list"
        items={[
          {
            key: 'list',
            label: '승인 대기 목록',
            children: <ShopApprovalList />
          },
          {
            key: 'statistics',
            label: '통계',
            children: <ShopApprovalStatistics />
          }
        ]}
      />
    </div>
  );
}
```

---

## ✅ Quick Fix Checklist

1. **Ensure API responses are unwrapped correctly**
   ```typescript
   return response.data.data; // Not just response.data
   ```

2. **Add proper error handling**
   ```typescript
   if (!data) return <div>데이터가 없습니다</div>;
   ```

3. **Use Form.useForm() correctly**
   ```typescript
   const [form] = Form.useForm(); // At component top level
   <Form form={form}>...</Form> // Pass to Form component
   ```

4. **Check axios interceptor isn't double-unwrapping**
   ```typescript
   // If you have an interceptor that unwraps once:
   api.interceptors.response.use(response => response.data);

   // Then in service, only unwrap once more:
   return response.data; // Not response.data.data
   ```

---

## 🎯 Summary

Your frontend errors are caused by:
1. ✅ **Fixed**: Data unwrapping - use `response.data.data`
2. ✅ **Fixed**: Form not connected - use `form={form}` prop
3. ✅ **Added**: Proper error handling for undefined data
4. ✅ **Added**: Complete TypeScript interfaces
5. ✅ **Added**: React Query hooks with proper setup
6. ✅ **Added**: Full component examples

The backend is working (200 OK responses). Just fix the frontend data unwrapping!
