import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import '../api_service.dart';
import '../ui_utils.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  String _error = '';
  final ApiService api = ApiService();

  Future<void> _doGoogleRegister() async {
    // ✅ FIX: Use session_id polling instead of deep links to bypass Google OAuth blocking
    final sessionId = '${DateTime.now().millisecondsSinceEpoch}_reg_${(_emailController.text.hashCode).toString()}';
    
    final authUrl = Uri.parse(
      '${ApiService.baseUrl}/auth/google?session_id=$sessionId'
    );
    
    setState(() { _loading = true; });
    
    try {
      // 🔐 Launch with Safari/Chrome (external browser)
      if (!await launchUrl(
        authUrl,
        mode: LaunchMode.externalApplication,  // Opens in system browser
      )) {
        throw Exception('Could not launch $authUrl');
      }
      
      // ✅ NEW: Poll for token instead of waiting for deep link
      await _pollForGoogleToken(sessionId);
      
    } catch (e) {
      debugPrint('Google Register Error: $e');
      if (mounted) {
        UiUtils.showError(context, 
          'Erreur Google. Assurez-vous que Chrome ou Safari est installé.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Poll for the Google auth token from server
  Future<void> _pollForGoogleToken(String sessionId) async {
    const maxAttempts = 60; // 60 attempts × 500ms = 30 seconds
    const pollInterval = Duration(milliseconds: 500);
    
    for (int i = 0; i < maxAttempts; i++) {
      try {
        // Call exchange endpoint
        final response = await ApiService().dio.get(
          '${ApiService.baseUrl}/api/auth/google/exchange?session_id=$sessionId',
        );
        
        if (response.statusCode == 200 && response.data['token'] != null) {
          final token = response.data['token'];
          
          // ✅ Save session
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('session_token', token);
          await prefs.setBool('has_session', true);
          ApiService().setToken(token);
          
          if (!mounted) return;
          UiUtils.showSuccess(context, 'Inscription Google réussie !');
          
          Future.delayed(const Duration(milliseconds: 300), () {
            if (mounted) Navigator.pushReplacementNamed(context, '/dashboard');
          });
          return;
        }
      } catch (e) {
        // Token not ready yet, continue polling
        debugPrint('Polling attempt ${i + 1}/$maxAttempts...');
      }
      
      await Future.delayed(pollInterval);
    }
    
    // Timeout after 30 seconds
    if (mounted) {
      UiUtils.showError(context, 'Délai dépassé. Veuillez réessayer.');
    }
  }

  bool _isFullName(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    return parts.length >= 2;
  }

  Future<void> _doRegister() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_isFullName(_nameController.text)) {
      String msg = 'Entrez votre nom complet (Prénom + Nom).';
      setState(() => _error = msg);
      UiUtils.showError(context, msg);
      return;
    }
    setState(() { _loading = true; _error = ''; });
    try {
      await api.register(
        _nameController.text.trim(),
        _emailController.text.trim(),
        _passwordController.text,
        _phoneController.text.trim(),
        _addressController.text.trim(),
      );
      if (!mounted) return;
      UiUtils.showSuccess(context, 'Compte initié avec succès. Vérifiez votre boîte mail.');
      Navigator.of(context).pushReplacementNamed('/verify-email', arguments: _emailController.text.trim());
    } catch (e) {
      String friendlyError = 'Impossible de créer le compte. Vérifiez vos informations.';
      final str = e.toString();
      if (str.contains('EMAIL_ALREADY_EXISTS')) friendlyError = 'Cette adresse email est déjà enregistrée.';
      setState(() => _error = friendlyError);
      if (mounted) UiUtils.showError(context, friendlyError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    super.dispose();
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
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: MediaQuery.of(context).size.height - 100),
                child: IntrinsicHeight(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildHeader(),
                      const SizedBox(height: 40),
                      _buildForm(),
                      const SizedBox(height: 28),
                      _buildGoogleButton(),
                      const SizedBox(height: 20),
                      _buildDivider(),
                      const SizedBox(height: 20),
                      _buildSubmitButton(),
                      const SizedBox(height: 28),
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
      bottom: -100,
      left: -50,
      child: Container(
        width: 300,
        height: 300,
        decoration: BoxDecoration(
          color: const Color(0xFF0247AA).withOpacity(0.05),
          shape: BoxShape.circle,
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        // Logo + Badge
        Container(
          width: 70,
          height: 70,
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
          child: const Icon(Icons.verified_user_rounded, size: 35, color: Colors.white),
        ),
        const SizedBox(height: 20),
        const Text(
          'Médica-Sign',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: Color(0xFF0247AA),
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Créez votre identité numérique',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: Color(0xFF1E293B),
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Enrôlement certifié et sécurisé',
          style: TextStyle(
            fontSize: 13,
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          _buildInputField(
            _nameController,
            'Nom Complet (Prénom Nom)',
            Icons.person_add_rounded,
            TextInputType.name,
            'Entrez votre nom complet',
          ),
          const SizedBox(height: 14),
          _buildInputField(
            _emailController,
            'Email Professionnel',
            Icons.alternate_email_rounded,
            TextInputType.emailAddress,
            'Votre adresse email',
          ),
          const SizedBox(height: 14),
          _buildPasswordField(),
          const SizedBox(height: 14),
          _buildInputField(
            _phoneController,
            'Numéro de téléphone',
            Icons.phone_android_rounded,
            TextInputType.phone,
            '(+216) 5X XXX XXX',
          ),
          const SizedBox(height: 14),
          _buildInputField(
            _addressController,
            'Adresse / Cabinet',
            Icons.business_rounded,
            TextInputType.streetAddress,
            'Siège ou résidence professionnelle',
          ),
        ],
      ),
    );
  }

  Widget _buildInputField(
    TextEditingController controller,
    String label,
    IconData icon,
    TextInputType keyboardType,
    String hint,
  ) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
      decoration: InputDecoration(
        prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontWeight: FontWeight.w400),
        labelText: label,
        labelStyle: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600, fontSize: 12),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.red, width: 1.5),
        ),
      ),
      validator: (v) {
        if (v!.isEmpty) return '$label requis';
        if (label.contains('Email') && !v.contains('@')) return 'Email invalide';
        return null;
      },
    );
  }

  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordController,
      obscureText: !_showPassword,
      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
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
        hintText: 'Minimum 8 caractères',
        hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontWeight: FontWeight.w400),
        labelText: 'Mot de passe sécurisé',
        labelStyle: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600, fontSize: 12),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2),
        ),
      ),
      validator: (v) {
        if (v!.isEmpty) return 'Mot de passe requis';
        if (v.length < 8) return 'Minimum 8 caractères';
        return null;
      },
    );
  }

  Widget _buildGoogleButton() {
    return SizedBox(
      height: 52,
      child: OutlinedButton.icon(
        onPressed: _loading ? null : _doGoogleRegister,
        icon: const Icon(Icons.g_mobiledata_rounded, color: Color(0xFF0F172A), size: 26),
        label: const Text(
          'S\'inscrire avec Google',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 14),
        ),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Row(
      children: [
        const Expanded(child: Divider(color: Color(0xFFF1F5F9), height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'OU',
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF94A3B8),
            ),
          ),
        ),
        const Expanded(child: Divider(color: Color(0xFFF1F5F9), height: 1)),
      ],
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      height: 52,
      child: ElevatedButton(
        onPressed: _loading ? null : _doRegister,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF0247AA),
          foregroundColor: Colors.white,
          disabledBackgroundColor: const Color(0xFF0247AA).withOpacity(0.6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 0,
        ),
        child: _loading
            ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
            : const Text(
          'Créer mon compte',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2),
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
            const Text('Compte existant ? ', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            GestureDetector(
              onTap: () => Navigator.of(context).pushReplacementNamed('/login'),
              child: const Text(
                'Se connecter',
                style: TextStyle(
                  color: Color(0xFF0247AA),
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const Text(
          'Propulsé par Mediacom',
          style: TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }
}
