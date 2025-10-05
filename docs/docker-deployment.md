# 🐳 Docker 배포 가이드 - 에뷰리띵 백엔드

> **Last Updated**: 2025-10-04
> **Version**: 1.0.0

## 목차

- [개요](#개요)
- [사전 요구사항](#사전-요구사항)
- [빠른 시작](#빠른-시작)
- [환경 설정](#환경-설정)
- [배포 방법](#배포-방법)
- [모니터링 및 관리](#모니터링-및-관리)
- [트러블슈팅](#트러블슈팅)
- [프로덕션 배포 체크리스트](#프로덕션-배포-체크리스트)

---

## 개요

이 문서는 에뷰리띵 백엔드 서버를 Docker를 사용하여 배포하는 방법을 설명합니다.

### 아키텍처 구성

```
┌─────────────────────────────────────────────────┐
│                    Nginx                        │
│          (Reverse Proxy & SSL/TLS)             │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│              Backend Container                  │
│           (Node.js/Express API)                │
└─────────────────────────────────────────────────┘
                        ↓
    ┌──────────────────┴──────────────────┐
    ↓                                      ↓
┌─────────────┐                    ┌─────────────┐
│    Redis    │                    │  Supabase   │
│   (Cache)   │                    │ (Database)  │
└─────────────┘                    └─────────────┘
```

### 포함된 서비스

1. **Backend API** - Node.js Express 서버 (포트 3001)
2. **Redis** - 캐싱 및 세션 스토리지 (포트 6379)
3. **Nginx** - 리버스 프록시 및 로드 밸런서 (포트 80/443)
4. **Supabase** - PostgreSQL 데이터베이스 (외부 서비스)

---

## 사전 요구사항

### 필수 소프트웨어

- **Docker**: 20.10.0 이상
- **Docker Compose**: 2.0.0 이상

### Docker 설치 확인

```bash
docker --version
# Docker version 20.10.0 or higher

docker-compose --version
# Docker Compose version 2.0.0 or higher
```

### 필수 계정 및 키

- [x] Supabase 프로젝트 (데이터베이스)
- [x] TossPayments 계정 (결제)
- [x] Firebase FCM 키 (푸시 알림)
- [x] 소셜 로그인 키 (Kakao, Google, Apple)

---

## 빠른 시작

### 1. 환경 설정 파일 준비

```bash
# .env.docker 파일을 복사하여 프로덕션 환경 파일 생성
cp .env.docker .env.production

# 환경 변수 편집 (실제 값으로 변경)
nano .env.production
```

### 2. Docker 빌드 및 실행

```bash
# 모든 서비스 빌드 및 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f backend

# 서비스 상태 확인
docker-compose ps
```

### 3. 헬스 체크

```bash
# API 서버 상태 확인
curl http://localhost:3001/health

# 응답 예시:
# {
#   "status": "ok",
#   "message": "에뷰리띵 백엔드 서버가 정상적으로 실행 중입니다.",
#   "timestamp": "2025-10-04T...",
#   "version": "1.0.0"
# }
```

---

## 환경 설정

### 환경 변수 구성

`.env.production` 파일을 다음과 같이 설정하세요:

#### 1. 서버 기본 설정

```bash
NODE_ENV=production
PORT=3001
API_VERSION=v1
```

#### 2. 인증 및 보안

```bash
# 강력한 시크릿 생성: openssl rand -hex 32
JWT_SECRET=your_strong_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
```

#### 3. Redis 설정

```bash
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

#### 4. Supabase 데이터베이스

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### 5. 결제 (TossPayments)

```bash
# 프로덕션 키 사용
TOSS_PAYMENTS_SECRET_KEY=live_sk_...
TOSS_PAYMENTS_CLIENT_KEY=live_ck_...
TOSS_PAYMENTS_BASE_URL=https://api.tosspayments.com
```

#### 6. 소셜 로그인

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Apple Sign In
APPLE_CLIENT_ID=com.ebeautything.app
APPLE_CLIENT_SECRET=your_apple_jwt_token

# Kakao Login
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret
```

### Docker Compose 설정

`docker-compose.yml` 파일에서 환경 변수 파일 지정:

```yaml
services:
  backend:
    env_file:
      - .env.production  # 실제 프로덕션 환경 파일 사용
```

---

## 배포 방법

### 개발 환경 배포

```bash
# 개발 모드로 실행 (핫 리로드 활성화)
docker-compose -f docker-compose.yml up -d

# 개발 환경에서는 .env 파일 사용
```

### 프로덕션 환경 배포

#### 1. 이미지 빌드

```bash
# 프로덕션 이미지 빌드
docker-compose build --no-cache backend

# 빌드 확인
docker images | grep ebeautything
```

#### 2. 서비스 시작

```bash
# 백그라운드에서 실행
docker-compose up -d

# 실행 중인 컨테이너 확인
docker-compose ps
```

#### 3. 로그 모니터링

```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스만
docker-compose logs -f backend
docker-compose logs -f redis
docker-compose logs -f nginx
```

### SSL/TLS 인증서 설정

#### Let's Encrypt 사용 (권장)

```bash
# nginx 디렉토리에 SSL 인증서 배치
mkdir -p nginx/ssl

# Certbot으로 인증서 발급
sudo certbot certonly --standalone -d api.ebeautything.com

# 인증서 복사
sudo cp /etc/letsencrypt/live/api.ebeautything.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/api.ebeautything.com/privkey.pem nginx/ssl/

# 권한 설정
sudo chmod 644 nginx/ssl/fullchain.pem
sudo chmod 644 nginx/ssl/privkey.pem
```

#### 자체 서명 인증서 (테스트용)

```bash
# 자체 서명 인증서 생성
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=api.ebeautything.com"
```

### 수평 확장 (스케일링)

#### Backend 컨테이너 스케일 아웃

```bash
# Backend 인스턴스 3개로 확장
docker-compose up -d --scale backend=3

# Nginx가 자동으로 로드 밸런싱
```

#### docker-compose.yml에서 스케일링 설정

```yaml
services:
  backend:
    deploy:
      replicas: 3  # 복제본 개수
      restart_policy:
        condition: on-failure
```

---

## 모니터링 및 관리

### 컨테이너 상태 확인

```bash
# 실행 중인 컨테이너
docker-compose ps

# 자세한 상태 정보
docker-compose top

# 리소스 사용량
docker stats
```

### 로그 관리

```bash
# 실시간 로그
docker-compose logs -f backend

# 최근 100줄
docker-compose logs --tail=100 backend

# 특정 시간 이후 로그
docker-compose logs --since 30m backend

# 로그 파일 위치
ls -la ./logs/
```

### 데이터 백업

#### Redis 데이터 백업

```bash
# Redis 데이터 백업
docker-compose exec redis redis-cli BGSAVE

# 백업 파일 복사
docker cp ebeautything-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

#### 로그 백업

```bash
# 로그 백업
tar -czf logs-backup-$(date +%Y%m%d).tar.gz ./logs/
```

### 서비스 재시작

```bash
# 모든 서비스 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart backend

# 무중단 재시작 (롤링 업데이트)
docker-compose up -d --no-deps --build backend
```

### 업데이트 배포

```bash
# 1. 새 코드 가져오기
git pull origin main

# 2. 이미지 리빌드
docker-compose build --no-cache backend

# 3. 무중단 배포
docker-compose up -d --no-deps backend

# 4. 이전 이미지 정리
docker image prune -f
```

---

## 트러블슈팅

### 일반적인 문제 해결

#### 1. 포트 충돌

```bash
# 포트 사용 중인 프로세스 확인 (Windows)
netstat -ano | findstr :3001

# 프로세스 종료
taskkill /PID <PID> /F

# 또는 다른 포트 사용
# docker-compose.yml에서 포트 변경
ports:
  - "3002:3001"
```

#### 2. 컨테이너 시작 실패

```bash
# 상세 로그 확인
docker-compose logs backend

# 컨테이너 재생성
docker-compose down
docker-compose up -d

# 볼륨 초기화 (주의: 데이터 손실)
docker-compose down -v
docker-compose up -d
```

#### 3. 네트워크 연결 문제

```bash
# 네트워크 상태 확인
docker network ls
docker network inspect ebeautything-network

# 네트워크 재생성
docker-compose down
docker network prune
docker-compose up -d
```

#### 4. Redis 연결 실패

```bash
# Redis 컨테이너 상태 확인
docker-compose exec redis redis-cli ping
# 응답: PONG

# Redis 로그 확인
docker-compose logs redis

# Redis 재시작
docker-compose restart redis
```

#### 5. Supabase 연결 문제

```bash
# 환경 변수 확인
docker-compose exec backend env | grep SUPABASE

# 연결 테스트
docker-compose exec backend node -e "
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
console.log('Connected:', !!client);
"
```

### 디버깅 모드

```bash
# 디버그 모드로 컨테이너 실행
docker-compose run --rm backend sh

# 컨테이너 내부 접속
docker-compose exec backend sh

# Node.js 디버그 모드
docker-compose run --rm -e DEBUG=* backend npm run dev
```

### 성능 문제

```bash
# 리소스 사용량 확인
docker stats

# 메모리 제한 설정
# docker-compose.yml에 추가
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
```

---

## 프로덕션 배포 체크리스트

### 배포 전 확인사항

- [ ] 환경 변수 파일 (.env.production) 설정 완료
- [ ] 강력한 시크릿 키 생성 (JWT_SECRET, SESSION_SECRET)
- [ ] Supabase 연결 테스트 완료
- [ ] Redis 설정 및 연결 확인
- [ ] TossPayments 프로덕션 키 설정
- [ ] Firebase FCM 설정 완료
- [ ] 소셜 로그인 키 설정 (Kakao, Google, Apple)
- [ ] SSL/TLS 인증서 설치
- [ ] CORS 도메인 설정
- [ ] Rate Limiting 설정 확인
- [ ] 로그 디렉토리 권한 설정

### 보안 체크리스트

- [ ] 환경 변수 파일 (.env.production) Git에서 제외
- [ ] 기본 패스워드 모두 변경
- [ ] 불필요한 포트 차단
- [ ] 방화벽 규칙 설정
- [ ] HTTPS 강제 적용
- [ ] Security Headers 설정 확인
- [ ] Rate Limiting 활성화
- [ ] 로그 마스킹 설정 (민감 정보)

### 모니터링 설정

- [ ] 헬스 체크 엔드포인트 확인
- [ ] 로그 수집 설정
- [ ] 에러 추적 (Sentry) 설정
- [ ] 성능 모니터링 설정
- [ ] 알림 설정 (Slack, Email)
- [ ] 백업 자동화 설정

### 성능 최적화

- [ ] Nginx 캐싱 설정
- [ ] Gzip 압축 활성화
- [ ] Redis 캐싱 전략 수립
- [ ] 데이터베이스 인덱스 최적화
- [ ] 이미지 최적화 및 CDN 설정
- [ ] API 응답 캐싱

---

## 유용한 명령어 모음

### Docker Compose 명령어

```bash
# 서비스 시작
docker-compose up -d

# 서비스 중지
docker-compose down

# 로그 확인
docker-compose logs -f [service]

# 서비스 재시작
docker-compose restart [service]

# 스케일링
docker-compose up -d --scale backend=3

# 빌드 및 시작
docker-compose up -d --build

# 볼륨 포함 삭제 (주의!)
docker-compose down -v
```

### Docker 명령어

```bash
# 컨테이너 목록
docker ps

# 이미지 목록
docker images

# 로그 확인
docker logs -f <container_id>

# 컨테이너 접속
docker exec -it <container_id> sh

# 리소스 사용량
docker stats

# 미사용 리소스 정리
docker system prune -a
```

### 유지보수 명령어

```bash
# 디스크 사용량 확인
docker system df

# 미사용 이미지 삭제
docker image prune -a

# 미사용 볼륨 삭제
docker volume prune

# 미사용 네트워크 삭제
docker network prune

# 전체 정리 (주의!)
docker system prune -a --volumes
```

---

## 추가 리소스

### 문서

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Nginx 공식 문서](https://nginx.org/en/docs/)

### 관련 파일

- `Dockerfile` - Docker 이미지 빌드 설정
- `docker-compose.yml` - 서비스 오케스트레이션
- `.dockerignore` - Docker 빌드 제외 파일
- `.env.docker` - 환경 변수 템플릿
- `nginx/nginx.conf` - Nginx 설정 파일

### 지원

문제가 발생하거나 도움이 필요한 경우:

- **GitHub Issues**: [ebeautything/backend/issues](https://github.com/ebeautything/backend/issues)
- **Email**: support@ebeautything.com
- **Slack**: #backend-support

---

**© 2025 에뷰리띵 (eBeautything). All rights reserved.**
