import 'user_model.dart';

class AuthResponse {
  final bool success;
  final String? accessToken;
  final String? refreshToken;
  final UserModel? user;
  final bool isNewUser;
  final String? message;

  AuthResponse({
    required this.success,
    this.accessToken,
    this.refreshToken,
    this.user,
    required this.isNewUser,
    this.message,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      success: json['success'] ?? false,
      accessToken: json['data']?['accessToken'],
      refreshToken: json['data']?['refreshToken'],
      user: json['data']?['user'] != null 
          ? UserModel.fromJson(json['data']['user']) 
          : null,
      isNewUser: json['data']?['isNewUser'] ?? false,
      message: json['message'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'data': {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'user': user?.toJson(),
        'isNewUser': isNewUser,
      },
      'message': message,
    };
  }
}

class SocialLoginRequest {
  final String provider;
  final String token;
  final String? fcmToken;
  final DeviceInfo deviceInfo;

  SocialLoginRequest({
    required this.provider,
    required this.token,
    this.fcmToken,
    required this.deviceInfo,
  });

  Map<String, dynamic> toJson() {
    return {
      'provider': provider,
      'token': token,
      'fcmToken': fcmToken,
      'deviceInfo': deviceInfo.toJson(),
    };
  }
}

class DeviceInfo {
  final String platform;
  final String version;
  final String deviceId;

  DeviceInfo({
    required this.platform,
    required this.version,
    required this.deviceId,
  });

  Map<String, dynamic> toJson() {
    return {
      'platform': platform,
      'version': version,
      'deviceId': deviceId,
    };
  }
}