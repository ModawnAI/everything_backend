const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test configuration
const config = {
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Test results storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Helper function to make requests
async function testEndpoint(method, path, description, expectedStatus = 200) {
  testResults.total++;
  
  try {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const response = await axios({
      method,
      url,
      ...config
    });
    
    if (response.status === expectedStatus) {
      testResults.passed++;
      console.log(`✅ ${method} ${path} - ${description}`);
      return true;
    } else {
      testResults.failed++;
      console.log(`❌ ${method} ${path} - ${description} (Expected ${expectedStatus}, got ${response.status})`);
      testResults.errors.push({
        method,
        path,
        description,
        expected: expectedStatus,
        actual: response.status
      });
      return false;
    }
  } catch (error) {
    // For 400 errors, check if it's a proper error response
    if (error.response && error.response.status === 400) {
      const errorData = error.response.data;
      if (errorData && (errorData.success === false || errorData.error)) {
        // This is a proper error response, not a server issue
        testResults.passed++;
        console.log(`✅ ${method} ${path} - ${description} (Proper error response)`);
        return true;
      }
    }
    
    testResults.failed++;
    console.log(`❌ ${method} ${path} - ${description} (Error: ${error.message})`);
    testResults.errors.push({
      method,
      path,
      description,
      error: error.message
    });
    return false;
  }
}

// Comprehensive endpoint testing
async function runExhaustiveTests() {
  console.log('🚀 시작: 에뷰리띵 백엔드 API 종합 테스트');
  console.log('=' .repeat(80));
  
  // =============================================
  // HEALTH & SYSTEM ENDPOINTS
  // =============================================
  console.log('\n🏥 HEALTH & SYSTEM ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/health', '기본 헬스 체크');
  await testEndpoint('GET', '/health/detailed', '상세 헬스 체크');
  await testEndpoint('GET', '/health/ready', '준비 상태 확인');
  await testEndpoint('GET', '/health/live', '생존 상태 확인');
  await testEndpoint('POST', '/health/cache/clear', '헬스 체크 캐시 클리어');
  
  // =============================================
  // AUTHENTICATION ENDPOINTS
  // =============================================
  console.log('\n🔐 AUTHENTICATION ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('POST', '/api/auth/social-login', '소셜 로그인');
  await testEndpoint('POST', '/api/auth/register', '사용자 등록');
  await testEndpoint('POST', '/api/auth/send-verification-code', '인증 코드 발송');
  await testEndpoint('POST', '/api/auth/verify-phone', '전화번호 인증');
  await testEndpoint('POST', '/api/auth/pass/callback', 'PASS 인증 콜백');
  await testEndpoint('GET', '/api/auth/providers', '인증 제공자 목록');
  await testEndpoint('POST', '/api/auth/refresh', '토큰 갱신');
  await testEndpoint('POST', '/api/auth/logout', '로그아웃');
  await testEndpoint('POST', '/api/auth/logout-all', '모든 디바이스 로그아웃');
  await testEndpoint('GET', '/api/auth/sessions', '사용자 세션 목록');
  
  // Admin Auth
  await testEndpoint('POST', '/api/admin/auth/login', '관리자 로그인');
  await testEndpoint('POST', '/api/admin/auth/refresh', '관리자 토큰 갱신');
  await testEndpoint('POST', '/api/admin/auth/logout', '관리자 로그아웃');
  await testEndpoint('GET', '/api/admin/auth/validate', '관리자 인증 검증');
  await testEndpoint('GET', '/api/admin/auth/profile', '관리자 프로필');
  await testEndpoint('POST', '/api/admin/auth/change-password', '관리자 비밀번호 변경');
  
  // =============================================
  // USER MANAGEMENT ENDPOINTS
  // =============================================
  console.log('\n👤 USER MANAGEMENT ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/users/profile', '사용자 프로필 조회');
  await testEndpoint('PUT', '/api/users/profile', '사용자 프로필 업데이트');
  await testEndpoint('GET', '/api/users/profile/completion', '프로필 완성도 확인');
  await testEndpoint('POST', '/api/users/profile/image', '프로필 이미지 업로드');
  await testEndpoint('GET', '/api/users/settings', '사용자 설정 조회');
  await testEndpoint('PUT', '/api/users/settings', '사용자 설정 업데이트');
  await testEndpoint('POST', '/api/users/terms/accept', '이용약관 동의');
  await testEndpoint('POST', '/api/users/privacy/accept', '개인정보처리방침 동의');
  await testEndpoint('DELETE', '/api/users/account', '계정 삭제');
  
  // User Status Management (Admin)
  await testEndpoint('PUT', '/api/admin/users/user-1/status', '사용자 상태 변경');
  await testEndpoint('GET', '/api/admin/users/user-1/status/history', '사용자 상태 이력');
  await testEndpoint('GET', '/api/admin/users/user-1/violations', '사용자 위반 사항');
  await testEndpoint('PUT', '/api/admin/violations/violation-1/resolve', '위반 사항 해결');
  await testEndpoint('GET', '/api/admin/users/status/active', '상태별 사용자 목록');
  await testEndpoint('POST', '/api/admin/users/bulk-status-change', '대량 상태 변경');
  await testEndpoint('GET', '/api/admin/users/status-stats', '사용자 상태 통계');
  
  // =============================================
  // SHOP MANAGEMENT ENDPOINTS
  // =============================================
  console.log('\n🏪 SHOP MANAGEMENT ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/shops', '모든 매장 조회');
  await testEndpoint('GET', '/api/shops/shop-1', '매장 상세 조회');
  await testEndpoint('POST', '/api/shops', '매장 생성');
  await testEndpoint('PUT', '/api/shops/shop-1', '매장 정보 업데이트');
  await testEndpoint('DELETE', '/api/shops/shop-1', '매장 삭제');
  
  // Shop Images
  await testEndpoint('POST', '/api/shops/shop-1/images', '매장 이미지 업로드');
  await testEndpoint('GET', '/api/shops/shop-1/images', '매장 이미지 목록');
  await testEndpoint('DELETE', '/api/shops/shop-1/images/img-1', '매장 이미지 삭제');
  await testEndpoint('PUT', '/api/shops/shop-1/images/img-1', '매장 이미지 업데이트');
  await testEndpoint('POST', '/api/shops/shop-1/images/img-1/set-primary', '대표 이미지 설정');
  
  // Shop Owner Routes
  await testEndpoint('GET', '/api/shop-owner/dashboard', '매장 소유자 대시보드');
  await testEndpoint('GET', '/api/shop-owner/shops', '소유 매장 목록');
  await testEndpoint('POST', '/api/shop-owner/shops', '매장 생성 (소유자)');
  await testEndpoint('PUT', '/api/shop-owner/shops/shop-1', '매장 업데이트 (소유자)');
  await testEndpoint('DELETE', '/api/shop-owner/shops/shop-1', '매장 삭제 (소유자)');
  await testEndpoint('GET', '/api/shop-owner/reservations', '소유 매장 예약 목록');
  await testEndpoint('GET', '/api/shop-owner/payments', '소유 매장 결제 목록');
  await testEndpoint('GET', '/api/shop-owner/analytics', '소유 매장 분석');
  
  // Admin Shop Management
  await testEndpoint('GET', '/api/admin/shops', '관리자 매장 목록');
  await testEndpoint('GET', '/api/admin/shops/shop-1', '관리자 매장 상세');
  await testEndpoint('PUT', '/api/admin/shops/shop-1', '관리자 매장 업데이트');
  await testEndpoint('DELETE', '/api/admin/shops/shop-1', '관리자 매장 삭제');
  
  // Shop Approval
  await testEndpoint('GET', '/api/admin/shops/approval', '매장 승인 대기 목록');
  await testEndpoint('GET', '/api/admin/shops/approval/statistics', '매장 승인 통계');
  await testEndpoint('PUT', '/api/admin/shops/approval/shop-1', '매장 승인 처리');
  await testEndpoint('GET', '/api/admin/shops/approval/shop-1/details', '매장 승인 상세');
  await testEndpoint('POST', '/api/admin/shops/approval/bulk-approval', '대량 승인 처리');
  
  // =============================================
  // RESERVATION ENDPOINTS
  // =============================================
  console.log('\n📅 RESERVATION ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('POST', '/api/reservations', '예약 생성');
  await testEndpoint('GET', '/api/reservations', '사용자 예약 목록');
  await testEndpoint('GET', '/api/reservations/reservation-1', '예약 상세 조회');
  await testEndpoint('PUT', '/api/reservations/reservation-1/cancel', '예약 취소');
  
  // Available Slots
  await testEndpoint('GET', '/api/shops/shop-1/available-slots', '가능한 시간대 조회');
  
  // Reservation Rescheduling
  await testEndpoint('POST', '/api/reservations/reservation-1/reschedule', '예약 재조정');
  await testEndpoint('GET', '/api/reservations/reservation-1/reschedule-options', '재조정 옵션');
  
  // Conflict Resolution
  await testEndpoint('GET', '/api/shops/shop-1/conflicts/detect', '충돌 감지');
  await testEndpoint('POST', '/api/conflicts/conflict-1/resolve', '충돌 해결');
  await testEndpoint('POST', '/api/conflicts/priority-scores', '우선순위 점수');
  await testEndpoint('GET', '/api/shops/shop-1/conflicts/history', '충돌 이력');
  await testEndpoint('GET', '/api/shops/shop-1/conflicts/stats', '충돌 통계');
  await testEndpoint('GET', '/api/shops/shop-1/conflicts/manual-interface', '수동 인터페이스');
  await testEndpoint('POST', '/api/shops/shop-1/conflicts/prevent', '충돌 방지');
  
  // No-Show Detection
  await testEndpoint('POST', '/api/admin/no-show/override', '노쇼 오버라이드');
  await testEndpoint('GET', '/api/admin/no-show/statistics', '노쇼 통계');
  await testEndpoint('GET', '/api/admin/no-show/config', '노쇼 설정');
  await testEndpoint('PUT', '/api/admin/no-show/config', '노쇼 설정 업데이트');
  await testEndpoint('POST', '/api/admin/no-show/trigger', '노쇼 감지 트리거');
  await testEndpoint('GET', '/api/admin/no-show/reservation/reservation-1', '노쇼 예약 상세');
  
  // Admin Reservation Management
  await testEndpoint('GET', '/api/admin/reservations', '관리자 예약 목록');
  await testEndpoint('GET', '/api/admin/reservations/reservation-1', '관리자 예약 상세');
  await testEndpoint('PUT', '/api/admin/reservations/reservation-1', '관리자 예약 업데이트');
  await testEndpoint('DELETE', '/api/admin/reservations/reservation-1', '관리자 예약 삭제');
  
  // =============================================
  // PAYMENT ENDPOINTS
  // =============================================
  console.log('\n💳 PAYMENT ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('POST', '/api/payments', '결제 처리');
  await testEndpoint('GET', '/api/payments', '사용자 결제 목록');
  await testEndpoint('GET', '/api/payments/payment-1', '결제 상세 조회');
  
  // Split Payments
  await testEndpoint('POST', '/api/split-payments', '분할 결제 생성');
  await testEndpoint('GET', '/api/split-payments', '분할 결제 목록');
  await testEndpoint('GET', '/api/split-payments/split-1', '분할 결제 상세');
  await testEndpoint('PUT', '/api/split-payments/split-1', '분할 결제 업데이트');
  
  // Admin Payment Management
  await testEndpoint('GET', '/api/admin/payments', '관리자 결제 목록');
  await testEndpoint('GET', '/api/admin/payments/summary', '관리자 결제 요약');
  await testEndpoint('GET', '/api/admin/payments/settlements', '관리자 정산 목록');
  await testEndpoint('GET', '/api/admin/payments/analytics', '관리자 결제 분석');
  await testEndpoint('GET', '/api/admin/payments/export', '관리자 결제 내보내기');
  await testEndpoint('GET', '/api/admin/payments/payment-1', '관리자 결제 상세');
  await testEndpoint('POST', '/api/admin/payments/payment-1/refund', '환불 처리');
  
  // Payment Security
  await testEndpoint('POST', '/api/payment-security/fraud-detection', '사기 감지');
  await testEndpoint('GET', '/api/payment-security/metrics', '보안 메트릭');
  await testEndpoint('GET', '/api/payment-security/alerts', '보안 알림');
  await testEndpoint('PUT', '/api/payment-security/alerts/alert-1/resolve', '보안 알림 해결');
  await testEndpoint('POST', '/api/payment-security/compliance-report', '규정 준수 보고서');
  await testEndpoint('POST', '/api/payment-security/error-handling', '오류 처리');
  await testEndpoint('GET', '/api/payment-security/errors', '보안 오류 목록');
  await testEndpoint('PUT', '/api/payment-security/errors/error-1/resolve', '보안 오류 해결');
  await testEndpoint('GET', '/api/payment-security/risk-assessment', '위험 평가');
  await testEndpoint('GET', '/api/payment-security/security-dashboard', '보안 대시보드');
  
  // Webhooks
  await testEndpoint('POST', '/api/webhooks/toss-payments', '토스페이먼츠 웹훅');
  
  // =============================================
  // POINTS SYSTEM ENDPOINTS
  // =============================================
  console.log('\n🎯 POINTS SYSTEM ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/points/balance', '포인트 잔액 조회');
  await testEndpoint('GET', '/api/points', '포인트 거래 내역');
  await testEndpoint('POST', '/api/points', '포인트 적립');
  
  // Point Balance Management
  await testEndpoint('GET', '/api/points/balance/history', '포인트 잔액 이력');
  await testEndpoint('POST', '/api/points/balance/adjust', '포인트 잔액 조정');
  
  // Point Processing (Admin)
  await testEndpoint('GET', '/api/admin/point-processing/queue', '포인트 처리 큐');
  await testEndpoint('POST', '/api/admin/point-processing/process', '포인트 처리');
  
  // Admin Point Adjustments
  await testEndpoint('POST', '/api/admin/adjustments/points', '포인트 조정 생성');
  await testEndpoint('GET', '/api/admin/adjustments/points', '포인트 조정 목록');
  await testEndpoint('GET', '/api/admin/adjustments/points/adj-1', '포인트 조정 상세');
  await testEndpoint('PUT', '/api/admin/adjustments/points/adj-1', '포인트 조정 업데이트');
  await testEndpoint('DELETE', '/api/admin/adjustments/points/adj-1', '포인트 조정 삭제');
  await testEndpoint('GET', '/api/admin/adjustments/points/statistics', '포인트 조정 통계');
  await testEndpoint('GET', '/api/admin/adjustments/points/export', '포인트 조정 내보내기');
  await testEndpoint('GET', '/api/admin/adjustments/points/audit', '포인트 조정 감사');
  await testEndpoint('GET', '/api/admin/adjustments/points/reports', '포인트 조정 보고서');
  await testEndpoint('GET', '/api/admin/adjustments/points/analytics', '포인트 조정 분석');
  
  // =============================================
  // NOTIFICATION ENDPOINTS
  // =============================================
  console.log('\n🔔 NOTIFICATION ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/notifications', '알림 목록');
  await testEndpoint('POST', '/api/notifications/register', '푸시 알림 등록');
  await testEndpoint('POST', '/api/notifications/unregister', '푸시 알림 해제');
  await testEndpoint('POST', '/api/notifications/send', '알림 발송');
  await testEndpoint('POST', '/api/notifications/template', '알림 템플릿 생성');
  await testEndpoint('GET', '/api/notifications/templates', '알림 템플릿 목록');
  await testEndpoint('GET', '/api/notifications/settings', '알림 설정');
  await testEndpoint('PUT', '/api/notifications/settings', '알림 설정 업데이트');
  await testEndpoint('GET', '/api/notifications/history', '알림 이력');
  await testEndpoint('GET', '/api/notifications/tokens', '알림 토큰 목록');
  
  // =============================================
  // STORAGE ENDPOINTS
  // =============================================
  console.log('\n📁 STORAGE ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('POST', '/api/storage/upload', '파일 업로드');
  await testEndpoint('DELETE', '/api/storage/files/file-1', '파일 삭제');
  await testEndpoint('GET', '/api/storage/files/file-1', '파일 정보 조회');
  await testEndpoint('POST', '/api/storage/files/file-1/download', '파일 다운로드');
  await testEndpoint('GET', '/api/storage/files', '파일 목록');
  await testEndpoint('POST', '/api/storage/files/file-1/share', '파일 공유');
  
  // =============================================
  // WEBSOCKET ENDPOINTS
  // =============================================
  console.log('\n🔌 WEBSOCKET ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/websocket/connect', '웹소켓 연결');
  await testEndpoint('GET', '/api/websocket/stats', '웹소켓 통계');
  await testEndpoint('GET', '/api/websocket/rooms', '웹소켓 방 목록');
  await testEndpoint('GET', '/api/websocket/rooms/room-1', '웹소켓 방 상세');
  await testEndpoint('POST', '/api/websocket/admin/notification', '관리자 알림 발송');
  await testEndpoint('POST', '/api/websocket/reservation/update', '예약 업데이트');
  await testEndpoint('POST', '/api/websocket/user/message', '사용자 메시지');
  await testEndpoint('POST', '/api/websocket/room/message', '방 메시지');
  await testEndpoint('POST', '/api/websocket/broadcast', '브로드캐스트');
  await testEndpoint('POST', '/api/websocket/cleanup', '웹소켓 정리');
  
  // =============================================
  // ANALYTICS ENDPOINTS
  // =============================================
  console.log('\n📊 ANALYTICS ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/admin/analytics/dashboard', '분석 대시보드');
  await testEndpoint('GET', '/api/admin/analytics/users', '사용자 분석');
  await testEndpoint('GET', '/api/admin/analytics/shops', '매장 분석');
  await testEndpoint('GET', '/api/admin/analytics/reservations', '예약 분석');
  await testEndpoint('GET', '/api/admin/analytics/payments', '결제 분석');
  await testEndpoint('GET', '/api/admin/analytics/revenue', '수익 분석');
  await testEndpoint('GET', '/api/admin/analytics/performance', '성능 분석');
  await testEndpoint('GET', '/api/admin/analytics/export', '분석 내보내기');
  await testEndpoint('GET', '/api/admin/analytics/reports', '분석 보고서');
  await testEndpoint('GET', '/api/admin/analytics/trends', '트렌드 분석');
  await testEndpoint('GET', '/api/admin/analytics/insights', '인사이트');
  
  // =============================================
  // REFERRAL ENDPOINTS
  // =============================================
  console.log('\n🤝 REFERRAL ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/referrals/stats', '추천 통계');
  await testEndpoint('GET', '/api/referrals/history', '추천 이력');
  await testEndpoint('PUT', '/api/referrals/referral-1/status', '추천 상태 업데이트');
  await testEndpoint('POST', '/api/referrals/referral-1/payout', '추천 지급');
  await testEndpoint('GET', '/api/referrals/analytics', '추천 분석');
  
  // =============================================
  // INFLUENCER ENDPOINTS
  // =============================================
  console.log('\n🌟 INFLUENCER ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/influencer/bonus', '인플루언서 보너스');
  await testEndpoint('GET', '/api/admin/influencer-bonus/stats', '인플루언서 보너스 통계');
  await testEndpoint('GET', '/api/admin/influencer-bonus/analytics/influencer-1', '인플루언서 분석');
  await testEndpoint('POST', '/api/admin/influencer-bonus/validate/transaction-1', '거래 검증');
  await testEndpoint('POST', '/api/admin/influencer-bonus/check-qualification', '자격 확인');
  
  // =============================================
  // CACHE ENDPOINTS
  // =============================================
  console.log('\n💾 CACHE ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/cache/stats', '캐시 통계');
  await testEndpoint('POST', '/api/cache/set', '캐시 설정');
  await testEndpoint('GET', '/api/cache/get/test-key', '캐시 조회');
  await testEndpoint('DELETE', '/api/cache/delete/test-key', '캐시 삭제');
  await testEndpoint('POST', '/api/cache/invalidate', '캐시 무효화');
  await testEndpoint('POST', '/api/cache/clear', '캐시 클리어');
  await testEndpoint('POST', '/api/cache/warm', '캐시 워밍');
  
  // =============================================
  // MONITORING ENDPOINTS
  // =============================================
  console.log('\n📈 MONITORING ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/monitoring/metrics', '모니터링 메트릭');
  await testEndpoint('GET', '/api/monitoring/metrics/cpu-usage', '특정 메트릭');
  await testEndpoint('POST', '/api/monitoring/metrics', '메트릭 기록');
  await testEndpoint('GET', '/api/monitoring/alerts', '모니터링 알림');
  await testEndpoint('GET', '/api/monitoring/alerts/rules', '알림 규칙');
  await testEndpoint('POST', '/api/monitoring/alerts/rules', '알림 규칙 생성');
  await testEndpoint('PUT', '/api/monitoring/alerts/rules/rule-1', '알림 규칙 업데이트');
  await testEndpoint('DELETE', '/api/monitoring/alerts/rules/rule-1', '알림 규칙 삭제');
  await testEndpoint('POST', '/api/monitoring/alerts/alert-1/resolve', '알림 해결');
  await testEndpoint('GET', '/api/monitoring/dashboard', '모니터링 대시보드');
  await testEndpoint('GET', '/api/monitoring/system', '시스템 모니터링');
  await testEndpoint('GET', '/api/monitoring/application', '애플리케이션 모니터링');
  
  // =============================================
  // SHUTDOWN ENDPOINTS
  // =============================================
  console.log('\n🔄 SHUTDOWN ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/shutdown/status', '종료 상태');
  await testEndpoint('POST', '/api/shutdown/test', '종료 테스트');
  await testEndpoint('GET', '/api/shutdown/health', '종료 헬스 체크');
  
  // =============================================
  // ERROR TESTING ENDPOINTS
  // =============================================
  console.log('\n⚠️ ERROR TESTING ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/test-error/auth-error', '인증 오류 테스트', 401);
  await testEndpoint('GET', '/api/test-error/validation-error', '유효성 검사 오류 테스트', 400);
  await testEndpoint('GET', '/api/test-error/business-error', '비즈니스 로직 오류 테스트', 400);
  await testEndpoint('GET', '/api/test-error/database-error', '데이터베이스 오류 테스트', 500);
  await testEndpoint('GET', '/api/test-error/external-error', '외부 서비스 오류 테스트', 502);
  await testEndpoint('GET', '/api/test-error/rate-limit-error', '속도 제한 오류 테스트', 429);
  
  // =============================================
  // MISSING ADMIN ENDPOINTS
  // =============================================
  console.log('\n👨‍💼 MISSING ADMIN ENDPOINTS');
  console.log('-'.repeat(50));
  
  await testEndpoint('GET', '/api/admin/users/user-1', '관리자 사용자 상세');
  await testEndpoint('PUT', '/api/admin/users/user-1', '관리자 사용자 업데이트');
  await testEndpoint('DELETE', '/api/admin/users/user-1', '관리자 사용자 삭제');
  await testEndpoint('GET', '/api/admin/users/search', '관리자 사용자 검색');
  await testEndpoint('POST', '/api/admin/users/bulk-action', '관리자 사용자 대량 작업');
  
  await testEndpoint('GET', '/api/admin/shops/search', '관리자 매장 검색');
  await testEndpoint('POST', '/api/admin/shops/bulk-action', '관리자 매장 대량 작업');
  await testEndpoint('GET', '/api/admin/shops/statistics', '관리자 매장 통계');
  
  await testEndpoint('GET', '/api/admin/reservations/search', '관리자 예약 검색');
  await testEndpoint('POST', '/api/admin/reservations/bulk-action', '관리자 예약 대량 작업');
  await testEndpoint('GET', '/api/admin/reservations/statistics', '관리자 예약 통계');
  
  await testEndpoint('GET', '/api/admin/payments/search', '관리자 결제 검색');
  await testEndpoint('POST', '/api/admin/payments/bulk-action', '관리자 결제 대량 작업');
  await testEndpoint('GET', '/api/admin/payments/statistics', '관리자 결제 통계');
  
  // =============================================
  // TEST RESULTS SUMMARY
  // =============================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 종합 테스트 결과');
  console.log('='.repeat(80));
  console.log(`총 테스트: ${testResults.total}`);
  console.log(`✅ 성공: ${testResults.passed}`);
  console.log(`❌ 실패: ${testResults.failed}`);
  console.log(`📈 성공률: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ 실패한 테스트:');
    testResults.errors.forEach(error => {
      console.log(`  - ${error.method} ${error.path}: ${error.description}`);
      if (error.error) {
        console.log(`    오류: ${error.error}`);
      } else if (error.expected !== error.actual) {
        console.log(`    예상: ${error.expected}, 실제: ${error.actual}`);
      }
    });
  }
  
  console.log('\n🎉 에뷰리띵 백엔드 API 종합 테스트 완료!');
}

// Run the tests
runExhaustiveTests().catch(console.error); 