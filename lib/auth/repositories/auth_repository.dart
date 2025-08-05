import 'dart:io';
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../models/auth_response.dart';
import '../models/user_model.dart';
import '../services/social_auth_service.dart';
import '../services/token_service.dart';
import '../../core/api_client.dart';

class AuthRepository {
  final SocialAuthService socialAuthService;
  final TokenService tokenService;
  final ApiClient _apiClient = ApiClient();

  AuthRepository({
    required this.socialAuthService,
    required this.tokenService,
  });

  Future<AuthResponse> socialLogin(SocialProvider provider) async {
    try {
      String token;
      String providerString = socialAuthService.providerToString(provider);

      // Get social provider token
      switch (provider) {
        case SocialProvider.kakao:
          token = await socialAuthService.signInWithKakao();
          break;
        case SocialProvider.apple:
          token = await socialAuthService.signInWithApple();
          break;
        case SocialProvider.google:
          token = await socialAuthService.signInWithGoogle();
          break;
      }

      // Get FCM token
      String? fcmToken = await FirebaseMessaging.instance.getToken();

      // Get device info
      DeviceInfo deviceInfo = await _getDeviceInfo();

      // Create request
      final request = SocialLoginRequest(
        provider: providerString,
        token: token,
        fcmToken: fcmToken,
        deviceInfo: deviceInfo,
      );

      // Call backend API
      final response = await _apiClient.post(
        '/api/auth/social-login',
        data: request.toJson(),
      );

      final authResponse = AuthResponse.fromJson(response.data);

      // Save tokens if login successful
      if (authResponse.success && 
          authResponse.accessToken != null && 
          authResponse.refreshToken != null &&
          authResponse.user != null) {
        await tokenService.saveTokens(
          accessToken: authResponse.accessToken!,
          refreshToken: authResponse.refreshToken!,
          user: authResponse.user!,
          fcmToken: fcmToken,
        );
      }

      return authResponse;
    } catch (e) {
      throw Exception('Social login failed: $e');
    }
  }

  Future<AuthResponse> refreshToken() async {
    try {
      final refreshToken = await tokenService.getRefreshToken();
      if (refreshToken == null) {
        throw Exception('No refresh token available');
      }

      final response = await _apiClient.post(
        '/api/auth/refresh-token',
        data: {'refreshToken': refreshToken},
      );

      final authResponse = AuthResponse.fromJson(response.data);

      // Update access token
      if (authResponse.success && authResponse.accessToken != null) {
        await tokenService.updateAccessToken(authResponse.accessToken!);
      }

      return authResponse;
    } catch (e) {
      throw Exception('Token refresh failed: $e');
    }
  }

  Future<bool> verifySession() async {
    try {
      final isValid = await tokenService.isTokenValid();
      if (!isValid) return false;

      final response = await _apiClient.get('/api/auth/verify-session');
      return response.data['success'] == true;
    } catch (e) {
      return false;
    }
  }

  Future<UserModel?> getUserProfile() async {
    try {
      // First try to get from local storage
      final localUser = await tokenService.getUserData();
      if (localUser != null) return localUser;

      // If not found locally, fetch from API
      final response = await _apiClient.get('/api/auth/profile');
      if (response.data['success'] == true) {
        return UserModel.fromJson(response.data['data']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<UserModel?> updateUserProfile(Map<String, dynamic> updates) async {
    try {
      final response = await _apiClient.put(
        '/api/auth/profile',
        data: updates,
      );

      if (response.data['success'] == true) {
        final updatedUser = UserModel.fromJson(response.data['data']);
        
        // Update local storage
        final accessToken = await tokenService.getAccessToken();
        final refreshToken = await tokenService.getRefreshToken();
        final fcmToken = await tokenService.getFcmToken();
        
        if (accessToken != null && refreshToken != null) {
          await tokenService.saveTokens(
            accessToken: accessToken,
            refreshToken: refreshToken,
            user: updatedUser,
            fcmToken: fcmToken,
          );
        }
        
        return updatedUser;
      }
      return null;
    } catch (e) {
      throw Exception('Profile update failed: $e');
    }
  }

  Future<AuthResponse> completeRegistration(Map<String, dynamic> registrationData) async {
    try {
      final response = await _apiClient.post(
        '/api/auth/register',
        data: registrationData,
      );

      final authResponse = AuthResponse.fromJson(response.data);

      // Update local user data if registration successful
      if (authResponse.success && authResponse.user != null) {
        final accessToken = await tokenService.getAccessToken();
        final refreshToken = await tokenService.getRefreshToken();
        final fcmToken = await tokenService.getFcmToken();
        
        if (accessToken != null && refreshToken != null) {
          await tokenService.saveTokens(
            accessToken: accessToken,
            refreshToken: refreshToken,
            user: authResponse.user!,
            fcmToken: fcmToken,
          );
        }
      }

      return authResponse;
    } catch (e) {
      throw Exception('Registration completion failed: $e');
    }
  }

  Future<void> logout() async {
    try {
      // Try to call logout endpoint
      try {
        await _apiClient.post('/api/auth/logout');
      } catch (e) {
        // Continue with local logout even if API call fails
        print('API logout failed: $e');
      }

      // Clear local tokens
      await tokenService.clearTokens();
    } catch (e) {
      throw Exception('Logout failed: $e');
    }
  }

  Future<DeviceInfo> _getDeviceInfo() async {
    final deviceInfoPlugin = DeviceInfoPlugin();
    
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfoPlugin.androidInfo;
      return DeviceInfo(
        platform: 'android',
        version: '1.0.0', // App version
        deviceId: androidInfo.id,
      );
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfoPlugin.iosInfo;
      return DeviceInfo(
        platform: 'ios',
        version: '1.0.0', // App version
        deviceId: iosInfo.identifierForVendor ?? 'unknown',
      );
    } else {
      return DeviceInfo(
        platform: 'unknown',
        version: '1.0.0',
        deviceId: 'unknown',
      );
    }
  }
}