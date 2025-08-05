# 플러터 앱 소셜 로그인 연동 가이드

## 📱 개요
본 문서는 에뷰리띵 플러터 앱에서 백엔드 API와 연동하여 소셜 로그인(카카오, 애플, 구글)을 구현하는 방법을 설명합니다.

---

## 🔧 필요한 패키지 설정

### **1. pubspec.yaml 의존성 추가**

```yaml
dependencies:
  # 소셜 로그인 SDK
  kakao_flutter_sdk: ^1.8.0
  sign_in_with_apple: ^5.0.0
  google_sign_in: ^6.1.6
  
  # HTTP 클라이언트
  dio: ^5.4.0
  
  # 로컬 저장소
  shared_preferences: ^2.2.2
  
  # 상태 관리
  flutter_bloc: ^8.1.3
  
  # FCM
  firebase_messaging: ^14.7.10
```

### **2. 플랫폼별 설정**

#### **iOS 설정 (ios/Runner/Info.plist)**
```xml
<!-- 카카오 로그인 -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>kakaokompassauth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>kakao{NATIVE_APP_KEY}</string>
    </array>
  </dict>
</array>

<!-- 애플 로그인 -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>signinwithapple</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>signinwithapple</string>
    </array>
  </dict>
</array>
```

#### **Android 설정 (android/app/build.gradle)**
```gradle
android {
    defaultConfig {
        // 카카오 로그인
        manifestPlaceholders += [
            'kakao_app_key': 'kakao{NATIVE_APP_KEY}'
        ]
    }
}
```

---

## 🏗️ 아키텍처 설계

### **1. BLoC 패턴 구조**

```
lib/
├── auth/
│   ├── bloc/
│   │   ├── auth_bloc.dart
│   │   ├── auth_event.dart
│   │   └── auth_state.dart
│   ├── models/
│   │   ├── user_model.dart
│   │   └── auth_response.dart
│   ├── repositories/
│   │   └── auth_repository.dart
│   └── services/
│       ├── social_auth_service.dart
│       └── token_service.dart
```

### **2. 상태 관리 흐름**

```
사용자 액션 → AuthEvent → AuthBloc → AuthRepository → API 호출 → AuthState → UI 업데이트
```

---

## 🔐 소셜 로그인 구현

### **1. 소셜 인증 서비스 클래스**

#### **SocialAuthService 구현**
- **카카오 로그인**: `KakaoSdk` 사용하여 액세스 토큰 획득
- **애플 로그인**: `SignInWithApple` 사용하여 ID 토큰 획득
- **구글 로그인**: `GoogleSignIn` 사용하여 ID 토큰 획득
- **토큰 검증**: 각 프로바이더별 토큰 유효성 검증
- **에러 처리**: 각 프로바이더별 에러 상황 처리

### **2. 인증 Repository 구현**

#### **AuthRepository 주요 메서드**
- **socialLogin()**: 백엔드 API 호출하여 소셜 로그인 처리
- **refreshToken()**: 액세스 토큰 갱신
- **logout()**: 로그아웃 처리
- **getUserProfile()**: 사용자 프로필 조회
- **updateUserProfile()**: 사용자 프로필 업데이트

### **3. 토큰 관리 서비스**

#### **TokenService 구현**
- **토큰 저장**: SharedPreferences에 JWT 토큰 저장
- **토큰 검증**: 토큰 만료 시간 확인
- **자동 갱신**: 액세스 토큰 만료 시 자동 갱신
- **토큰 삭제**: 로그아웃 시 토큰 제거

---

## 📱 UI 구현

### **1. 로그인 화면 구성**

#### **화면 레이아웃**
- **상단**: 에뷰리띵 로고 및 브랜드 슬로건
- **중앙**: 소셜 로그인 버튼들 (카카오, 애플, 구글)
- **하단**: 서비스 이용약관 및 개인정보처리방침 링크

#### **소셜 로그인 버튼**
- **카카오**: 노란색 배경, 카카오 로고 + "카카오로 시작하기"
- **애플**: 검은색/흰색 테마별, 애플 로고 + "Apple로 계속하기"
- **구글**: 흰색 테두리, 구글 로고 + "Google로 계속하기"

### **2. 로딩 상태 처리**

#### **로그인 진행 중**
- **로딩 인디케이터**: 각 버튼에 CircularProgressIndicator 표시
- **버튼 비활성화**: 로그인 진행 중 다른 버튼 비활성화
- **에러 메시지**: 로그인 실패 시 적절한 에러 메시지 표시

---

## 🔄 인증 플로우

### **1. 초기 앱 시작**

#### **세션 확인**
1. **토큰 확인**: 로컬에 저장된 JWT 토큰 확인
2. **토큰 검증**: `GET /api/auth/verify-session` 호출
3. **상태 결정**: 
   - 유효한 토큰 → 메인 화면으로 이동
   - 만료된 토큰 → 로그인 화면으로 이동
   - 토큰 없음 → 로그인 화면으로 이동

### **2. 소셜 로그인 플로우**

#### **Step 1: 소셜 프로바이더 인증**
1. **사용자 선택**: 사용자가 소셜 로그인 버튼 탭
2. **SDK 호출**: 해당 프로바이더 SDK로 인증 요청
3. **토큰 획득**: 프로바이더에서 액세스 토큰/ID 토큰 받기

#### **Step 2: 백엔드 인증**
1. **API 호출**: `POST /api/auth/social-login` 호출
2. **요청 데이터**: 
   ```json
   {
     "provider": "kakao|apple|google",
     "token": "소셜_토큰",
     "fcmToken": "FCM_토큰",
     "deviceInfo": {
       "platform": "ios|android",
       "version": "앱_버전",
       "deviceId": "기기_ID"
     }
   }
   ```

#### **Step 3: 응답 처리**
1. **성공 응답**: 
   - JWT 토큰들을 로컬에 저장
   - 사용자 정보 저장
   - FCM 토큰 등록
2. **신규 사용자**: `isNewUser: true`인 경우 회원가입 화면으로 이동
3. **기존 사용자**: `isNewUser: false`인 경우 메인 화면으로 이동

### **3. 회원가입 완성 플로우**

#### **신규 사용자 추가 정보 입력**
1. **화면 이동**: 소셜 로그인 성공 후 회원가입 화면으로 이동
2. **정보 입력**: 이름, 성별, 생년월일, 전화번호, 이메일 등
3. **API 호출**: `POST /api/auth/register` 호출
4. **완료 처리**: 회원가입 완료 후 메인 화면으로 이동

---

## 🔧 기술적 구현 세부사항

### **1. HTTP 클라이언트 설정**

#### **Dio 인터셉터 구성**
- **인증 헤더**: 모든 요청에 `Authorization: Bearer {token}` 추가
- **토큰 갱신**: 401 에러 시 자동으로 토큰 갱신 시도
- **에러 처리**: 네트워크 에러 및 API 에러 통합 처리

### **2. 상태 관리 (BLoC)**

#### **AuthEvent 정의**
- **SocialLoginRequested**: 소셜 로그인 요청
- **LogoutRequested**: 로그아웃 요청
- **TokenRefreshRequested**: 토큰 갱신 요청
- **ProfileUpdateRequested**: 프로필 업데이트 요청

#### **AuthState 정의**
- **AuthInitial**: 초기 상태
- **AuthLoading**: 로딩 중
- **AuthSuccess**: 인증 성공
- **AuthFailure**: 인증 실패
- **AuthLoggedOut**: 로그아웃 상태

### **3. 로컬 저장소 관리**

#### **SharedPreferences 키 정의**
- `access_token`: JWT 액세스 토큰
- `refresh_token`: JWT 리프레시 토큰
- `user_data`: 사용자 정보 JSON
- `fcm_token`: FCM 토큰
- `last_login`: 마지막 로그인 시간

---

## 🛡️ 보안 고려사항

### **1. 토큰 보안**
- **안전한 저장**: 민감한 토큰은 암호화하여 저장
- **자동 만료**: 토큰 만료 시 자동 로그아웃
- **세션 관리**: 여러 기기에서 로그인 상태 관리

### **2. 에러 처리**
- **네트워크 에러**: 인터넷 연결 실패 시 적절한 메시지
- **인증 에러**: 토큰 만료 시 자동 갱신 또는 재로그인
- **서버 에러**: 서버 오류 시 사용자 친화적 메시지

### **3. 사용자 경험**
- **로딩 상태**: 모든 비동기 작업에 로딩 인디케이터
- **에러 메시지**: 명확하고 도움이 되는 에러 메시지
- **재시도 기능**: 실패한 작업에 대한 재시도 옵션

---

## 📊 모니터링 및 분석

### **1. 로그인 분석**
- **성공률 추적**: 각 소셜 프로바이더별 로그인 성공률
- **에러 분석**: 실패 원인별 통계 수집
- **사용자 행동**: 로그인 플로우별 사용자 행동 분석

### **2. 성능 모니터링**
- **응답 시간**: API 호출 응답 시간 측정
- **토큰 갱신**: 토큰 갱신 빈도 및 성공률
- **네트워크 품질**: 네트워크 상태에 따른 사용자 경험

---

## 🚀 배포 및 테스트

### **1. 환경별 설정**
- **개발 환경**: 개발용 API 엔드포인트 및 테스트 계정
- **스테이징 환경**: 스테이징 API 및 테스트 데이터
- **프로덕션 환경**: 실제 API 및 프로덕션 설정

### **2. 테스트 시나리오**
- **정상 플로우**: 각 소셜 프로바이더별 정상 로그인
- **에러 플로우**: 네트워크 실패, 토큰 만료, 서버 오류
- **엣지 케이스**: 취소된 로그인, 부분적 실패 상황

---

이 가이드를 따라 구현하면 안전하고 사용자 친화적인 소셜 로그인 시스템을 플러터 앱에 통합할 수 있습니다. 각 단계별로 상세한 구현이 필요하며, 실제 개발 시에는 각 프로바이더의 최신 SDK 문서를 참고하여 구체적인 코드를 작성해야 합니다. 