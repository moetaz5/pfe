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

import 'api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialisation du service API de manière synchrone avant de démarrer l'app
  await ApiService.init();

  // ✅ NEW: Vérifie si l'utilisateur a déjà une session active
  final prefs = await SharedPreferences.getInstance();
  final hasSession = prefs.getBool('has_session') ?? false;
  final sessionToken = prefs.getString('session_token');
  
  // Vérifie aussi l'onboarding
  final onboardingDone = prefs.getBool('onboarding_done') ?? false;

  // 🔑 Détermine l'écran initial
  // 1. Si pas d'onboarding: show onboarding
  // 2. Si session active + onboarding done: show dashboard
  // 3. Sinon: show login
  late String initialRoute;
  if (!onboardingDone) {
    initialRoute = '/onboarding';
  } else if (hasSession && sessionToken != null && sessionToken.isNotEmpty) {
    initialRoute = '/dashboard';
  } else {
    initialRoute = '/login';
  }

  runApp(MyApp(initialRoute: initialRoute));
}

class MyApp extends StatefulWidget {
  final String initialRoute;
  const MyApp({super.key, required this.initialRoute});

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {

  @override
  void initState() {
    super.initState();
    
    // ✅ NEW: Initialiser le service de notifications background
    NotificationService.initialize();  // This calls _startBackgroundListener() internally
    
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
      // 🔑 Utilise initialRoute pour navigation intelligente
      initialRoute: widget.initialRoute,
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
