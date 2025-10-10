-- =====================================================
-- Supabase Mock Data: Shop Services
-- 에뷰리띵 관리자 시스템 - 샵 서비스 목 데이터
-- =====================================================

-- First, let's check if we have existing shops and their categories
-- This query will help us understand what shops we're adding services to

-- =====================================================
-- SHOP SERVICES DATA
-- =====================================================

-- Clear existing shop services data
DELETE FROM shop_services;

-- Insert comprehensive service data for each category
-- Each shop will have 3-6 services appropriate to their category

-- =====================================
-- NAIL SERVICES (네일 서비스)
-- =====================================

-- Shop 1: 강남 네일 스튜디오 (Gangnam Nail Studio)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
-- Assuming first shop UUID - replace with actual shop IDs
((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at LIMIT 1),
'젤 네일 아트', '다양한 디자인의 젤 네일 아트로 손톱을 아름답게 꾸며드립니다', 'nail', 30000, 80000, 120, 10000, NULL, true, true, 14, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at LIMIT 1),
'프렌치 매니큐어', '클래식하고 우아한 프렌치 스타일 매니큐어', 'nail', 25000, 35000, 90, 5000, NULL, true, true, 7, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at LIMIT 1),
'손톱 연장', '짧은 손톱을 자연스럽게 연장하여 원하는 길이로 만들어드립니다', 'nail', 40000, 70000, 150, 15000, NULL, true, true, 14, 4, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at LIMIT 1),
'네일 케어', '큐티클 정리 및 네일 모양 정리 기본 케어', 'nail', 15000, 25000, 60, NULL, 20, true, true, 7, 1, '2시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at LIMIT 1),
'발 네일 케어', '발톱 케어와 페디큐어 서비스', 'nail', 20000, 40000, 90, 5000, NULL, true, true, 7, 2, '24시간 전까지 무료 취소');

-- Shop 2: 홍대 네일 카페 (Hongdae Nail Cafe)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at OFFSET 1 LIMIT 1),
'원 컬러 젤 네일', '깔끔하고 세련된 단색 젤 네일', 'nail', 20000, 30000, 90, NULL, 30, true, true, 10, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at OFFSET 1 LIMIT 1),
'그라데이션 네일', '자연스러운 그라데이션 효과의 네일 아트', 'nail', 35000, 50000, 120, 10000, NULL, true, true, 14, 3, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at OFFSET 1 LIMIT 1),
'스톤 네일 아트', '크리스탈과 스톤으로 포인트를 준 럭셔리 네일', 'nail', 45000, 80000, 150, 15000, NULL, true, true, 14, 4, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at OFFSET 1 LIMIT 1),
'네일 리무버', '기존 젤네일 제거 서비스', 'nail', 8000, 15000, 30, NULL, NULL, true, true, 3, 1, '1시간 전까지 무료 취소');

-- =====================================
-- HAIR SERVICES (헤어 서비스)
-- =====================================

-- Shop 3: 압구정 헤어 살롱 (Apgujeong Hair Salon)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'커트 + 블로우', '전문 디자이너가 제공하는 커트와 스타일링', 'hair', 35000, 80000, 90, 10000, NULL, true, true, 21, 4, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'염색 (전체)', '트렌디한 컬러로 전체 염색', 'hair', 80000, 150000, 180, 30000, NULL, true, true, 21, 8, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'펌 (디지털펜)', '자연스러운 웨이브의 디지털 펌', 'hair', 100000, 180000, 240, 50000, NULL, true, true, 21, 8, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'클리닉 트리트먼트', '손상된 모발을 위한 집중 케어 트리트먼트', 'hair', 40000, 80000, 120, 15000, NULL, true, true, 14, 4, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'스타일링', '특별한 날을 위한 업스타일링', 'hair', 30000, 60000, 60, 10000, NULL, true, true, 7, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'하이라이트', '부분 하이라이트로 포인트 연출', 'hair', 60000, 120000, 150, 20000, NULL, true, true, 21, 6, '48시간 전까지 무료 취소');

-- Shop 4: 건대 헤어 스튜디오 (Konkuk Hair Studio)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at OFFSET 1 LIMIT 1),
'기본 커트', '깔끔한 기본 커트 서비스', 'hair', 25000, 40000, 60, NULL, 25, true, true, 14, 2, '2시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at OFFSET 1 LIMIT 1),
'매직 스트레이트', '자연스러운 스트레이트 펌', 'hair', 80000, 120000, 180, 25000, NULL, true, true, 21, 6, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at OFFSET 1 LIMIT 1),
'볼륨 펌', '뿌리 볼륨을 살려주는 펌', 'hair', 60000, 100000, 150, 20000, NULL, true, true, 14, 4, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at OFFSET 1 LIMIT 1),
'헤드 스파', '두피와 모발을 위한 힐링 스파', 'hair', 30000, 50000, 90, 10000, NULL, true, true, 7, 2, '24시간 전까지 무료 취소');

-- =====================================
-- EYELASH SERVICES (속눈썹 서비스)
-- =====================================

-- Shop 5: 명동 래쉬 살롱 (Myeongdong Lash Salon)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at LIMIT 1),
'속눈썹 연장 (클래식)', '자연스러운 1:1 클래식 속눈썹 연장', 'eyelash', 60000, 80000, 120, 20000, NULL, true, true, 14, 3, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at LIMIT 1),
'볼륨 래쉬', '풍성하고 화려한 볼륨 속눈썹', 'eyelash', 80000, 120000, 150, 30000, NULL, true, true, 14, 4, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at LIMIT 1),
'속눈썹 리터치', '기존 연장 속눈썹 보수', 'eyelash', 30000, 50000, 90, 10000, NULL, true, true, 21, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at LIMIT 1),
'속눈썹 펌', '자연스러운 컬링으로 눈매 강조', 'eyelash', 25000, 40000, 60, 5000, NULL, true, true, 7, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at LIMIT 1),
'속눈썹 제거', '안전한 속눈썹 연장 제거', 'eyelash', 15000, 25000, 45, NULL, NULL, true, true, 3, 1, '2시간 전까지 무료 취소');

-- Shop 6: 이태원 뷰티 클리닉 (Itaewon Beauty Clinic)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at OFFSET 1 LIMIT 1),
'러시안 볼륨', '섬세하고 자연스러운 러시안 볼륨 래쉬', 'eyelash', 100000, 150000, 180, 40000, NULL, true, true, 21, 6, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at OFFSET 1 LIMIT 1),
'컬러 래쉬', '포인트 컬러로 개성 표현', 'eyelash', 70000, 100000, 120, 25000, NULL, true, true, 14, 3, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at OFFSET 1 LIMIT 1),
'아이브로우 왁싱', '정확한 눈썹 라인 정리', 'eyelash', 20000, 30000, 30, NULL, 30, true, true, 7, 1, '2시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyelash' ORDER BY created_at OFFSET 1 LIMIT 1),
'래쉬 리프팅', '자연 속눈썹 리프팅과 팅팅', 'eyelash', 35000, 50000, 75, 10000, NULL, true, true, 14, 2, '24시간 전까지 무료 취소');

-- =====================================
-- WAXING SERVICES (왁싱 서비스)
-- =====================================

-- Shop 7: 강남 왁싱 클리닉 (Gangnam Waxing Clinic)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at LIMIT 1),
'다리 왁싱 (전체)', '다리 전체 왁싱으로 매끄러운 피부', 'waxing', 40000, 60000, 90, 15000, NULL, true, true, 14, 3, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at LIMIT 1),
'겨드랑이 왁싱', '겨드랑이 부위 완전 제모', 'waxing', 15000, 25000, 30, NULL, 30, true, true, 7, 2, '2시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at LIMIT 1),
'브라질리언 왁싱', '완전한 비키니 라인 왁싱', 'waxing', 60000, 90000, 60, 20000, NULL, true, true, 14, 4, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at LIMIT 1),
'얼굴 왁싱', '얼굴 전체 잔털 제거', 'waxing', 20000, 35000, 45, 5000, NULL, true, true, 7, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at LIMIT 1),
'팔 왁싱', '팔 전체 왁싱 서비스', 'waxing', 25000, 40000, 60, 8000, NULL, true, true, 10, 2, '24시간 전까지 무료 취소');

-- Shop 8: 홍대 스킨케어 (Hongdae Skincare)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at OFFSET 1 LIMIT 1),
'하프 레그 왁싱', '무릎 아래 다리 왁싱', 'waxing', 25000, 35000, 60, 8000, NULL, true, true, 10, 2, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at OFFSET 1 LIMIT 1),
'비키니 라인 왁싱', '비키니 라인 부분 왁싱', 'waxing', 30000, 45000, 45, 10000, NULL, true, true, 7, 3, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at OFFSET 1 LIMIT 1),
'전신 왁싱', '전신 완전 왁싱 패키지', 'waxing', 120000, 180000, 180, 50000, NULL, true, true, 21, 8, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'waxing' ORDER BY created_at OFFSET 1 LIMIT 1),
'눈썹 왁싱', '정확한 눈썹 모양 정리', 'waxing', 10000, 18000, 20, NULL, 30, true, true, 3, 1, '1시간 전까지 무료 취소');

-- =====================================
-- EYEBROW TATTOO SERVICES (눈썹 문신 서비스)
-- =====================================

-- Shop 9: 강남 반영구 클리닉 (Gangnam Semi-Permanent Clinic)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at LIMIT 1),
'아이브로우 문신', '자연스러운 눈썹 모양의 반영구 문신', 'eyebrow_tattoo', 150000, 300000, 180, 50000, NULL, true, true, 30, 12, '72시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at LIMIT 1),
'눈썹 리터치', '기존 눈썹 문신 보완 및 수정', 'eyebrow_tattoo', 80000, 150000, 120, 30000, NULL, true, true, 21, 8, '48시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at LIMIT 1),
'아이라인 문신', '자연스러운 아이라인 반영구 문신', 'eyebrow_tattoo', 120000, 250000, 150, 40000, NULL, true, true, 21, 8, '72시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at LIMIT 1),
'입술 문신', '자연스러운 입술 색상의 반영구 문신', 'eyebrow_tattoo', 180000, 350000, 200, 60000, NULL, true, true, 30, 12, '72시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at LIMIT 1),
'눈썹 디자인 상담', '개인 얼굴형에 맞는 눈썹 디자인 상담', 'eyebrow_tattoo', 20000, 30000, 60, NULL, NULL, true, true, 7, 2, '24시간 전까지 무료 취소');

-- Shop 10: 압구정 PMU 스튜디오 (Apgujeong PMU Studio)
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at OFFSET 1 LIMIT 1),
'3D 눈썹 문신', '입체적이고 자연스러운 3D 눈썹 문신', 'eyebrow_tattoo', 200000, 400000, 210, 80000, NULL, true, true, 30, 12, '72시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at OFFSET 1 LIMIT 1),
'파우더 브로우', '자연스러운 파우더 효과의 눈썹', 'eyebrow_tattoo', 180000, 320000, 180, 60000, NULL, true, true, 30, 12, '72시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at OFFSET 1 LIMIT 1),
'콤보 브로우', '모근과 파우더를 결합한 자연스러운 눈썹', 'eyebrow_tattoo', 220000, 380000, 240, 80000, NULL, true, true, 30, 12, '72시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'eyebrow_tattoo' ORDER BY created_at OFFSET 1 LIMIT 1),
'문신 제거 (레이저)', '기존 반영구 문신 레이저 제거', 'eyebrow_tattoo', 100000, 200000, 90, 30000, NULL, true, true, 14, 6, '48시간 전까지 무료 취소');

-- =====================================================
-- ADDITIONAL SERVICES FOR MORE VARIETY
-- =====================================================

-- Add some extra services to make some shops have more options

-- Extra nail services for variety
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at LIMIT 1),
'패키지 - 손+발 케어', '손톱과 발톱 케어를 함께 받는 패키지', 'nail', 35000, 60000, 150, 15000, NULL, true, true, 14, 3, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at OFFSET 1 LIMIT 1),
'웨딩 네일', '특별한 날을 위한 프리미엄 네일 아트', 'nail', 80000, 150000, 180, 30000, NULL, true, true, 30, 8, '72시간 전까지 무료 취소');

-- Extra hair services for variety
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'헤어 익스텐션', '자연스러운 헤어 길이 연장', 'hair', 150000, 300000, 240, 60000, NULL, true, true, 21, 12, '72시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at OFFSET 1 LIMIT 1),
'케라틴 트리트먼트', '모발 끝손상 복구 케라틴 케어', 'hair', 80000, 120000, 180, 25000, NULL, true, true, 14, 6, '48시간 전까지 무료 취소');

-- =====================================================
-- INACTIVE/UNAVAILABLE SERVICES FOR TESTING
-- =====================================================

-- Add some inactive or unavailable services to test filtering
INSERT INTO shop_services (shop_id, name, description, category, price_min, price_max, duration_minutes, deposit_amount, deposit_percentage, is_active, is_available, max_advance_booking_days, min_advance_booking_hours, cancellation_policy) VALUES
((SELECT id FROM shops WHERE category = 'nail' ORDER BY created_at LIMIT 1),
'시즌 한정 네일', '여름 시즌 한정 네일 아트 (현재 이용불가)', 'nail', 50000, 80000, 120, 20000, NULL, true, false, 14, 4, '24시간 전까지 무료 취소'),

((SELECT id FROM shops WHERE category = 'hair' ORDER BY created_at LIMIT 1),
'신규 서비스 준비중', '새로운 헤어 서비스 개발 중', 'hair', 60000, 100000, 120, 20000, NULL, false, false, 14, 4, '24시간 전까지 무료 취소');

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

-- Select summary to verify data insertion
SELECT
    s.name as shop_name,
    s.category as shop_category,
    COUNT(ss.id) as service_count,
    MIN(ss.price_min) as min_price,
    MAX(ss.price_max) as max_price
FROM shops s
LEFT JOIN shop_services ss ON s.id = ss.shop_id
GROUP BY s.id, s.name, s.category
ORDER BY s.category, s.name;

-- Total services added
SELECT
    category,
    COUNT(*) as total_services,
    COUNT(CASE WHEN is_active = true AND is_available = true THEN 1 END) as available_services
FROM shop_services
GROUP BY category
ORDER BY category;

-- Final count
SELECT 'Mock service data insertion completed!' as message,
       COUNT(*) as total_services_added
FROM shop_services;