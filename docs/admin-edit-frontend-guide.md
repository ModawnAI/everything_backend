# Admin Edit Forms - Frontend Implementation Guide

## 🎯 Overview

This guide covers implementing comprehensive edit functionality for the admin dashboard, including users, services, and reservations with advanced validation, error handling, and user experience features.

## 📡 API Endpoints Summary

### Core Edit Endpoints
1. **User Edit**: `PUT /api/admin/edit/users/{userId}`
2. **Service Edit**: `PUT /api/admin/edit/services/{serviceId}`
3. **Reservation Edit**: `PUT /api/admin/edit/reservations/{reservationId}`
4. **Bulk Edit**: `POST /api/admin/edit/bulk`
5. **Bulk Status**: `GET /api/admin/edit/bulk/{operationId}/status`

## 🏗️ Frontend Architecture

### 1. Form State Management

```typescript
// hooks/useEditForm.ts
interface EditFormState<T> {
  data: T;
  originalData: T;
  isDirty: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  hasChanges: boolean;
  validationState: 'idle' | 'validating' | 'valid' | 'invalid';
}

export const useEditForm = <T extends Record<string, any>>(
  initialData: T,
  validationSchema: any,
  onSubmit: (data: T, changes: Partial<T>) => Promise<void>
) => {
  const [state, setState] = useState<EditFormState<T>>({
    data: initialData,
    originalData: initialData,
    isDirty: false,
    isSubmitting: false,
    errors: {},
    hasChanges: false,
    validationState: 'idle'
  });

  // Calculate changes between current and original data
  const getChanges = useCallback(() => {
    const changes: Partial<T> = {};
    for (const key in state.data) {
      if (state.data[key] !== state.originalData[key]) {
        changes[key] = state.data[key];
      }
    }
    return changes;
  }, [state.data, state.originalData]);

  // Real-time validation
  const validate = useCallback(async (data: T) => {
    setState(prev => ({ ...prev, validationState: 'validating' }));

    try {
      await validationSchema.validate(data, { abortEarly: false });
      setState(prev => ({
        ...prev,
        errors: {},
        validationState: 'valid'
      }));
      return true;
    } catch (error) {
      const errors: Record<string, string> = {};
      if (error.inner) {
        error.inner.forEach((err: any) => {
          errors[err.path] = err.message;
        });
      }
      setState(prev => ({
        ...prev,
        errors,
        validationState: 'invalid'
      }));
      return false;
    }
  }, [validationSchema]);

  // Update field value
  const updateField = useCallback((field: keyof T, value: any) => {
    setState(prev => {
      const newData = { ...prev.data, [field]: value };
      const hasChanges = JSON.stringify(newData) !== JSON.stringify(prev.originalData);

      return {
        ...prev,
        data: newData,
        isDirty: true,
        hasChanges
      };
    });
  }, []);

  // Submit form
  const submit = useCallback(async (editReason: string) => {
    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const isValid = await validate(state.data);
      if (!isValid) {
        throw new Error('Validation failed');
      }

      const changes = getChanges();
      if (Object.keys(changes).length === 0) {
        throw new Error('No changes detected');
      }

      await onSubmit({ ...state.data, edit_reason: editReason }, changes);

      setState(prev => ({
        ...prev,
        originalData: prev.data,
        hasChanges: false,
        isDirty: false,
        isSubmitting: false
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isSubmitting: false }));
      throw error;
    }
  }, [state.data, validate, getChanges, onSubmit]);

  // Reset form
  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      data: prev.originalData,
      isDirty: false,
      hasChanges: false,
      errors: {},
      validationState: 'idle'
    }));
  }, []);

  return {
    ...state,
    getChanges,
    updateField,
    submit,
    reset,
    validate
  };
};
```

### 2. User Edit Form Implementation

```typescript
// components/forms/UserEditForm.tsx
import { useEditForm } from '@/hooks/useEditForm';
import { userEditValidationSchema } from '@/schemas/validation';

interface UserEditFormProps {
  user: User;
  onSuccess?: (updatedUser: User) => void;
  onCancel?: () => void;
}

const UserEditForm: React.FC<UserEditFormProps> = ({
  user,
  onSuccess,
  onCancel
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editReason, setEditReason] = useState('');

  const {
    data,
    originalData,
    errors,
    hasChanges,
    isSubmitting,
    validationState,
    updateField,
    submit,
    reset,
    getChanges
  } = useEditForm(
    user,
    userEditValidationSchema,
    async (userData, changes) => {
      const response = await fetch(`/api/admin/edit/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update user');
      }

      const result = await response.json();
      onSuccess?.(result.data.user);
    }
  );

  const handleSubmit = async () => {
    if (!editReason.trim()) {
      toast.error('수정 사유를 입력해주세요.');
      return;
    }

    try {
      await submit(editReason);
      toast.success('사용자 정보가 성공적으로 수정되었습니다.');
      setShowConfirmDialog(false);
      setEditReason('');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const changes = getChanges();
  const hasSignificantChanges = Object.keys(changes).some(key =>
    ['user_status', 'user_role', 'is_influencer'].includes(key)
  );

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">사용자 정보 수정</h2>
          <p className="text-sm text-gray-600">
            {user.name} ({user.email})의 정보를 수정합니다.
          </p>
        </div>

        {hasChanges && (
          <div className="flex items-center space-x-2">
            <AlertIcon className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-600">
              {Object.keys(changes).length}개 필드가 변경되었습니다
            </span>
          </div>
        )}
      </div>

      {/* Changes Preview */}
      {hasChanges && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <h3 className="text-sm font-medium text-blue-900">변경 사항 미리보기</h3>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(changes).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-blue-700 font-medium">
                  {getFieldLabel(key)}:
                </span>
                <span className="text-blue-900">
                  {formatValue(originalData[key])} → {formatValue(value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <form className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">기본 정보</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="이름"
              value={data.name}
              onChange={(value) => updateField('name', value)}
              error={errors.name}
              required
              placeholder="사용자 실명"
            />

            <FormField
              label="닉네임"
              value={data.nickname || ''}
              onChange={(value) => updateField('nickname', value)}
              error={errors.nickname}
              placeholder="표시될 닉네임"
            />

            <FormField
              label="이메일"
              type="email"
              value={data.email || ''}
              onChange={(value) => updateField('email', value)}
              error={errors.email}
              placeholder="example@domain.com"
            />

            <FormField
              label="전화번호"
              value={data.phone_number || ''}
              onChange={(value) => updateField('phone_number', value)}
              error={errors.phone_number}
              placeholder="+82-10-1234-5678"
              mask="+82-##-####-####"
            />

            <FormSelect
              label="성별"
              value={data.gender || ''}
              onChange={(value) => updateField('gender', value)}
              error={errors.gender}
              options={[
                { value: '', label: '선택 안함' },
                { value: 'male', label: '남성' },
                { value: 'female', label: '여성' },
                { value: 'other', label: '기타' },
                { value: 'prefer_not_to_say', label: '답변하지 않음' }
              ]}
            />

            <FormField
              label="생년월일"
              type="date"
              value={data.birth_date || ''}
              onChange={(value) => updateField('birth_date', value)}
              error={errors.birth_date}
              max={new Date().toISOString().split('T')[0]}
            />
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">계정 상태</h3>
            {hasSignificantChanges && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ 중요한 권한 변경이 감지되었습니다. 신중히 검토해주세요.
              </div>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              label="사용자 상태"
              value={data.user_status}
              onChange={(value) => updateField('user_status', value)}
              error={errors.user_status}
              options={[
                { value: 'active', label: '활성' },
                { value: 'inactive', label: '비활성' },
                { value: 'suspended', label: '정지' },
                { value: 'deleted', label: '삭제' }
              ]}
              required
            />

            <FormSelect
              label="사용자 역할"
              value={data.user_role}
              onChange={(value) => updateField('user_role', value)}
              error={errors.user_role}
              options={[
                { value: 'user', label: '일반 사용자' },
                { value: 'shop_owner', label: '샵 운영자' },
                { value: 'admin', label: '관리자' },
                { value: 'influencer', label: '인플루언서' }
              ]}
              required
            />

            <FormCheckbox
              label="인플루언서"
              checked={data.is_influencer}
              onChange={(checked) => updateField('is_influencer', checked)}
              description="인플루언서 특별 혜택 적용"
            />

            <FormCheckbox
              label="마케팅 수신 동의"
              checked={data.marketing_consent}
              onChange={(checked) => updateField('marketing_consent', checked)}
              description="마케팅 메시지 수신 동의"
            />
          </CardContent>
        </Card>

        {/* Points Management */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">포인트 관리</h3>
            <p className="text-sm text-gray-600">
              포인트 변경 시 자동으로 거래 내역이 생성됩니다.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="총 포인트"
              type="number"
              value={data.total_points}
              onChange={(value) => updateField('total_points', parseInt(value) || 0)}
              error={errors.total_points}
              min={0}
              step={100}
            />

            <FormField
              label="사용 가능 포인트"
              type="number"
              value={data.available_points}
              onChange={(value) => updateField('available_points', parseInt(value) || 0)}
              error={errors.available_points}
              min={0}
              step={100}
            />

            {/* Point Change Calculator */}
            {(data.total_points !== originalData.total_points ||
              data.available_points !== originalData.available_points) && (
              <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">포인트 변경 내역</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>총 포인트 변경:</span>
                    <span className={data.total_points > originalData.total_points ? 'text-green-600' : 'text-red-600'}>
                      {data.total_points > originalData.total_points ? '+' : ''}
                      {data.total_points - originalData.total_points}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>사용 가능 포인트 변경:</span>
                    <span className={data.available_points > originalData.available_points ? 'text-green-600' : 'text-red-600'}>
                      {data.available_points > originalData.available_points ? '+' : ''}
                      {data.available_points - originalData.available_points}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={reset} disabled={!hasChanges}>
              <RotateCounterClockwiseIcon className="w-4 h-4 mr-2" />
              초기화
            </Button>

            {validationState === 'validating' && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Spinner className="w-4 h-4" />
                <span>검증 중...</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={onCancel}>
              취소
            </Button>

            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={!hasChanges || validationState === 'invalid' || isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : '변경 사항 저장'}
            </Button>
          </div>
        </div>
      </form>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="사용자 정보 수정 확인"
        description={`${Object.keys(changes).length}개 필드를 수정하시겠습니까?`}
        onConfirm={handleSubmit}
        confirmText="수정"
        dangerous={hasSignificantChanges}
      >
        <div className="space-y-4">
          {/* Changes Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">변경 내용 요약</h4>
            <div className="space-y-1 text-sm">
              {Object.entries(changes).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span>{getFieldLabel(key)}:</span>
                  <span className="font-medium">
                    {formatValue(originalData[key])} → {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Reason */}
          <div>
            <label className="block text-sm font-medium mb-2">
              수정 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="사용자 정보 수정 사유를 입력해주세요..."
              className="w-full p-3 border rounded-lg resize-none"
              rows={3}
              required
            />
          </div>

          {/* Notification Options */}
          <div className="space-y-2">
            <FormCheckbox
              label="사용자에게 변경 알림 발송"
              checked={true}
              description="사용자에게 계정 정보 변경을 알려드립니다."
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
};
```

### 3. Service Edit Form Implementation

```typescript
// components/forms/ServiceEditForm.tsx
const ServiceEditForm: React.FC<ServiceEditFormProps> = ({
  service,
  onSuccess,
  onCancel
}) => {
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [impactData, setImpactData] = useState(null);

  const {
    data,
    errors,
    hasChanges,
    isSubmitting,
    updateField,
    submit,
    reset,
    getChanges
  } = useEditForm(
    service,
    serviceEditValidationSchema,
    async (serviceData, changes) => {
      // Analyze impact if significant changes
      if (shouldAnalyzeImpact(changes)) {
        const impact = await analyzeServiceImpact(service.id, changes);
        setImpactData(impact);
        setShowImpactAnalysis(true);
        return;
      }

      await updateService(serviceData);
    }
  );

  const analyzeServiceImpact = async (serviceId: string, changes: any) => {
    const response = await fetch(`/api/admin/services/${serviceId}/impact-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ changes })
    });

    return response.json();
  };

  const updateService = async (serviceData: any) => {
    const response = await fetch(`/api/admin/edit/services/${service.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(serviceData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update service');
    }

    const result = await response.json();
    onSuccess?.(result.data.service);
  };

  const shouldAnalyzeImpact = (changes: any) => {
    const significantFields = ['price_min', 'price_max', 'is_available', 'duration_minutes'];
    return Object.keys(changes).some(key => significantFields.includes(key));
  };

  return (
    <div className="space-y-6">
      {/* Service Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">서비스 정보 수정</h2>
          <p className="text-sm text-gray-600">
            {service.name} - {service.shop_name}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <StatusBadge status={service.is_available ? 'active' : 'inactive'} />
          <CategoryBadge category={service.category} />
        </div>
      </div>

      <form className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">기본 정보</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label="서비스명"
              value={data.name}
              onChange={(value) => updateField('name', value)}
              error={errors.name}
              required
              placeholder="서비스명을 입력하세요"
            />

            <FormTextarea
              label="서비스 설명"
              value={data.description || ''}
              onChange={(value) => updateField('description', value)}
              error={errors.description}
              placeholder="서비스에 대한 상세 설명을 입력하세요"
              rows={3}
            />

            <FormSelect
              label="카테고리"
              value={data.category}
              onChange={(value) => updateField('category', value)}
              error={errors.category}
              options={[
                { value: 'nail', label: '네일' },
                { value: 'eyelash', label: '속눈썹' },
                { value: 'waxing', label: '왁싱' },
                { value: 'eyebrow_tattoo', label: '눈썹 문신' },
                { value: 'hair', label: '헤어' }
              ]}
              required
            />
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">가격 정보</h3>
            {(data.price_min !== service.price_min || data.price_max !== service.price_max) && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ 가격 변경은 기존 예약에 영향을 줄 수 있습니다.
              </div>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="최소 가격"
              type="number"
              value={data.price_min || ''}
              onChange={(value) => updateField('price_min', parseInt(value) || 0)}
              error={errors.price_min}
              min={0}
              step={1000}
              suffix="원"
            />

            <FormField
              label="최대 가격"
              type="number"
              value={data.price_max || ''}
              onChange={(value) => updateField('price_max', parseInt(value) || 0)}
              error={errors.price_max}
              min={data.price_min || 0}
              step={1000}
              suffix="원"
            />

            {/* Deposit Settings - Mutually Exclusive */}
            <div className="col-span-2">
              <h4 className="text-sm font-medium mb-3">예약금 설정</h4>
              <div className="space-y-3">
                <FormRadioGroup
                  value={
                    data.deposit_amount ? 'fixed' :
                    data.deposit_percentage ? 'percentage' : 'none'
                  }
                  onChange={(value) => {
                    if (value === 'fixed') {
                      updateField('deposit_percentage', null);
                    } else if (value === 'percentage') {
                      updateField('deposit_amount', null);
                    } else {
                      updateField('deposit_amount', null);
                      updateField('deposit_percentage', null);
                    }
                  }}
                  options={[
                    { value: 'none', label: '예약금 없음' },
                    { value: 'fixed', label: '고정 금액' },
                    { value: 'percentage', label: '비율 (%)' }
                  ]}
                />

                {data.deposit_amount && (
                  <FormField
                    label="예약금 (고정)"
                    type="number"
                    value={data.deposit_amount}
                    onChange={(value) => updateField('deposit_amount', parseInt(value) || 0)}
                    min={0}
                    step={1000}
                    suffix="원"
                  />
                )}

                {data.deposit_percentage && (
                  <FormField
                    label="예약금 (%)"
                    type="number"
                    value={data.deposit_percentage}
                    onChange={(value) => updateField('deposit_percentage', parseFloat(value) || 0)}
                    min={0}
                    max={100}
                    step={5}
                    suffix="%"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Settings */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">서비스 설정</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="소요 시간"
              type="number"
              value={data.duration_minutes || ''}
              onChange={(value) => updateField('duration_minutes', parseInt(value) || 0)}
              error={errors.duration_minutes}
              min={1}
              max={480}
              step={15}
              suffix="분"
            />

            <FormField
              label="표시 순서"
              type="number"
              value={data.display_order || 0}
              onChange={(value) => updateField('display_order', parseInt(value) || 0)}
              error={errors.display_order}
              min={0}
              max={999}
              description="낮은 숫자일수록 먼저 표시됩니다"
            />

            <FormField
              label="사전 예약 가능 일수"
              type="number"
              value={data.booking_advance_days}
              onChange={(value) => updateField('booking_advance_days', parseInt(value) || 1)}
              error={errors.booking_advance_days}
              min={1}
              max={365}
              suffix="일"
            />

            <FormField
              label="취소 가능 시간"
              type="number"
              value={data.cancellation_hours}
              onChange={(value) => updateField('cancellation_hours', parseInt(value) || 1)}
              error={errors.cancellation_hours}
              min={1}
              max={168}
              suffix="시간"
            />

            <div className="col-span-2">
              <FormCheckbox
                label="서비스 활성화"
                checked={data.is_available}
                onChange={(checked) => updateField('is_available', checked)}
                description="비활성화 시 새로운 예약을 받지 않습니다"
              />
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Impact Analysis Dialog */}
      <ImpactAnalysisDialog
        open={showImpactAnalysis}
        onOpenChange={setShowImpactAnalysis}
        impactData={impactData}
        changes={getChanges()}
        onConfirm={async (editReason: string) => {
          await updateService({ ...data, edit_reason: editReason });
          setShowImpactAnalysis(false);
        }}
      />
    </div>
  );
};
```

### 4. Reservation Edit Form Implementation

```typescript
// components/forms/ReservationEditForm.tsx
const ReservationEditForm: React.FC<ReservationEditFormProps> = ({
  reservation,
  onSuccess,
  onCancel
}) => {
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  const {
    data,
    errors,
    hasChanges,
    isSubmitting,
    updateField,
    submit,
    reset,
    getChanges
  } = useEditForm(
    reservation,
    reservationEditValidationSchema,
    async (reservationData, changes) => {
      // Check for conflicts if date/time changed
      if (changes.reservation_date || changes.reservation_time) {
        const conflicts = await checkReservationConflicts(
          reservation.shop_id,
          data.reservation_date,
          data.reservation_time,
          reservation.id
        );

        if (conflicts.length > 0) {
          setConflictData(conflicts);
          setShowConflictWarning(true);
          return;
        }
      }

      await updateReservation(reservationData);
    }
  );

  const checkReservationConflicts = async (shopId: string, date: string, time: string, excludeId: string) => {
    const response = await fetch('/api/admin/reservations/check-conflicts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        shop_id: shopId,
        reservation_date: date,
        reservation_time: time,
        exclude_reservation_id: excludeId
      })
    });

    const result = await response.json();
    return result.data?.conflicts || [];
  };

  const updateReservation = async (reservationData: any) => {
    const response = await fetch(`/api/admin/edit/reservations/${reservation.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(reservationData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update reservation');
    }

    const result = await response.json();
    onSuccess?.(result.data.reservation);
  };

  return (
    <div className="space-y-6">
      {/* Reservation Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">예약 정보 수정</h2>
          <p className="text-sm text-gray-600">
            예약 ID: {reservation.id.slice(-8)} | {reservation.customer.name}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <ReservationStatusBadge status={reservation.status} />
          <PaymentStatusBadge status={reservation.payment_status} />
        </div>
      </div>

      <form className="space-y-6">
        {/* Date & Time */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">예약 일시</h3>
            {(data.reservation_date !== reservation.reservation_date ||
              data.reservation_time !== reservation.reservation_time) && (
              <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                💡 일시 변경 시 충돌 여부를 자동으로 확인합니다.
              </div>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="예약 날짜"
              type="date"
              value={data.reservation_date}
              onChange={(value) => updateField('reservation_date', value)}
              error={errors.reservation_date}
              min={new Date().toISOString().split('T')[0]}
              required
            />

            <FormField
              label="예약 시간"
              type="time"
              value={data.reservation_time}
              onChange={(value) => updateField('reservation_time', value)}
              error={errors.reservation_time}
              step="1800" // 30-minute intervals
              required
            />
          </CardContent>
        </Card>

        {/* Status Management */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">상태 관리</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSelect
              label="예약 상태"
              value={data.status}
              onChange={(value) => updateField('status', value)}
              error={errors.status}
              options={[
                { value: 'requested', label: '요청됨' },
                { value: 'confirmed', label: '확정됨' },
                { value: 'completed', label: '완료됨' },
                { value: 'cancelled_by_user', label: '고객 취소' },
                { value: 'cancelled_by_shop', label: '샵 취소' },
                { value: 'no_show', label: '노쇼' }
              ]}
              required
            />

            {/* Conditional fields based on status */}
            {(data.status === 'cancelled_by_user' || data.status === 'cancelled_by_shop') && (
              <FormTextarea
                label="취소 사유"
                value={data.cancellation_reason || ''}
                onChange={(value) => updateField('cancellation_reason', value)}
                placeholder="취소 사유를 입력하세요"
                required
                rows={3}
              />
            )}

            {data.status === 'no_show' && (
              <FormTextarea
                label="노쇼 사유"
                value={data.no_show_reason || ''}
                onChange={(value) => updateField('no_show_reason', value)}
                placeholder="노쇼 사유를 입력하세요"
                required
                rows={3}
              />
            )}

            <FormTextarea
              label="특별 요청사항"
              value={data.special_requests || ''}
              onChange={(value) => updateField('special_requests', value)}
              placeholder="고객의 특별 요청사항"
              rows={2}
            />
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">결제 정보</h3>
            <p className="text-sm text-gray-600">
              금액 변경 시 결제 시스템과 자동으로 동기화됩니다.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="총 금액"
              type="number"
              value={data.total_amount}
              onChange={(value) => updateField('total_amount', parseInt(value) || 0)}
              error={errors.total_amount}
              min={0}
              step={1000}
              suffix="원"
            />

            <FormField
              label="예약금"
              type="number"
              value={data.deposit_amount}
              onChange={(value) => updateField('deposit_amount', parseInt(value) || 0)}
              error={errors.deposit_amount}
              min={0}
              max={data.total_amount}
              step={1000}
              suffix="원"
            />

            <FormField
              label="사용 포인트"
              type="number"
              value={data.points_used}
              onChange={(value) => updateField('points_used', parseInt(value) || 0)}
              error={errors.points_used}
              min={0}
              step={100}
              suffix="P"
            />

            <FormField
              label="적립 포인트"
              type="number"
              value={data.points_earned}
              onChange={(value) => updateField('points_earned', parseInt(value) || 0)}
              error={errors.points_earned}
              min={0}
              step={100}
              suffix="P"
            />

            {/* Payment Summary */}
            <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">결제 요약</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>총 금액:</span>
                  <span className="font-medium">₩{data.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>예약금:</span>
                  <span>₩{data.deposit_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>사용 포인트:</span>
                  <span className="text-red-600">-{data.points_used.toLocaleString()}P</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">잔금:</span>
                  <span className="font-medium">
                    ₩{(data.total_amount - data.deposit_amount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Conflict Warning Dialog */}
      <ConflictWarningDialog
        open={showConflictWarning}
        onOpenChange={setShowConflictWarning}
        conflicts={conflictData}
        onConfirm={async (editReason: string, force: boolean) => {
          await updateReservation({
            ...data,
            edit_reason: editReason,
            force_update: force
          });
          setShowConflictWarning(false);
        }}
      />
    </div>
  );
};
```

### 5. Bulk Edit Implementation

```typescript
// components/forms/BulkEditForm.tsx
const BulkEditForm: React.FC<BulkEditFormProps> = ({
  operationType,
  selectedIds,
  onSuccess,
  onCancel
}) => {
  const [changes, setChanges] = useState({});
  const [editReason, setEditReason] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [impactAnalysis, setImpactAnalysis] = useState(null);
  const [operationId, setOperationId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const performBulkEdit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/edit/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          operation_type: operationType,
          target_ids: selectedIds,
          changes,
          edit_reason: editReason,
          dry_run: dryRun,
          notify_targets: false,
          batch_size: 10
        })
      });

      const result = await response.json();

      if (dryRun) {
        setImpactAnalysis(result.data);
        setDryRun(false);
      } else {
        setOperationId(result.data.operation_id);
        // Start polling for progress
        pollProgress(result.data.operation_id);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pollProgress = async (opId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/edit/bulk/${opId}/status`);
        const result = await response.json();
        const status = result.data;

        if (status.status === 'completed') {
          clearInterval(interval);
          onSuccess?.(status);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          toast.error('대량 편집 작업이 실패했습니다.');
        }
      } catch (error) {
        clearInterval(interval);
        toast.error('진행률 조회 중 오류가 발생했습니다.');
      }
    }, 2000);
  };

  const renderChangeFields = () => {
    switch (operationType) {
      case 'users':
        return (
          <div className="space-y-4">
            <FormSelect
              label="사용자 상태"
              value={changes.user_status || ''}
              onChange={(value) => setChanges(prev => ({ ...prev, user_status: value }))}
              options={[
                { value: '', label: '변경하지 않음' },
                { value: 'active', label: '활성' },
                { value: 'inactive', label: '비활성' },
                { value: 'suspended', label: '정지' }
              ]}
            />

            <FormCheckbox
              label="마케팅 수신 동의"
              checked={changes.marketing_consent || false}
              onChange={(checked) => setChanges(prev => ({ ...prev, marketing_consent: checked }))}
            />
          </div>
        );

      case 'services':
        return (
          <div className="space-y-4">
            <FormCheckbox
              label="서비스 활성화"
              checked={changes.is_available !== undefined ? changes.is_available : true}
              onChange={(checked) => setChanges(prev => ({ ...prev, is_available: checked }))}
            />
          </div>
        );

      case 'reservations':
        return (
          <div className="space-y-4">
            <FormSelect
              label="예약 상태"
              value={changes.status || ''}
              onChange={(value) => setChanges(prev => ({ ...prev, status: value }))}
              options={[
                { value: '', label: '변경하지 않음' },
                { value: 'confirmed', label: '확정' },
                { value: 'cancelled_by_shop', label: '샵 취소' }
              ]}
            />

            {changes.status === 'cancelled_by_shop' && (
              <FormTextarea
                label="취소 사유"
                value={changes.cancellation_reason || ''}
                onChange={(value) => setChanges(prev => ({ ...prev, cancellation_reason: value }))}
                required
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">대량 편집</h2>
        <p className="text-sm text-gray-600">
          {selectedIds.length}개 항목을 일괄 수정합니다.
        </p>
      </div>

      {!impactAnalysis ? (
        <form className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">변경할 항목</h3>
            </CardHeader>
            <CardContent>
              {renderChangeFields()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">작업 설정</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormTextarea
                label="수정 사유"
                value={editReason}
                onChange={setEditReason}
                placeholder="대량 수정 사유를 입력하세요"
                required
                rows={3}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={onCancel}>
              취소
            </Button>
            <Button
              onClick={performBulkEdit}
              disabled={!editReason.trim() || Object.keys(changes).length === 0}
              loading={isSubmitting}
            >
              영향도 분석
            </Button>
          </div>
        </form>
      ) : (
        <ImpactAnalysisResult
          analysis={impactAnalysis}
          onConfirm={() => performBulkEdit()}
          onCancel={() => {
            setImpactAnalysis(null);
            setDryRun(true);
          }}
        />
      )}

      {operationId && (
        <BulkEditProgress operationId={operationId} />
      )}
    </div>
  );
};
```

## 🔄 Real-time Features

### 1. Live Validation
```typescript
// hooks/useLiveValidation.ts
export const useLiveValidation = (schema: any, debounceMs = 300) => {
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(
    debounce(async (data: any) => {
      setIsValidating(true);

      try {
        await schema.validate(data, { abortEarly: false });
        setErrors({});
      } catch (error) {
        const newErrors = {};
        error.inner?.forEach((err: any) => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      } finally {
        setIsValidating(false);
      }
    }, debounceMs),
    [schema]
  );

  return { errors, isValidating, validate };
};
```

### 2. Auto-save Functionality
```typescript
// hooks/useAutoSave.ts
export const useAutoSave = (
  data: any,
  saveFunction: (data: any) => Promise<void>,
  interval = 30000 // 30 seconds
) => {
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (data && Object.keys(data).length > 0) {
        setIsSaving(true);
        try {
          await saveFunction(data);
          setLastSaved(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, interval);

    return () => clearInterval(timer);
  }, [data, saveFunction, interval]);

  return { lastSaved, isSaving };
};
```

## 🛠️ Error Handling & User Experience

### 1. Form Error Display
```typescript
// components/FormField.tsx
const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  warning,
  help,
  required,
  children,
  ...props
}) => {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        {children || (
          <input
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              error
                ? 'border-red-300 focus:ring-red-500'
                : warning
                ? 'border-amber-300 focus:ring-amber-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
            {...props}
          />
        )}

        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <AlertCircleIcon className="w-5 h-5 text-red-500" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center mt-1">
          <AlertCircleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
          {error}
        </p>
      )}

      {warning && !error && (
        <p className="text-sm text-amber-600 flex items-center mt-1">
          <AlertTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
          {warning}
        </p>
      )}

      {help && !error && !warning && (
        <p className="text-sm text-gray-500">{help}</p>
      )}
    </div>
  );
};
```

### 2. Change Tracking & Confirmation
```typescript
// components/ChangeTracker.tsx
const ChangeTracker: React.FC<{ hasChanges: boolean; onDiscard: () => void }> = ({
  hasChanges,
  onDiscard
}) => {
  const router = useRouter();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handleRouteChange = (url: string) => {
      if (hasChanges) {
        const confirmed = confirm(
          '저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?'
        );
        if (!confirmed) {
          router.events.emit('routeChangeError');
          throw 'Route change aborted';
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [hasChanges, router]);

  if (!hasChanges) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 flex items-center space-x-4 z-50">
      <div className="flex items-center space-x-2">
        <AlertCircleIcon className="w-5 h-5 text-amber-500" />
        <span className="text-sm font-medium">저장하지 않은 변경사항이 있습니다</span>
      </div>

      <div className="flex space-x-2">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          변경사항 취소
        </Button>
        <Button size="sm">
          저장
        </Button>
      </div>
    </div>
  );
};
```

## 🎯 Key Features Delivered:

1. **Comprehensive Edit Endpoints** - Full CRUD operations for users, services, and reservations
2. **Advanced Validation** - Real-time validation with detailed error messages
3. **Impact Analysis** - Automatic analysis of changes that affect existing data
4. **Conflict Resolution** - Smart conflict detection and resolution
5. **Bulk Operations** - Efficient batch editing with progress tracking
6. **Audit Logging** - Complete change history with reasons and admin tracking
7. **User Experience** - Intuitive forms with change tracking and confirmation
8. **Error Handling** - Comprehensive error handling and user feedback

## 🚀 Implementation Benefits:

- **Safety First** - Prevents accidental data loss with multiple confirmation layers
- **Efficiency** - Bulk operations for managing large datasets
- **Transparency** - Clear change tracking and impact analysis
- **Flexibility** - Handles complex business rules and edge cases
- **User-Friendly** - Intuitive interface with helpful guidance and warnings

This implementation provides administrators with powerful, safe, and efficient tools for managing users, services, and reservations while maintaining data integrity and providing excellent user experience.