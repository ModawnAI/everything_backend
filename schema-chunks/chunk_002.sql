-- =============================================
-- SCHEMA CHUNK 2
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 0.2KB
-- =============================================

-- =============================================

-- PostgreSQL 확장 기능 활성화
-- PostGIS: 위치 기반 서비스 (내 주변 샵 찾기, 거리 계산)를 위해 필수
-- UUID: 보안성과 확장성을 위해 모든 Primary Key에 UUID 사용
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";