import 'package:flutter/material.dart';
import '../api_service.dart';
import '../ui_utils.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final ApiService api = ApiService();
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  int _step = 0; // 0: Email, 1: Code, 2: New Password
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _handleStep0() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;
    setState(() { _loading = true; _error = null; });
    try {
      await api.forgotPassword(email);
      if (mounted) {
        UiUtils.showInfo(context, 'Un code a été envoyé à $email.');
        setState(() { _step = 1; _loading = false; });
      }
    } catch (e) {
      String friendlyError = "Impossible d'envoyer le code à cette adresse.";
      setState(() { _error = friendlyError; _loading = false; });
      if (mounted) UiUtils.showError(context, friendlyError);
    }
  }

  Future<void> _handleStep1() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;
    setState(() { _loading = true; _error = null; });
    try {
      await api.verifyResetCode(_emailController.text.trim(), code);
      if (mounted) {
        UiUtils.showSuccess(context, 'Code vérifié. Veuillez définir un nouveau mot de passe.');
        setState(() { _step = 2; _loading = false; });
      }
    } catch (e) {
      String friendlyError = "Code de validation incorrect ou expiré.";
      setState(() { _error = friendlyError; _loading = false; });
      if (mounted) UiUtils.showError(context, friendlyError);
    }
  }

  Future<void> _handleStep2() async {
    if (_passwordController.text.isEmpty || _passwordController.text != _confirmController.text) {
      String msg = "Les mots de passe ne correspondent pas.";
      setState(() => _error = msg);
      UiUtils.showError(context, msg);
      return;
    }
    if (_passwordController.text.length < 8) {
      String msg = "Minimum 8 caractères requis pour la sécurité.";
      setState(() => _error = msg);
      UiUtils.showError(context, msg);
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await api.resetPassword(_emailController.text.trim(), _codeController.text.trim(), _passwordController.text);
      if (mounted) {
        UiUtils.showSuccess(context, 'Mot de passe réinitialisé.');
        _showSuccess();
      }
    } catch (e) {
      String unfriendlyError = "Échec de la réinitialisation du secret.";
      setState(() { _error = unfriendlyError; _loading = false; });
      if (mounted) UiUtils.showError(context, unfriendlyError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showSuccess() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 80),
            const SizedBox(height: 24),
            const Text('Accès Restauré', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
            const SizedBox(height: 8),
            const Text('Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            const SizedBox(height: 32),
            SizedBox(width: double.infinity, child: ElevatedButton(onPressed: () { Navigator.pop(c); Navigator.pop(context); }, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), child: const Text('RETOUR AU LOGIN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)))),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0247AA), size: 20), onPressed: () => Navigator.pop(context)),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildIllustration(),
              const SizedBox(height: 48),
              _buildTitle(),
              const SizedBox(height: 16),
              _buildSubtitle(),
              const SizedBox(height: 48),
              _buildCurrentStep(),
              const SizedBox(height: 24),
              _buildActionButton(),
              const SizedBox(height: 24),
              if (_step == 1) TextButton(onPressed: _loading ? null : _handleStep0, child: const Text('RENVOYER LE CODE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: 0.5))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIllustration() {
    IconData icon = Icons.lock_reset_rounded;
    if (_step == 1) icon = Icons.mark_email_read_rounded;
    if (_step == 2) icon = Icons.shield_rounded;

    return Container(
      width: 140, height: 140,
      decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: const Color(0xFF0247AA).withOpacity(0.05), blurRadius: 30, offset: const Offset(0, 15))]),
      child: Icon(icon, size: 64, color: const Color(0xFF0247AA)),
    );
  }

  Widget _buildTitle() {
    String t = "Mot de passe oublié";
    if (_step == 1) t = "Vérification OTP";
    if (_step == 2) t = "Nouveau mot de passe";
    return Text(t, textAlign: TextAlign.center, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1));
  }

  Widget _buildSubtitle() {
    String s = "Entrez votre email pour recevoir un code de restauration.";
    if (_step == 1) s = "Saisissez le code à 6 chiffres reçu dans votre boîte mail.";
    if (_step == 2) s = "Définissez un nouveau secret pour sécuriser votre accès.";
    return Text(s, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), height: 1.6, fontWeight: FontWeight.w500));
  }

  Widget _buildCurrentStep() {
    if (_step == 0) return _inputField(_emailController, Icons.alternate_email_rounded, 'Email Professionnel de Travail', TextInputType.emailAddress);
    if (_step == 1) return _inputField(_codeController, Icons.qr_code_rounded, 'Code de Sécurité (6 chiffres)', TextInputType.number);
    return Column(
      children: [
        _inputField(_passwordController, Icons.lock_outline_rounded, 'Nouveau Secret de Connexion', TextInputType.visiblePassword, isPass: true),
        const SizedBox(height: 16),
        _inputField(_confirmController, Icons.lock_reset_rounded, 'Confirmation du Secret', TextInputType.visiblePassword, isPass: true),
      ],
    );
  }

  Widget _inputField(TextEditingController ctrl, IconData i, String hint, TextInputType type, {bool isPass = false}) {
    return TextField(
      controller: ctrl,
      keyboardType: type,
      obscureText: isPass,
      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
      decoration: InputDecoration(
        prefixIcon: Icon(i, size: 20, color: const Color(0xFF94A3B8)),
        hintText: hint,
        filled: true, fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
      ),
    );
  }

  Widget _buildActionButton() {
    String txt = "ENVOYER LE CODE";
    VoidCallback fn = _handleStep0;
    if (_step == 1) { txt = "VÉRIFIER LE CODE"; fn = _handleStep1; }
    if (_step == 2) { txt = "RÉINITIALISER L'ACCÈS"; fn = _handleStep2; }

    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : fn,
        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
        child: _loading 
            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : Text(txt, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
