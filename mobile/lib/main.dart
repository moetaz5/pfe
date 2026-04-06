import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/verify_email_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/profile_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_service.dart';

// Web OAuth Client ID (Google Cloud Console → Credentials → Web application)
const String kGoogleWebClientId =
    '44156546623-r6d6n0afs5jsfehq5j2ojvhv5unm452i.apps.googleusercontent.com';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _isLoggedIn = false;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    debugPrint('*** APP START: CHECKING AUTH ***');
    try {
      final prefs = await SharedPreferences.getInstance();
      final hasSession = prefs.getBool('has_session') ?? false;
      
      if (hasSession) {
        debugPrint('Session local found. validating with Server...');
        // On donne un délai court pour la validation, sinon on laisse passer
        await ApiService().getCurrentUser().timeout(const Duration(seconds: 3));
        debugPrint('Session validated.');
        setState(() => _isLoggedIn = true);
      } else {
        debugPrint('No session found.');
        setState(() => _isLoggedIn = false);
      }
    } catch (e) {
      debugPrint('Auth check error (normal if offline/unauthorized): $e');
      setState(() => _isLoggedIn = false); 
    } finally {
      debugPrint('Auth check finished.');
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Mediacom Color Palette
    const Color kPrimaryBlue = Color(0xFF0247AA);
    const Color kSecondaryBlue = Color(0xFF497BC1);
    const Color kAccentBlue = Color(0xFFA0BADF);
    
    return MaterialApp(
      navigatorKey: MyApp.navigatorKey,
      title: 'Médica-Sign Premium',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Inter',
        colorScheme: ColorScheme.fromSeed(
          seedColor: kPrimaryBlue,
          primary: kPrimaryBlue,
          secondary: kSecondaryBlue,
          surface: Colors.white,
          background: const Color(0xFFF8FAFC),
          outline: const Color(0xFFE2E8F0),
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        textTheme: const TextTheme(
          displayLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: kPrimaryBlue, letterSpacing: -1),
          titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: kPrimaryBlue),
          bodyLarge: TextStyle(fontSize: 16, color: Color(0xFF475569), height: 1.5),
          labelSmall: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8)),
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: const BorderSide(color: Color(0xFFE2E8F0))),
          color: Colors.white,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: kPrimaryBlue,
          elevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kPrimaryBlue, letterSpacing: -0.5),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: kPrimaryBlue, width: 2)),
          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            elevation: 0,
            backgroundColor: kPrimaryBlue,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: kPrimaryBlue,
            textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 0.5),
          ),
        ),
      ),
      home: _checking
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : (_isLoggedIn ? const DashboardScreen() : const LoginScreen()),
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
