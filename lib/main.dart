import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'auth/bloc/auth_bloc.dart';
import 'auth/repositories/auth_repository.dart';
import 'auth/services/social_auth_service.dart';
import 'auth/services/token_service.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/main_screen.dart';
import 'screens/registration_screen.dart';
import 'core/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Kakao SDK
  KakaoSdk.init(
    nativeAppKey: 'YOUR_KAKAO_NATIVE_APP_KEY', // Replace with actual key
    javaScriptAppKey: 'YOUR_KAKAO_JAVASCRIPT_APP_KEY', // Replace with actual key
  );
  
  // Initialize Firebase Messaging
  await FirebaseMessaging.instance.requestPermission();
  
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (context) => AuthBloc(
            authRepository: AuthRepository(
              socialAuthService: SocialAuthService(),
              tokenService: TokenService(),
            ),
          )..add(AuthSessionCheckRequested()),
        ),
      ],
      child: MaterialApp(
        title: 'Evuriting App',
        theme: ThemeData(
          primarySwatch: Colors.orange,
          visualDensity: VisualDensity.adaptivePlatformDensity,
        ),
        onGenerateRoute: AppRouter.generateRoute,
        home: SplashScreen(),
      ),
    );
  }
}