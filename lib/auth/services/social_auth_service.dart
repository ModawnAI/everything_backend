import 'dart:io';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:google_sign_in/google_sign_in.dart';

enum SocialProvider { kakao, apple, google }

class SocialAuthService {
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  Future<String> signInWithKakao() async {
    try {
      bool isInstalled = await isKakaoTalkInstalled();
      
      OAuthToken token;
      if (isInstalled) {
        token = await UserApi.instance.loginWithKakaoTalk();
      } else {
        token = await UserApi.instance.loginWithKakaoAccount();
      }
      
      return token.accessToken;
    } catch (error) {
      throw Exception('Kakao login failed: $error');
    }
  }

  Future<String> signInWithApple() async {
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        webAuthenticationOptions: WebAuthenticationOptions(
          clientId: 'YOUR_APPLE_CLIENT_ID', // Replace with actual client ID
          redirectUri: Uri.parse('YOUR_REDIRECT_URI'), // Replace with actual URI
        ),
      );
      
      if (credential.identityToken != null) {
        return credential.identityToken!;
      } else {
        throw Exception('Apple ID token is null');
      }
    } catch (error) {
      throw Exception('Apple login failed: $error');
    }
  }

  Future<String> signInWithGoogle() async {
    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      
      if (googleUser == null) {
        throw Exception('Google sign in was cancelled');
      }

      final GoogleSignInAuthentication googleAuth = 
          await googleUser.authentication;
      
      if (googleAuth.idToken != null) {
        return googleAuth.idToken!;
      } else {
        throw Exception('Google ID token is null');
      }
    } catch (error) {
      throw Exception('Google login failed: $error');
    }
  }

  Future<void> signOut(SocialProvider provider) async {
    try {
      switch (provider) {
        case SocialProvider.kakao:
          await UserApi.instance.logout();
          break;
        case SocialProvider.apple:
          // Apple doesn't provide sign out
          break;
        case SocialProvider.google:
          await _googleSignIn.signOut();
          break;
      }
    } catch (error) {
      print('Error signing out from $provider: $error');
    }
  }

  String providerToString(SocialProvider provider) {
    switch (provider) {
      case SocialProvider.kakao:
        return 'kakao';
      case SocialProvider.apple:
        return 'apple';
      case SocialProvider.google:
        return 'google';
    }
  }
}