# Ebeautything Flutter App - Comprehensive Development Guide

## 🏗️ Architecture Overview

### **Project Structure & Organization**

#### **Recommended Folder Structure**
```
lib/
├── core/
│   ├── constants/
│   ├── errors/
│   ├── network/
│   ├── utils/
│   ├── extensions/
│   └── themes/
├── data/
│   ├── datasources/
│   ├── models/
│   ├── repositories/
│   └── enums/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── usecases/
├── presentation/
│   ├── pages/
│   ├── widgets/
│   ├── blocs/
│   └── providers/
├── services/
├── di/
└── main.dart
```

#### **State Management Architecture**
- **Primary**: BLoC pattern with flutter_bloc for state management
- **Local**: setState for simple widget-specific state
- **Global**: Provider for app-wide state and dependency injection

#### **Clean Architecture Implementation**
- **Presentation Layer**: UI components, BLoCs, and user interaction handlers
- **Domain Layer**: Business logic, entities, and use cases
- **Data Layer**: Repository implementations, data sources, and models

### **Core Dependencies & Packages**

#### **Essential Packages**
- `supabase_flutter`: Primary backend integration
- `flutter_bloc`: State management
- `provider`: Dependency injection and state
- `go_router`: Simple navigation management
- `json_annotation`: JSON serialization

#### **UI & UX Packages**
- `cached_network_image`: Image caching
- `image_picker`: Camera and gallery access
- `geolocator`: Location services
- `permission_handler`: Runtime permissions

#### **Platform-Specific Packages**
- `firebase_messaging`: Push notifications
- `url_launcher`: Phone calling functionality

## 📱 Core App Implementation

### **1. App Initialization & Setup**

#### **Main App Configuration**
- **Theme Configuration**: Simple light/dark theme support
- **Language**: Korean only - fixed language setting
- **Error Handling**: Basic error handling with user-friendly messages

#### **Supabase Integration Setup**
- **Client Initialization**: Basic Supabase client configuration
- **Authentication**: Supabase Auth for social login and session management
- **Storage**: Basic image upload functionality

#### **Permission Management**
- **Location Services**: GPS location for shop discovery
- **Camera/Gallery**: Profile picture and review photo upload
- **Notifications**: Push notification permissions

### **2. Authentication & User Management**

#### **Social Authentication Implementation**

##### **Supabase Authentication Integration**
- **Kakao Login**: Configure Kakao provider through Supabase Auth with proper app keys and URL schemes
- **Apple Sign-In**: Set up Apple provider through Supabase Auth with proper certificates and Sign in with Apple capability
- **Google Sign-In**: Configure Google provider through Supabase Auth with proper OAuth scopes
- **Token Management**: Supabase handles token management, refresh logic, and secure storage automatically
- **Profile Data Mapping**: Map provider profile fields to app user model through Supabase Auth
- **Error Handling**: Handle authentication failures, user cancellations, and invalid credentials
- **Session Management**: Leverage Supabase's built-in session management and persistence

#### **Phone Verification System**

##### **PASS인증 Integration**
- **PASS인증 SDK Setup**: Configure PASS인증 SDK with proper certificates and app registration
- **Identity Verification Flow**: Implement secure identity verification through PASS인증 service
- **Korean Phone Number Validation**: Support Korean phone number format validation (010-XXXX-XXXX)
- **Verification Result Handling**: Process verification results and map to user profile
- **Error Handling**: Handle verification failures, cancellations, and network issues
- **Security Compliance**: Ensure compliance with Korean identity verification regulations

##### **UI/UX Implementation**
- **Korean Phone Input**: Korean phone number input with proper formatting (010-XXXX-XXXX)
- **PASS인증 Flow**: Seamless integration with PASS인증 verification interface
- **Verification Status**: Clear indication of verification progress and completion
- **Error States**: Korean language error messaging for verification issues
- **Accessibility**: Screen reader support and proper focus management for Korean users

#### **User Profile Management**

##### **Profile Creation Flow**
- **Progressive Disclosure**: Step-by-step profile completion with progress indication
- **Data Validation**: Real-time validation for name, birth date, and gender selection
- **Image Upload**: Profile picture selection with cropping and compression
- **Referral Code Entry**: Optional referral code input with validation and rewards explanation
- **Terms Acceptance**: Clear presentation of terms and privacy policy with tracking

##### **Profile Editing Capabilities**
- **Field Modification**: Allow editing of changeable fields while protecting sensitive data
- **Image Management**: Replace profile pictures with proper deletion of old images
- **Privacy Controls**: Granular privacy settings for profile visibility
- **Account Deletion**: Secure account deletion flow with data export option
- **Audit Trail**: Track profile changes for security and support purposes

### **3. Home Screen & Navigation**

#### **Bottom Navigation Implementation**

##### **Tab Structure**
- **Four Main Tabs**: Home, Search, Reservations, Profile
- **Badge System**: Basic notification badges for new messages
- **Simple Navigation**: Standard tab switching with basic animations

##### **Navigation Management**
- **Back Stack**: Standard back navigation
- **Push Notifications**: Navigate to relevant screens from notifications

#### **Home Screen Layout & Components**

##### **Location-Based Shop Discovery**
- **Location Detection**: Basic GPS location detection
- **Shop Listing**: Simple list prioritizing partnered shops (shop_type = 'partnered')
- **Pagination**: Load 30 shops per page as specified
- **Pull-to-Refresh**: Basic refresh functionality

##### **Search Functionality**
- **Text Search**: Simple search by shop name or service
- **Recent Searches**: Store recent search terms
- **Basic Filters**: Filter by service category (nail, eyelash, waxing, eyebrow_tattoo)

##### **Category Navigation**
- **Service Categories**: Filter shops by main service categories from enum
- **Visual Design**: Simple icon-based category selection

### **4. Shop Discovery & Search**

#### **Basic Search Implementation**

##### **Search Input**
- **Text Search**: Search shops by name or service type
- **Search Debouncing**: Reduce API calls with input debouncing

##### **Filter & Sort System**
- **Basic Filtering**: Filter by service_category enum (nail, eyelash, waxing, eyebrow_tattoo)
- **Sort Options**: Distance, rating, shop_type (partnered first)

##### **Search Results**
- **List View**: Simple list of shop cards
- **Shop Cards**: Name, rating, distance, partnership status
- **Loading States**: Basic loading indicators

#### **Location Features**

##### **GPS Integration**
- **Current Location**: Get user's current location for distance calculations
- **Distance Display**: Show distance to each shop

### **5. Shop Detail Screen**

#### **Shop Information**

##### **Basic Shop Profile**
- **Shop Images**: Simple image gallery from shop_images table
- **Essential Info**: Name, rating, address, phone, operating_hours (JSONB)
- **Partnership Badge**: Show shop_type (partnered/non_partnered)
- **Quick Actions**: Call, favorite, book service

##### **Service Catalog**
- **Service List**: Display shop_services with name, description, price_min/max
- **Service Categories**: Group by category enum (nail, eyelash, waxing, eyebrow_tattoo)
- **Booking Button**: Direct booking for each service

##### **Reviews Display**
- **Review List**: Show reviews with rating, content, is_verified_visit
- **Rating Summary**: Display average_rating and total_reviews from shops table
- **User Reviews**: Display reviewer name (unless is_anonymous)

#### **Basic Actions**

##### **Communication**
- **Phone Call**: Direct calling using url_launcher
- **Favorite**: Add/remove from user_favorites table

##### **Booking**
- **Service Selection**: Choose services for booking
- **Reservation Flow**: Navigate to reservation creation screen

### **6. Reservation System**

#### **Basic Booking Flow**

##### **Service Selection**
- **Service List**: Select services from shop_services table
- **Quantity Selection**: Choose quantity for each service
- **Price Calculation**: Calculate total_amount from service prices

##### **Date & Time Selection**
- **Calendar Widget**: Simple calendar for date selection
- **Time Slots**: Basic time slot selection
- **Duration**: Show duration_minutes from service

##### **Payment Processing**
- **Payment Methods**: Support payment_method enum (toss_payments, kakao_pay, card)
- **Deposit Payment**: Handle deposit_amount from service settings
- **Points Usage**: Optional points redemption with available_points check

#### **Reservation Management**

##### **Reservation Status**
- **Status Display**: Show reservation_status (requested, confirmed, completed, etc.)
- **Status Updates**: Basic status tracking from reservations table

##### **Basic Actions**
- **View Reservations**: List user's reservations with status
- **Cancellation**: Simple cancellation flow updating status to cancelled_by_user

### **7. Points & Rewards System**

#### **Points Display**

##### **Points Dashboard**
- **Balance Display**: Show total_points and available_points from users table
- **Transaction History**: List from point_transactions table
- **Point Status**: Display point_status (pending, available, used, expired)

##### **Referral Program**
- **Referral Code**: Display user's referral_code from users table
- **Referral Tracking**: Show total_referrals and successful_referrals
- **Influencer Status**: Display is_influencer status and qualification progress
- **Code Sharing**: Basic sharing of referral code

#### **Points Usage**

##### **Redemption**
- **Point Usage**: Use available points during payment
- **Balance Check**: Verify available_points before usage
- **Transaction Recording**: Create point_transaction with type 'used_service'

##### **Point Earning**
- **Service Points**: Earn points from completed reservations (transaction_type: 'earned_service')
- **Referral Points**: Earn from successful referrals (transaction_type: 'earned_referral')
- **Influencer Bonus**: 2x multiplier for influencers (transaction_type: 'influencer_bonus')

### **8. Reviews System**

#### **Review Creation**

##### **Post-Service Review**
- **Review Form**: Create reviews after completed reservations
- **Rating System**: 1-5 star rating system
- **Review Content**: Title and content text fields
- **Photo Upload**: Optional review images to review_images table
- **Anonymous Option**: is_anonymous toggle for privacy

#### **Review Display**

##### **Shop Reviews**
- **Review List**: Display reviews for each shop
- **Verified Badge**: Show is_verified_visit for reservation-linked reviews
- **Review Images**: Display photos from review_images table
- **Helpful Votes**: Basic helpful voting system

### **10. User Profile & Settings**

#### **Profile Management**

##### **Profile Display**
- **Profile Header**: profile_image_url, name, is_influencer badge from users table
- **Statistics**: total_points, total_referrals, reservation count
- **Basic Info**: Display user data (name, phone_number, gender, birth_date)

##### **Settings**
- **Notification Preferences**: Basic notification toggles from user_settings table
- **Theme Selection**: theme_preference (light/dark)
- **Account Actions**: Update profile, logout

#### **Basic Account Management**

##### **Profile Editing**
- **Update Info**: Edit name, profile picture
- **Phone Verification**: PASS인증 for phone_number updates
- **Privacy Settings**: Basic privacy controls

### **11. Notifications System**

#### **Push Notifications**

##### **Firebase Setup**
- **FCM Integration**: Basic Firebase Cloud Messaging setup
- **Token Management**: Store FCM tokens in push_tokens table
- **Notification Handling**: Handle incoming notifications

##### **Notification Types**
- **Reservation Updates**: reservation_confirmed, reservation_cancelled
- **Point Notifications**: point_earned
- **System Notifications**: System announcements
(Based on notification_type enum)

#### **In-App Notifications**

##### **Notification List**
- **Notification Display**: Show notifications from notifications table
- **Status Management**: Handle notification_status (unread, read)
- **Basic Actions**: Mark as read, delete notifications

## 🔧 Technical Implementation Details

### **State Management**

#### **BLoC Pattern**
- **Event-Driven**: Separate UI events from business logic
- **State Classes**: Simple state classes for loading, success, error
- **Error Handling**: Basic error handling with user messages

#### **Data Architecture**
- **Repository Pattern**: Abstract Supabase data access
- **Models**: JSON models matching database schema
- **Dependency Injection**: Basic Provider setup

### **Database Integration**

#### **Supabase Models**
- **User Model**: Match users table structure with user_status, user_role enums
- **Shop Model**: Match shops table with shop_status, shop_type, service_category enums  
- **Reservation Model**: Match reservations table with reservation_status, payment_status enums
- **Point Transaction Model**: Match point_transactions table with point_transaction_type, point_status enums

#### **Key Enums Usage**
- **Service Categories**: nail, eyelash, waxing, eyebrow_tattoo (from @Enum.txt)
- **Reservation Status**: requested, confirmed, completed, cancelled_by_user, cancelled_by_shop
- **Payment Methods**: toss_payments, kakao_pay, card (from payment_method enum)
- **Notification Types**: reservation_confirmed, point_earned (from notification_type enum)