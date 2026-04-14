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
  // Si on a un token, on va au dashboard (l'API gérera si le token est expiré)
  late String initialRoute;
  if (sessionToken != null && sessionToken.isNotEmpty) {
    initialRoute = '/dashboard';
    // Si on a une session, l'onboarding est forcément considéré comme fait
    if (!onboardingDone) await prefs.setBool('onboarding_done', true);
  } else if (!onboardingDone) {
    initialRoute = '/onboarding';
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
