import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import '../api_service.dart';
import '../ui_utils.dart';
import '../main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  String _error = '';
  final ApiService api = ApiService();

  late AppLinks _appLinks;
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _initDeepLinks() {
    _appLinks = AppLinks();
    _linkSubscription = _appLinks.uriLinkStream.listen((uri) {
      if (uri.scheme == 'medicasign' && uri.host == 'auth-callback') {
        _handleDeepLink(uri);
      }
    });
  }

  Future<void> _handleDeepLink(Uri uri) async {
    final rawToken = uri.queryParameters['token'];
    if (rawToken == null) return;
    
    // Si on est déjà en train de charger (ex: polling), on ignore le deep link pour éviter les conflits
    if (_loading && i > 0) return; 

    await _finalizeLogin(rawToken.trim());
  }

  Future<void> _finalizeLogin(String token) async {
    setState(() { _loading = true; });
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('session_token', token);
      await prefs.setBool('has_session', true);
      
      ApiService().setToken(token); 
      await ApiService().getCurrentUser();
      
      // ✅ NEW: Close the in-app browser if it's still open
      try { await closeInAppWebView(); } catch (_) { /* ignore */ }
      
      if (!mounted) return;
      UiUtils.showSuccess(context, 'Connexion Google réussie !');
      
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) Navigator.pushReplacementNamed(context, '/dashboard');
      });
    } catch (e) {
      debugPrint('Login Finalization Error: $e');
      if (mounted) {
        if (e.toString().contains('401')) {
          Navigator.pushReplacementNamed(context, '/dashboard');
        } else {
          UiUtils.showError(context, 'Erreur de session : ${e.toString()}');
        }
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _doGoogleLogin() async {
    final sessionId = '${DateTime.now().millisecondsSinceEpoch}_${(DateTime.now().microsecond).toString()}';
    
    final authUrl = Uri.parse(
      '${ApiService.baseUrl}/auth/google?session_id=$sessionId'
    );
    
    setState(() { _loading = true; });
    
    try {
      // ✅ Integrated browser for automatic focus handling
      if (!await launchUrl(
        authUrl,
        mode: LaunchMode.inAppBrowserView,
      )) {
        throw Exception('Could not launch $authUrl');
      }
      
      // Poll for completion while the browser is open
      await _pollForGoogleToken(sessionId);
      
    } catch (e) {
      debugPrint('Google Login Error: $e');
      if (mounted) {
        UiUtils.showError(context, 'Erreur Google. Assurez-vous d\'avoir un navigateur à jour.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static int i = 0; // Temp counter for polling safety
  
  Future<void> _pollForGoogleToken(String sessionId) async {
    const maxAttempts = 60; 
    const pollInterval = Duration(milliseconds: 800);
    
    for (i = 0; i < maxAttempts; i++) {
      if (!mounted) return;
      try {
        final result = await ApiService().getGoogleExchangeToken(sessionId);
        
        if (result != null && result['token'] != null) {
          // Success! Finalize and the finalize function will close browser
          await _finalizeLogin(result['token']);
          return;
        }
      } catch (e) {
        // Continue
      }
      await Future.delayed(pollInterval);
    }
    
    if (mounted) {
      UiUtils.showError(context, 'Délai d\'authentification dépassé.');
    }
  }

  Future<void> _doLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = ''; });
    try {
      await api.login(_emailController.text.trim(), _passwordController.text.trim());
      if (!mounted) return;
      UiUtils.showSuccess(context, 'Connexion réussie. Bienvenue sur Médica-Sign.');
      Navigator.of(context).pushReplacementNamed('/dashboard');
    } catch (e) {
      final str = e.toString();
      if (str.startsWith('Exception: EMAIL_NOT_VERIFIED')) {
        final email = str.split(':').length > 1 ? str.split(':')[1] : _emailController.text.trim();
        await api.resendVerificationCode(email);
        if (!mounted) return;
        UiUtils.showInfo(context, 'Veuillez vérifier votre email pour continuer.');
        Navigator.of(context).pushReplacementNamed('/verify-email', arguments: email);
        return;
      }
      String friendlyError = 'Identifiants invalides ou erreur de connexion.';
      if (str.contains('401')) friendlyError = 'Email ou mot de passe incorrect.';
      if (str.contains('403')) friendlyError = 'Compte non vérifié ou désactivé.';
      
      setState(() => _error = friendlyError);
      if (mounted) UiUtils.showError(context, friendlyError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          _buildBackgroundDecor(),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: MediaQuery.of(context).size.height - 100),
                child: IntrinsicHeight(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildBrandHeader(),
                      const SizedBox(height: 48),
                      _buildLoginForm(),
                      const SizedBox(height: 24),
                      _buildForgotPassword(),
                      const SizedBox(height: 32),
                      _buildPrimaryButton(),
                      const SizedBox(height: 24),
                      _buildDivider(),
                      const SizedBox(height: 24),
                      _buildGoogleButton(),
                      const SizedBox(height: 40),
                      _buildFooter(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundDecor() {
    return Positioned(
      top: -100, right: -100,
      child: Container(
        width: 300, height: 300,
        decoration: BoxDecoration(
          color: const Color(0xFF0247AA).withOpacity(0.05),
          shape: BoxShape.circle,
        ),
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Column(
      children: [
        // Logo + Badge
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFF0247AA), Color(0xFF1565C0)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0247AA).withOpacity(0.25),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.verified_user_rounded, size: 40, color: Colors.white),
        ),
        const SizedBox(height: 24),
        const Text(
          'Médica-Sign',
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w900,
            color: Color(0xFF0247AA),
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Sécurité & Signature Numérique',
          style: TextStyle(
            fontSize: 14,
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }

  Widget _buildLoginForm() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          // Email field
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.alternate_email_rounded, color: Color(0xFF94A3B8), size: 20),
              hintText: 'Email professionnel',
              hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontWeight: FontWeight.w400),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Colors.red, width: 1.5),
              ),
            ),
            validator: (v) {
              if (v!.isEmpty) return 'Email requis';
              if (!v.contains('@')) return 'Email invalide';
              return null;
            },
          ),
          const SizedBox(height: 16),
          
          // Password field
          TextFormField(
            controller: _passwordController,
            obscureText: !_showPassword,
            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF94A3B8), size: 20),
              suffixIcon: GestureDetector(
                onTap: () => setState(() => _showPassword = !_showPassword),
                child: Icon(
                  _showPassword ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                  color: const Color(0xFF94A3B8),
                  size: 20,
                ),
              ),
              hintText: 'Mot de passe',
              hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontWeight: FontWeight.w400),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Colors.red, width: 1.5),
              ),
            ),
            validator: (v) => v!.isEmpty ? 'Mot de passe requis' : null,
          ),
        ],
      ),
    );
  }

  Widget _buildForgotPassword() {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: () => Navigator.of(context).pushNamed('/forgot-password'),
        style: TextButton.styleFrom(padding: EdgeInsets.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
        child: const Text(
          'Mot de passe oublié ?',
          style: TextStyle(
            color: Color(0xFF0247AA),
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildPrimaryButton() {
    return SizedBox(
      height: 54,
      child: ElevatedButton(
        onPressed: _loading ? null : _doLogin,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF0247AA),
          foregroundColor: Colors.white,
          disabledBackgroundColor: const Color(0xFF0247AA).withOpacity(0.6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
        ),
        child: _loading
            ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
            : const Text(
          'Se connecter',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.3),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Row(
      children: [
        const Expanded(child: Divider(color: Color(0xFFF1F5F9), height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'OU',
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF94A3B8),
            ),
          ),
        ),
        const Expanded(child: Divider(color: Color(0xFFF1F5F9), height: 1)),
      ],
    );
  }

  Widget _buildGoogleButton() {
    return SizedBox(
      height: 54,
      child: OutlinedButton.icon(
        onPressed: _loading ? null : _doGoogleLogin,
        icon: const Icon(Icons.g_mobiledata_rounded, color: Color(0xFF0F172A), size: 28),
        label: const Text(
          'Continuer avec Google',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 15),
        ),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Nouveau ici ? ', style: TextStyle(color: Color(0xFF64748B), fontSize: 14)),
            GestureDetector(
              onTap: () => Navigator.of(context).pushNamed('/register'),
              child: const Text(
                'Créer un compte',
                style: TextStyle(
                  color: Color(0xFF0247AA),
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 32),
        const Text(
          'Propulsé par Mediacom',
          style: TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }
}
