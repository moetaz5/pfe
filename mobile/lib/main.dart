import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'notification_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/verify_email_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/onboarding_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Vérifie si l'onboarding a déjà été vu
  final prefs = await SharedPreferences.getInstance();
  final onboardingDone = prefs.getBool('onboarding_done') ?? false;

  runApp(MyApp(showOnboarding: !onboardingDone));
}

class MyApp extends StatefulWidget {
  final bool showOnboarding;
  const MyApp({super.key, required this.showOnboarding});

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {

  @override
  void initState() {
    super.initState();
    // Demande permissions notifications après le premier rendu
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = MyApp.navigatorKey.currentContext;
      if (ctx != null) {
        NotificationService.requestPermissionIfNeeded(ctx);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    const Color kPrimaryBlue = Color(0xFF0247AA);

    return MaterialApp(
      navigatorKey: MyApp.navigatorKey,
      title: 'Médica-Sign',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        primaryColor: kPrimaryBlue,
        colorScheme: ColorScheme.fromSeed(seedColor: kPrimaryBlue),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      // 🔑 Premier lancement → Onboarding, sinon → Login
      home: widget.showOnboarding
          ? const OnboardingScreen()
          : const LoginScreen(),
      routes: {
        '/onboarding': (context) => const OnboardingScreen(),
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/verify-email': (context) => const VerifyEmailScreen(),
        '/forgot-password': (context) => const ForgotPasswordScreen(),
        '/dashboard': (context) => const DashboardScreen(),
        '/profile': (context) =>
            ProfileScreen(user: null, subPage: 'info'),
      },
    );
  }
}
