import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import '../api_service.dart';
import '../ui_utils.dart';

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
    final token = uri.queryParameters['token'];
    if (token == null) return;

    setState(() { _loading = true; });
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('session_token', token);
      await prefs.setBool('has_session', true);
      
      // On rafraîchit l'instance API avec le nouveau token
      ApiService(); 
      
      if (!mounted) return;
      UiUtils.showSuccess(context, 'Connexion Google réussie via Chrome.');
      Navigator.of(context).pushReplacementNamed('/dashboard');
    } catch (e) {
      debugPrint('Deep Link Error: $e');
      if (mounted) UiUtils.showError(context, 'Erreur lors de la récupération de session.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _doGoogleLogin() async {
    // On utilise l'URL du serveur qui lance le flux Google OAuth
    final authUrl = Uri.parse('${ApiService.baseUrl}/auth/google?redirect_to=from_mobile');
    
    try {
      if (!await launchUrl(authUrl, mode: LaunchMode.externalApplication)) {
        throw Exception('Could not launch $authUrl');
      }
    } catch (e) {
      debugPrint('Launch URL Error: $e');
      if (mounted) UiUtils.showError(context, 'Impossible d\'ouvrir le navigateur.');
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
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildBrandHeader(),
                    const SizedBox(height: 48),
                    _buildLoginForm(),
                    const SizedBox(height: 32),
                    _buildPrimaryActions(),
                    const SizedBox(height: 24),
                    _buildSocialLogin(),
                    const SizedBox(height: 40),
                    _buildFooter(),
                  ],
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
        decoration: BoxDecoration(color: const Color(0xFF0247AA).withOpacity(0.03), shape: BoxShape.circle),
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Column(
      children: [
        const Text('Medica-Sign', style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1.5)),
        const SizedBox(height: 16),
        const Text('Sécurité & Signature Numérique', style: TextStyle(fontSize: 14, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _buildLoginForm() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          TextFormField(
            controller: _emailController,
            decoration: _inputDecoration('Email Professionnel', Icons.alternate_email_rounded),
            validator: (v) => v!.isEmpty ? 'Veuillez saisir votre email' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _passwordController,
            obscureText: true,
            decoration: _inputDecoration('Mot de passe', Icons.lock_outline_rounded),
            validator: (v) => v!.isEmpty ? 'Veuillez saisir votre mot de passe' : null,
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(
      prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
      hintText: label,
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
    );
  }

  Widget _buildPrimaryActions() {
    return Column(
      children: [
        ElevatedButton(
          onPressed: _loading ? null : _doLogin,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0247AA),
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 56),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Se connecter', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        ),
        const SizedBox(height: 16),
        TextButton(
          onPressed: () => Navigator.of(context).pushNamed('/forgot-password'),
          child: const Text('Mot de passe oublié ?', style: TextStyle(color: Color(0xFF0247AA), fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  Widget _buildSocialLogin() {
    return Column(
      children: [
        Row(
          children: [
            const Expanded(child: Divider(color: Color(0xFFF1F5F9))),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text('OU CONTINUER AVEC', style: TextStyle(fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w900, color: const Color(0xFF94A3B8)))),
            const Expanded(child: Divider(color: Color(0xFFF1F5F9))),
          ],
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: _loading ? null : _doGoogleLogin,
          icon: const Icon(Icons.g_mobiledata_rounded, color: Color(0xFF0F172A), size: 32),
          label: const Text('Compte Google', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
          style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 56), side: const BorderSide(color: Color(0xFFE2E8F0)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Nouveau ici ? ', style: TextStyle(color: Color(0xFF64748B))),
            GestureDetector(
              onTap: () => Navigator.of(context).pushNamed('/register'),
              child: const Text('Créer un compte', style: TextStyle(color: Color(0xFF0247AA), fontWeight: FontWeight.w900)),
            ),
          ],
        ),
        const SizedBox(height: 48),
        const Text('Propulsé par Mediacom', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
      ],
    );
  }
}
