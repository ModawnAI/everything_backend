# Redis 서버 설정 가이드

## 개요

에뷰리띵 백엔드는 Rate Limiting, IP Blocking, 캐싱을 위해 Redis를 사용합니다.
개발 환경에서는 **Docker를 사용하여 Redis를 실행하는 것을 권장합니다.**

## 필수 요구사항

- Docker Desktop 설치 (Windows/Mac)
- Node.js 18 이상
- Docker Compose

---

## 1. Docker로 Redis 실행 (권장)

### 빠른 시작

```bash
# Redis 컨테이너 시작
docker-compose up -d redis

# 상태 확인
docker ps --filter "name=ebeautything-redis"

# 연결 테스트
docker exec ebeautything-redis redis-cli ping
# 예상 출력: PONG
```

### Redis 관리 명령어

#### 기본 제어

```bash
# Redis 시작
docker-compose up -d redis

# Redis 중지
docker-compose stop redis

# Redis 재시작
docker-compose restart redis

# Redis 완전 제거 (데이터 포함)
docker-compose down redis -v

# Redis 로그 실시간 확인
docker-compose logs -f redis

# Redis 상태 확인
docker ps --filter "name=ebeautything-redis"
```

#### Redis CLI 접속

```bash
# Redis CLI 접속
docker exec -it ebeautything-redis redis-cli

# 접속 후 사용 가능한 명령어:
# > PING                    # 연결 테스트
# > DBSIZE                  # 저장된 키 개수
# > KEYS *                  # 모든 키 조회 (주의: 프로덕션에서는 사용 금지)
# > GET key                 # 특정 키 조회
# > DEL key                 # 특정 키 삭제
# > FLUSHALL                # 모든 데이터 삭제 (주의!)
# > INFO                    # Redis 서버 정보
# > EXIT                    # CLI 종료
```

#### 데이터 관리

```bash
# Redis 데이터 초기화 (주의: 모든 데이터 삭제!)
docker exec ebeautything-redis redis-cli FLUSHALL

# Redis 정보 확인
docker exec ebeautything-redis redis-cli INFO

# 저장된 키 개수 확인
docker exec ebeautything-redis redis-cli DBSIZE

# 특정 패턴의 키 조회
docker exec ebeautything-redis redis-cli KEYS "rate_limit:*"

# Redis 메모리 사용량 확인
docker exec ebeautything-redis redis-cli INFO memory
```

---

## 2. 백엔드 환경 설정

### .env 파일 설정

Redis를 활성화하려면 `.env` 파일에서 다음 설정을 확인하세요:

```bash
# Redis 설정
REDIS_ENABLED=true                    # ✅ Redis 활성화
REDIS_URL=redis://localhost:6379     # Redis 연결 URL
REDIS_PASSWORD=                       # Redis 비밀번호 (개발 환경에서는 비워둠)
REDIS_DB=0                           # Redis 데이터베이스 번호

# Rate Limiting 설정
DISABLE_RATE_LIMIT=false             # ✅ Rate Limiting 활성화
```

### 개발 환경 옵션

#### 옵션 A: Redis + Rate Limiting 모두 활성화 (권장)

프로덕션 환경과 유사한 환경에서 테스트하고 싶을 때

```bash
REDIS_ENABLED=true
DISABLE_RATE_LIMIT=false
```

**장점:**
- 프로덕션과 동일한 환경
- Rate Limiting 테스트 가능
- IP Blocking 테스트 가능

**단점:**
- API 요청 제한이 적용됨 (15분당 100회)

#### 옵션 B: Redis만 활성화, Rate Limiting 비활성화

개발 편의를 위해 요청 제한 없이 작업하고 싶을 때

```bash
REDIS_ENABLED=true
DISABLE_RATE_LIMIT=true
```

**장점:**
- API 요청 제한 없음
- 빠른 개발 가능

**단점:**
- Rate Limiting 기능 테스트 불가

---

## 3. 백엔드 서버 시작

### 방법 1: Docker Redis 사용 (권장)

```bash
# 1. Redis 시작
docker-compose up -d redis

# 2. 백엔드 서버 시작
npm run dev
```

### 방법 2: Windows 로컬 Redis 사용 (레거시)

```bash
# Redis와 함께 서버 시작
npm run dev:redis
```

**참고:** 이 스크립트는 `redis/redis-server.exe`를 사용합니다.
Docker를 사용하는 경우에는 방법 1을 사용하세요.

### 방법 3: 커스텀 스크립트 추가 (선택사항)

`package.json`에 편의 스크립트를 추가할 수 있습니다:

```json
{
  "scripts": {
    "docker:redis:start": "docker-compose up -d redis",
    "docker:redis:stop": "docker-compose stop redis",
    "docker:redis:logs": "docker-compose logs -f redis",
    "docker:redis:restart": "docker-compose restart redis",
    "docker:redis:status": "docker ps --filter name=ebeautything-redis",
    "dev:docker": "docker-compose up -d redis && npm run dev"
  }
}
```

사용 예시:
```bash
npm run docker:redis:start   # Redis 시작
npm run docker:redis:logs    # Redis 로그 확인
npm run dev:docker           # Redis + 백엔드 동시 시작
```

---

## 4. 연결 확인

### Redis 연결 테스트

```bash
# 방법 1: Docker CLI
docker exec ebeautything-redis redis-cli ping
# 예상 출력: PONG

# 방법 2: Node.js 스크립트
node -e "const Redis = require('ioredis'); const redis = new Redis(); redis.ping().then(console.log).finally(() => redis.disconnect());"
# 예상 출력: PONG
```

### 백엔드 서버 로그 확인

서버 시작 시 다음과 같은 로그가 표시되어야 합니다:

```
✅ Redis connection successful
✅ Rate limiter initialized with Redis backend
🚀 Server running on port 3001
```

### API 테스트

```bash
# Favorites API 테스트
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/user/favorites

# 예상 결과: 200 OK (타임아웃 없음)
```

---

## 5. 트러블슈팅

### 문제 1: Redis 연결 실패

**증상:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**해결책:**
```bash
# Redis 컨테이너 상태 확인
docker ps --filter "name=ebeautything-redis"

# Redis가 없으면 시작
docker-compose up -d redis

# Redis 로그 확인
docker-compose logs redis
```

### 문제 2: Favorites API 타임아웃

**증상:**
- `/api/user/favorites` 요청이 타임아웃
- `/api/shops/*` 요청은 정상 작동

**원인:**
- Redis가 실행되지 않음
- `.env`에서 `REDIS_ENABLED=false`로 설정됨

**해결책:**
```bash
# 1. Redis 실행 확인
docker ps --filter "name=ebeautything-redis"

# 2. .env 파일 확인
cat .env | findstr "REDIS_ENABLED"
# 출력이 "REDIS_ENABLED=true"이어야 함

# 3. Redis 시작 (필요한 경우)
docker-compose up -d redis

# 4. 백엔드 서버 재시작
# Ctrl+C로 서버 중지 후
npm run dev
```

### 문제 3: Rate Limit 초과

**증상:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

**해결책 (개발 환경):**

`.env` 파일 수정:
```bash
DISABLE_RATE_LIMIT=true
```

서버 재시작 후 적용됩니다.

### 문제 4: Docker 컨테이너가 시작되지 않음

**증상:**
```
Error: Cannot start service redis
```

**해결책:**
```bash
# 1. 기존 컨테이너 확인
docker ps -a --filter "name=ebeautything-redis"

# 2. 기존 컨테이너 제거
docker rm -f ebeautything-redis

# 3. 볼륨 확인 및 제거 (필요한 경우)
docker volume ls | findstr ebeautything-redis
docker volume rm ebeautything-redis-data

# 4. 다시 시작
docker-compose up -d redis
```

### 문제 5: Redis 데이터 손상

**증상:**
- Redis가 시작되지 않음
- 로그에 "Bad file format" 또는 "Corrupted RDB" 에러

**해결책:**
```bash
# 1. 컨테이너와 볼륨 완전 제거
docker-compose down redis -v

# 2. Redis 재시작 (새로운 볼륨으로)
docker-compose up -d redis
```

---

## 6. 프로덕션 환경 설정

### docker-compose.yml 설정

프로덕션에서는 전체 스택을 Docker로 실행합니다:

```bash
# 전체 스택 시작 (Backend + Redis + Nginx)
docker-compose up -d

# 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### Redis 영속성 설정

docker-compose.yml에 이미 설정되어 있습니다:

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes  # AOF 영속성 활성화
  volumes:
    - redis-data:/data  # 데이터 영속성
```

### Redis 백업

```bash
# Redis 데이터 백업
docker exec ebeautything-redis redis-cli BGSAVE

# 백업 파일 확인
docker exec ebeautything-redis ls -lh /data

# 백업 파일 복사 (Windows)
docker cp ebeautything-redis:/data/dump.rdb ./backup/dump-%date:~0,4%%date:~5,2%%date:~8,2%.rdb

# 백업 파일 복사 (Linux/Mac)
docker cp ebeautything-redis:/data/dump.rdb ./backup/dump-$(date +%Y%m%d).rdb
```

---

## 7. 모니터링

### Redis 메트릭 확인

```bash
# Redis 통계 정보
docker exec ebeautything-redis redis-cli INFO stats

# 메모리 사용량
docker exec ebeautything-redis redis-cli INFO memory

# 현재 연결 수
docker exec ebeautything-redis redis-cli CLIENT LIST

# 느린 쿼리 로그
docker exec ebeautything-redis redis-cli SLOWLOG GET 10
```

### Rate Limiting 데이터 확인

```bash
# Rate limiting 키 조회
docker exec ebeautything-redis redis-cli KEYS "rate_limit:*"

# 특정 IP의 rate limit 상태
docker exec ebeautything-redis redis-cli GET "rate_limit:ip:127.0.0.1"

# IP blocking 상태 확인
docker exec ebeautything-redis redis-cli KEYS "ip_block:*"
```

---

## 8. Windows 로컬 Redis (레거시)

### Redis 설치 위치
- **경로**: `./redis/`
- **실행 파일**: `redis-server.exe`
- **설정 파일**: `redis.windows.conf`

### 사용 가능한 npm 스크립트

```bash
# Redis와 함께 서버 시작
npm run dev:redis

# Redis 수동 시작
npm run redis:start

# Redis 상태 확인
npm run redis:status

# Redis 중지
npm run redis:stop
```

### CLI로 직접 테스트
```bash
./redis/redis-cli.exe ping
# 응답: PONG
```

**참고:** Docker를 사용하는 것을 권장하며, 로컬 Redis는 레거시 지원용으로 유지됩니다.

---

## 9. 참고 자료

### Redis 설정 파일 위치

- **로컬 실행**: `redis/redis.windows.conf`
- **Docker**: 컨테이너 내부 `/etc/redis/redis.conf`

### 관련 코드 파일

- **Rate Limiting**: `src/middleware/rate-limit.middleware.ts`
- **Redis Store**: `src/utils/redis-rate-limit-store.ts`
- **IP Blocking**: `src/services/ip-blocking.service.ts`
- **Rate Limiter Service**: `src/services/rate-limiter-flexible.service.ts`

### Docker Compose 설정

- **설정 파일**: `docker-compose.yml`
- **Redis 이미지**: `redis:7-alpine`
- **포트**: `6379:6379`
- **볼륨**: `ebeautything-redis-data`

### 공식 문서

- [Redis 공식 문서](https://redis.io/documentation)
- [ioredis 라이브러리](https://github.com/luin/ioredis)
- [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible)
- [Docker Redis 이미지](https://hub.docker.com/_/redis)

---

## 10. 체크리스트

개발 환경 설정 완료 확인:

- [ ] Docker Desktop 설치 및 실행 중
- [ ] `docker-compose up -d redis` 실행 완료
- [ ] `docker ps` 명령어로 Redis 컨테이너 확인
- [ ] `.env` 파일에서 `REDIS_ENABLED=true` 설정
- [ ] 백엔드 서버 재시작 (`npm run dev`)
- [ ] Redis 연결 테스트 성공 (`docker exec ebeautything-redis redis-cli ping`)
- [ ] Favorites API 테스트 성공 (타임아웃 없음)

**모든 항목이 체크되면 Redis 설정이 완료된 것입니다!** 🎉
