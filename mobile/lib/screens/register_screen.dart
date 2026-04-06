import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import '../api_service.dart';
import '../ui_utils.dart';
import '../main.dart' show kGoogleWebClientId;

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
  String _error = '';
  final ApiService api = ApiService();

  Future<void> _doGoogleRegister() async {
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
      await api.register(_nameController.text.trim(), _emailController.text.trim(), _passwordController.text, _phoneController.text.trim(), _addressController.text.trim());
      if (!mounted) return;
      UiUtils.showSuccess(context, 'Compte initié avec succès. Vérifiez votre boîte mail.');
      Navigator.of(context).pushReplacementNamed('/verify-email', arguments: _emailController.text.trim());
    } catch (e) {
      String friendlyError = 'Impossible de créer le compte. Vérifiez vos informations.';
      final str = e.toString();
      if (str.contains('EMAIL_ALREADY_EXISTS')) friendlyError = 'Cette adresse email est déjà enregistrée.';
      setState(() => _error = friendlyError);
      if (mounted) UiUtils.showError(context, friendlyError);
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
              _buildHeader(),
              const SizedBox(height: 48),
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    _input(_nameController, 'Nom Complet (Prénom Nom)', Icons.person_add_rounded),
                    const SizedBox(height: 12),
                    _input(_emailController, 'Identifiant Professionnel (Email)', Icons.alternate_email_rounded, type: TextInputType.emailAddress),
                    const SizedBox(height: 12),
                    _input(_passwordController, 'Clé d\'Accès (8+ car.)', Icons.lock_outline_rounded, obscure: true),
                    const SizedBox(height: 12),
                    _input(_phoneController, 'Contact Mobile', Icons.phone_android_rounded, type: TextInputType.phone),
                    const SizedBox(height: 12),
                    _input(_addressController, 'Siège / Résidence', Icons.business_rounded),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              OutlinedButton.icon(
                onPressed: _loading ? null : _doGoogleRegister,
                icon: const Icon(Icons.g_mobiledata_rounded, color: Color(0xFF0F172A), size: 32),
                label: const Text('S\'inscrire avec Google', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 56),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                  const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('OU', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8), letterSpacing: 1))),
                  const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _doRegister,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  child: _loading ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('ENRÔLEMENT SÉCURISÉ', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Compte existant ? ', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pushReplacementNamed('/login'),
                    child: const Text('SE CONNECTER', style: TextStyle(color: Color(0xFF0247AA), fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 0.5)),
                  ),
                ],
              ),
              const SizedBox(height: 48),
              const Text('Propulsé par Mediacom', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        const Text('Medica-Sign', style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1.5)),
        const SizedBox(height: 24),
        const Text('Enrôlement Certifié', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1E293B), letterSpacing: -0.5)),
        const Text('Initiez votre identité numérique professionnelle.', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _input(TextEditingController ctrl, String hint, IconData icon, {bool obscure = false, TextInputType type = TextInputType.text}) {
    return TextFormField(
      controller: ctrl, obscureText: obscure, keyboardType: type,
      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
      decoration: InputDecoration(
        prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
        hintText: hint,
        filled: true, fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
      ),
      validator: (v) => v!.isEmpty ? 'Requis' : null,
    );
  }
}
