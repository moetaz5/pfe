import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/verify_email_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/profile_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    // Palette MÉDICA-SIGN
    const Color kPrimaryBlue = Color(0xFF0247AA);

    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Médica-Sign Premium',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        primaryColor: kPrimaryBlue,
        colorScheme: ColorScheme.fromSeed(seedColor: kPrimaryBlue),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      // Navigation directe vers le Login
      home: const LoginScreen(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/verify-email': (context) => const VerifyEmailScreen(),
        '/forgot-password': (context) => const ForgotPasswordScreen(),
        '/dashboard': (context) => const DashboardScreen(),
        '/profile': (context) => ProfileScreen(user: null, subPage: 'info'),
      },
    );
  }
}
