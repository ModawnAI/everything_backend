Part 1: Missing Platform Admin (Superadmin) Endpoints
These endpoints are required for the superadmin to manage the entire platform, its users, shops, and business rules. The current implementation is heavily skewed towards analytics and is missing almost all management and configuration functionalities.

1.1. Member Management (회원 관리)
Context: The current /admin/users is a read-only list. The admin cannot perform any management actions.

Missing Endpoints:

Get User Details: While /admin/users exists, a more detailed endpoint for a single user is needed to view their referral history and payment status.

GET /admin/users/:userId

Response Should Include: Full profile, point balance, referral list (with is_first_payment_completed status for each referred user).

Update User Status (Suspend/Activate):

PUT /admin/users/:userId/status

Request Body: { "status": "active" | "suspended", "reason": "Violation of terms of service." }

Update User Role (Assign/Remove Influencer):

PUT /admin/users/:userId/role

Request Body: { "role": "user" | "influencer" }

Manually Adjust Points: Critical for customer service and event rewards.

POST /admin/users/:userId/points/adjustment

Request Body: { "amount": 5000, "type": "credit" | "debit", "reason": "Customer complaint resolution bonus." }

1.2. Shop Management (뷰티샵 관리)
Context: The admin can list shops but cannot manage the application lifecycle or edit shop details on their behalf.

Missing Endpoints:

List Pending Shop Applications:

GET /admin/shop-applications?status=pending

Get Single Application Details:

GET /admin/shop-applications/:applicationId

Approve a Shop Application:

POST /admin/shop-applications/:applicationId/approve

Action: This endpoint should create a new shop entity, create a Shop Admin user account, and send a confirmation email.

Reject a Shop Application:

POST /admin/shop-applications/:applicationId/reject

Request Body: { "reason": "Incomplete documentation." }

Update any Shop's Information: For administrative correction purposes.

PUT /admin/shops/:shopId

Request Body: A complete JSON object of the shop's editable details.

1.3. Point System Management (포인트 정책 및 로그 관리)
Context: The entire configuration module for this core business logic is missing.

Missing Endpoints:

Get Point Policy:

GET /admin/settings/points-policy

Response: { "earning_rate_percent": 2.5, "earning_cap_amount": 300000, "usage_availability_delay_days": 7, "influencer_referral_multiplier": 2 }

Update Point Policy:

PUT /admin/settings/points-policy

Request Body: The same structure as the GET response.

View Point Adjustment Audit Log: Essential for tracking manual changes.

GET /admin/logs/point-adjustments

Query Params: ?userId=:id, ?adminId=:id, ?dateRange=...

Response: A list of all manual point changes, including which admin made them, for which user, the amount, and the reason.

1.4. Content (Feed) Moderation (콘텐츠 관리)
Context: The spec requires admins to be able to moderate the feed. The current endpoints are likely for users to view the feed.

Missing Endpoints:

Search/Filter All Posts:

GET /admin/feed/posts

Query Params: ?userId=:id, ?taggedShopId=:id, ?keyword=...

Delete a Post: The core moderation action.

DELETE /admin/feed/posts/:postId

Request Body: { "reason": "Inappropriate content." }

1.5. Push Notification Management (푸시 발송 관리)
Context: This entire functional module is missing from the endpoint list.

Missing Endpoints:

Send a Push Notification:

POST /admin/notifications/dispatch

Request Body: { "target": "all" | "influencers" | "custom_user_ids", "userIds": [...], "title": "New Event!", "body": "Check out our new summer promotion.", "link": "/events/summer-2025" }

1.6. System Configuration & Monitoring (시스템 설정)
Context: Basic platform settings and controls are missing.

Missing Endpoints:

Get System Settings:

GET /admin/settings/system

Response: { "app_version": "3.2.0", "maintenance_mode_enabled": false, "maintenance_message": "..." }

Update System Settings (Enable Maintenance Mode):

PUT /admin/settings/system

Request Body: The same structure as the GET response.

Manage API Keys (Toss Payments, etc.):

GET /admin/settings/apikeys

PUT /admin/settings/apikeys

1.7. Financials, Payments, and Security (Known Missing)
Context: Your report already correctly identifies these as unimplemented. For exhaustiveness, they are listed here.

Missing Endpoint Groups:

/admin/financial/* (Overview, Settlements, Reconciliation)

/admin/payments/* (List, Fraud, Disputes)

/admin/security/* (Stats, Events)

/admin/analytics/auth/stats

Part 2: Missing Shop Admin Endpoints
These endpoints are absolutely critical for a shop owner to use the platform. Without them, the Shop Admin dashboard is non-functional.

2.1. Reservation Management (예약 관리) - CRITICAL
Context: This is the most severe gap. The shop owner cannot perform their primary job of managing bookings.

Missing Endpoints:

Confirm a Reservation Request:

POST /shop/reservations/:reservationId/confirm

Action: Changes reservation status from pending to confirmed. Sends a push notification to the user.

Reject a Reservation Request:

POST /shop/reservations/:reservationId/reject

Request Body: { "reason": "Time slot is unavailable." }

Action: Changes status to rejected. Sends a push notification.

Mark Service as Complete:

POST /shop/reservations/:reservationId/complete

Action: Changes status to service_completed. Unlocks the ability to request final payment.

Request Final (Remainder) Payment:

POST /shop/reservations/:reservationId/request-payment

Action: Triggers a notification/payment request to the user for the remaining balance.

2.2. Shop & Service Catalog Management (내 샵 및 서비스 관리)
Context: The Shop Admin cannot update their own business information or the services they offer.

Missing Endpoints:

Get My Shop Profile:

GET /shop/profile

Update My Shop Profile:

PUT /shop/profile

Request Body: { "name": "...", "description": "...", "photos": [...], "kakao_channel_url": "...", "bank_account": {...} }

Add a New Service:

POST /shop/services

Request Body: { "name": "Gel Nails", "price": 50000, "duration_minutes": 60 }

Update an Existing Service:

PUT /shop/services/:serviceId

Delete a Service:

DELETE /shop/services/:serviceId

2.3. Customer Management (고객 관리) - CRITICAL
Context: This entire module is missing. It's a key retention tool for shop owners.

Missing Endpoints:

List My Customers:

GET /shop/customers

Response: A list of users who have completed a reservation at the shop.

Get Specific Customer Details:

GET /shop/customers/:customerId

Response: Customer info, complete visit history, total amount spent, private notes.

Add/Update a Private Note for a Customer:

POST /shop/customers/:customerId/notes

PUT /shop/customers/:customerId/notes/:noteId

Request Body: { "text": "Prefers light colors. Allergic to almond oil." }

2.4. Financials & Settlements (정산 관리)
Context: The Shop Admin has no way to track their earnings or settlements.

Missing Endpoints:

Get My Settlement History:

GET /shop/settlements

Response: A list of past and upcoming settlement payouts.

Get Settlement Details:

GET /shop/settlements/:settlementId

Response: A detailed breakdown of all transactions included in that specific settlement.th