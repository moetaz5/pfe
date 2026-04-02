import 'package:flutter/material.dart';
import '../api_service.dart';
import '../ui_utils.dart';

class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key});

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _codeController = TextEditingController();
  bool _loading = false;
  String _error = '';
  String _email = '';
  final ApiService _api = ApiService();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is String) _email = args;
  }

  Future<void> _verify() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = ''; });
    try {
      await _api.verifyEmail(_email, _codeController.text.trim());
      if (!mounted) return;
      UiUtils.showSuccess(context, 'Identité vérifiée avec succès. Vous pouvez maintenant vous connecter.');
      Navigator.of(context).pushReplacementNamed('/login');
    } catch (e) {
      String friendlyError = 'Code de vérification incorrect ou expiré.';
      setState(() => _error = friendlyError);
      if (mounted) UiUtils.showError(context, friendlyError);
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _resendCode() async {
    setState(() => _loading = true);
    try {
      await _api.resendVerificationCode(_email);
      if (mounted) UiUtils.showInfo(context, 'Un nouveau code a été envoyé à $_email.');
    } catch (_) {
      if (mounted) UiUtils.showError(context, 'Impossible de renvoyer le code.');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 60),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 140, height: 140,
                decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: const Color(0xFF0247AA).withOpacity(0.05), blurRadius: 30, offset: const Offset(0, 15))]),
                child: const Icon(Icons.mark_email_read_rounded, size: 64, color: Color(0xFF0247AA)),
              ),
              const SizedBox(height: 48),
              const Text('Vérification Identité', textAlign: TextAlign.center, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1)),
              const SizedBox(height: 16),
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), height: 1.6, fontWeight: FontWeight.w500),
                  children: [
                    const TextSpan(text: 'Un code de sécurité unique vient d\'être transmis vers '),
                    TextSpan(text: _email, style: const TextStyle(color: Color(0xFF0247AA), fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
              const SizedBox(height: 48),
              Form(
                key: _formKey,
                child: TextFormField(
                  controller: _codeController,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 10, color: Color(0xFF0247AA)),
                  decoration: InputDecoration(
                    hintText: '000000',
                    hintStyle: TextStyle(color: const Color(0xFFE2E8F0), letterSpacing: 10),
                    filled: true, fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
                  ),
                  validator: (v) => (v == null || v.isEmpty) ? 'Code requis' : null,
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _verify,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  child: _loading ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('ACTIVER MON COMPTE', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 24),
              TextButton(onPressed: _loading ? null : _resendCode, child: const Text('RENVOYER LE CODE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: 0.5))),
            ],
          ),
        ),
      ),
    );
  }
}
