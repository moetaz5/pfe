import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class CreateTransactionRedirectScreen extends StatelessWidget {
  const CreateTransactionRedirectScreen({super.key});

  final String webUrl = "http://51.178.39.67";

  Future<void> _launchURL() async {
    final Uri url = Uri.parse(webUrl);
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) throw Exception('Could not launch $url');
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
                decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: const Color(0xFF0F172A).withOpacity(0.05), blurRadius: 30, offset: const Offset(0, 15))]),
                child: const Icon(Icons.desktop_windows_rounded, size: 64, color: Color(0xFF2563EB)),
              ),
              const SizedBox(height: 48),
              const Text('Console Desktop Recommandée', textAlign: TextAlign.center, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0F172A), letterSpacing: -1)),
              const SizedBox(height: 16),
              const Text('La gestion des structures XML certifiées et des documents PDF volumineux nécessite une interface de bureau pour une sécurité optimale.', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Color(0xFF64748B), height: 1.6, fontWeight: FontWeight.w500)),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _launchURL,
                  icon: const Icon(Icons.open_in_new_rounded, size: 20),
                  label: const Text('ACCÉDER À LA VERSION WEB', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F172A), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () { Clipboard.setData(ClipboardData(text: webUrl)); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('📋 URL copiée.'))); },
                  icon: const Icon(Icons.copy_all_rounded, size: 18),
                  label: const Text('COPIER LE LIEN DIRECT', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF64748B), side: const BorderSide(color: Color(0xFFE2E8F0)), padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                ),
              ),
              const SizedBox(height: 48),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(color: const Color(0xFF2563EB).withOpacity(0.05), borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFF2563EB).withOpacity(0.1))),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: Color(0xFF2563EB), size: 24),
                    const SizedBox(width: 16),
                    Expanded(child: Text('Vos flux initiés sur le web apparaîtront instantanément dans votre application mobile pour signature.', style: TextStyle(fontSize: 12, color: Color(0xFF1E293B), fontWeight: FontWeight.w500, height: 1.5))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
