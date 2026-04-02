import 'package:flutter/material.dart';
import '../api_service.dart';

class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});

  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  final ApiService api = ApiService();
  bool _loading = false;
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  String? _selectedType;

  final List<Map<String, String>> _types = [
    {'value': 'signature', 'label': 'Aide Signature TTN'},
    {'value': 'facture', 'label': 'Gestion Factures'},
    {'value': 'compte', 'label': 'Sécurité Compte'},
    {'value': 'jetons', 'label': 'Achat Jetons'},
    {'value': 'autre', 'label': 'Autre support'},
  ];

  Future<void> _handleSubmit() async {
    if (_subjectController.text.isEmpty || _selectedType == null || _messageController.text.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veuillez remplir tous les champs (Message min. 10 car.)'), backgroundColor: Colors.orange));
      return;
    }
    setState(() => _loading = true);
    try {
      await api.contactSupport({'type': _selectedType, 'message': "OBJET: ${_subjectController.text}\n\n${_messageController.text}"});
      if (mounted) _showComplete();
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erreur d\'envoi'), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showComplete() {
    showDialog(
      context: context,
      builder: (c) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 80),
            const SizedBox(height: 24),
            const Text('Demande reçue', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
            const SizedBox(height: 8),
            const Text('Notre équipe technique vous recontactera sous 24h.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            const SizedBox(height: 32),
            SizedBox(width: double.infinity, child: ElevatedButton(onPressed: () => Navigator.pop(c), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), child: const Text('Compris', style: TextStyle(color: Colors.white)))),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildPremiumHeader(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Column(
                children: [
                  _buildMainForm(),
                  const SizedBox(height: 24),
                  _buildQuickInfo(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPremiumHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 40),
      decoration: const BoxDecoration(
        color: Color(0xFF0247AA),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(40)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
           Text('Support Client', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -1)),
           SizedBox(height: 4),
           Text('Résolvez vos problèmes techniques en un clic.', style: TextStyle(color: Colors.white60, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildMainForm() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0)), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 30)]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label('CATEGORIE'),
          DropdownButtonFormField<String>(
            value: _selectedType,
            hint: const Text('Choisir un sujet', style: TextStyle(fontSize: 14)),
            items: _types.map((t) => DropdownMenuItem(value: t['value'], child: Text(t['label']!, style: const TextStyle(fontSize: 14)))).toList(),
            onChanged: (v) => setState(() => _selectedType = v),
            decoration: _inputStyle(),
          ),
          const SizedBox(height: 20),
          _label('OBJET'),
          TextField(controller: _subjectController, decoration: _inputStyle(hint: 'Sujet court...')),
          const SizedBox(height: 20),
          _label('DESCRIPTION'),
          TextField(controller: _messageController, maxLines: 5, decoration: _inputStyle(hint: 'Détaillez votre besoin...')),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _handleSubmit,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
              child: _loading ? const CircularProgressIndicator(color: Colors.white) : const Text('Envoyer le message', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _inputStyle({String? hint}) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
    );
  }

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(bottom: 8, left: 4), child: Text(t, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))));

  Widget _buildQuickInfo() {
    return Row(
      children: [
        Expanded(child: _infoItem(Icons.alternate_email_rounded, 'Email', 'aymen@pfe.tn')),
        const SizedBox(width: 16),
        Expanded(child: _infoItem(Icons.headset_mic_outlined, 'Dispo', '24h/24')),
      ],
    );
  }

  Widget _infoItem(IconData i, String l, String v) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(i, color: const Color(0xFF0247AA), size: 20),
          const SizedBox(height: 12),
          Text(l, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
          Text(v, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }
}
