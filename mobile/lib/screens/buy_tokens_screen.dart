import 'package:flutter/material.dart';
import '../api_service.dart';
import 'package:intl/intl.dart';
import '../ui_utils.dart';
import 'token_requests_screen.dart';

class BuyTokensScreen extends StatefulWidget {
  final Map<String, dynamic>? user;
  final String subPage;
  const BuyTokensScreen({super.key, this.user, this.subPage = 'buy'});

  @override
  State<BuyTokensScreen> createState() => _BuyTokensScreenState();
}

class _BuyTokensScreenState extends State<BuyTokensScreen> {
  final ApiService api = ApiService();
  bool _loading = false;
  final _customTokensController = TextEditingController(text: '15');
  final _emailController = TextEditingController();
  
  final _proofAmountController = TextEditingController();
  final _proofRefController = TextEditingController();
  final _proofDateController = TextEditingController();

  final List<Map<String, dynamic>> _packs = [
    {'id': 'pack-10', 'name': 'Pack Bronze', 'tokens': 10, 'price': 9, 'icon': Icons.bolt_rounded, 'color': Color(0xFF0247AA)},
    {'id': 'pack-50', 'name': 'Pack Silver', 'tokens': 50, 'price': 42, 'icon': Icons.security_rounded, 'color': Color(0xFF497BC1)},
    {'id': 'pack-100', 'name': 'Pack Gold', 'tokens': 100, 'price': 75, 'icon': Icons.workspace_premium_rounded, 'color': Color(0xFF10B981)},
  ];

  double getUnitPrice(int tokens) {
    if (tokens >= 100) return 0.75;
    if (tokens >= 50) return 0.84;
    return 0.9;
  }

  String formatPrice(double value) {
    return NumberFormat.currency(locale: 'fr_TN', symbol: 'TND').format(value);
  }

  Future<void> _handleBuy(String name, int tokens, double price, String source) async {
    _emailController.text = widget.user?['email'] ?? '';
    final bool? confirm = await showGeneralDialog<bool>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'BUY',
      pageBuilder: (c, a, b) => Center(
        child: Container(
          width: MediaQuery.of(c).size.width * 0.85,
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
          child: Material(
            color: Colors.transparent,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.shopping_cart_checkout_rounded, color: Color(0xFF0247AA), size: 48),
                const SizedBox(height: 16),
                const Text('Confirmer la demande', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
                const SizedBox(height: 8),
                Text('Vous demandez $tokens jetons pour ${formatPrice(price)}.', textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B))),
                const SizedBox(height: 24),
                TextField(
                  controller: _emailController, 
                  decoration: InputDecoration(
                    labelText: 'Email de notification', 
                    labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
                  )
                ),
                const SizedBox(height: 32),
                Row(children: [
                  Expanded(child: TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('ANNULER', style: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)))),
                  const SizedBox(width: 8),
                  Expanded(child: ElevatedButton(onPressed: () => Navigator.pop(c, true), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), child: const Text('CONFIRMER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)))),
                ]),
              ],
            ),
          ),
        ),
      ),
    );

    if (confirm != true) return;
    setState(() => _loading = true);
    try {
      await api.buyTokens({
        'pack_name': name, 
        'tokens': tokens.toString(), 
        'price_tnd': price.toString(), 
        'contact_email': _emailController.text.trim(), 
        'request_source': source
      });
      if (mounted) UiUtils.showSuccess(context, 'Demande de jetons transmise avec succès.');
    } catch (_) {
      if (mounted) UiUtils.showError(context, 'Échec de la transmission de la demande.');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _submitProof() async {
    if (_proofAmountController.text.isEmpty || _proofRefController.text.isEmpty) {
        UiUtils.showError(context, 'Veuillez remplir les champs obligatoires.');
        return;
    }
    setState(() => _loading = true);
    try {
      await api.submitPaymentProof({
        'amount': _proofAmountController.text,
        'reference': _proofRefController.text,
        'date': _proofDateController.text,
      });
      if (mounted) UiUtils.showSuccess(context, 'Preuve de paiement soumise pour vérification.');
      _proofAmountController.clear(); _proofRefController.clear(); _proofDateController.clear();
    } catch (e) {
      if (mounted) UiUtils.showError(context, 'Erreur lors de l\'envoi de la preuve.');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: _buildCurrentView(),
    );
  }

  Widget _buildCurrentView() {
    if (widget.subPage == 'history') return const TokenRequestsScreen();
    if (widget.subPage == 'proof') return _proofForm();
    return _buyView();
  }

  Widget _buyView() {
    int safeTokens = int.tryParse(_customTokensController.text) ?? 1;
    double customUnitPrice = getUnitPrice(safeTokens);
    double customTotalPrice = safeTokens * customUnitPrice;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      children: [
        _buildHeader('Acquisition de Crédits', 'Alimentez votre portefeuille de jetons certifiés.'),
        const SizedBox(height: 28),
        _buildCreditOverview(),
        const SizedBox(height: 32),
        const Text('PACKS PROFESSIONNELS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
        const SizedBox(height: 16),
        ..._packs.map((p) => _packItem(p)).toList(),
        const SizedBox(height: 32),
        _buildCalculator(safeTokens, customUnitPrice, customTotalPrice),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _proofForm() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      children: [
        _buildHeader('Clearing Center', 'Confirmez votre virement ou versement.'),
        const SizedBox(height: 28),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0))),
          child: Column(
            children: [
              _input('Montant versé (TND)', _proofAmountController, Icons.payments_rounded),
              _input('Référence de l\'opération', _proofRefController, Icons.receipt_long_rounded),
              _input('Date du versement', _proofDateController, Icons.calendar_today_rounded, hint: 'JJ/MM/AAAA'),
              const SizedBox(height: 24),
              _primaryBtn('TRANSMETTRE LA PREUVE', _submitProof),
            ],
          ),
        )
      ],
    );
  }

  Widget _buildHeader(String title, String sub) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1)),
        Text(sub, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _buildCreditOverview() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF0247AA),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: const Color(0xFF0247AA).withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 10))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('SOLDE DISPONIBLE', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5)),
          const SizedBox(height: 8),
          Row(
            children: [
              Text('${widget.user?['total_jetons'] ?? 0}', style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900)),
              const SizedBox(width: 12),
              const Text('JETONS', style: TextStyle(color: Colors.white54, fontSize: 13, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 24),
          const Divider(color: Colors.white10),
          const SizedBox(height: 12),
          const Row(
            children: [
               Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 16),
               SizedBox(width: 8),
               Text('Jetons certifiés pour signatures Haute Qualité.', style: TextStyle(color: Colors.white38, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _packItem(Map<String, dynamic> p) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => _handleBuy(p['name'], p['tokens'], p['price'].toDouble(), 'pack'),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: (p['color'] as Color).withOpacity(0.1), shape: BoxShape.circle), child: Icon(p['icon'], size: 20, color: p['color'])),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p['name']!, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0247AA))),
                  Text('${p['tokens']} UNITÉS', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF497BC1))),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(formatPrice(p['price'].toDouble()), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0247AA))),
                const Text('Choisir ce pack', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCalculator(int tokens, double unitPrice, double total) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('DOSAGE PERSONNALISÉ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8), letterSpacing: 1.5)),
          const SizedBox(height: 20),
          TextField(
            controller: _customTokensController, keyboardType: TextInputType.number,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            onChanged: (v) => setState(() {}),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.add_shopping_cart_rounded, size: 20, color: Color(0xFF94A3B8)),
              hintText: 'Quantité de jetons...',
              filled: true, fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
            ),
          ),
          const SizedBox(height: 24),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('INVESTISSEMENT ESTIMÉ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
            Text(formatPrice(total), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
          ]),
          const SizedBox(height: 24),
          _primaryBtn('LANCER LA COMMANDE', () => _handleBuy('Montant Personnalisé', tokens, total, 'custom')),
        ],
      ),
    );
  }

  Widget _input(String label, TextEditingController ctrl, IconData i, {String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: ctrl,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        decoration: InputDecoration(
          prefixIcon: Icon(i, size: 20, color: const Color(0xFF94A3B8)),
          hintText: hint ?? label,
          filled: true, fillColor: const Color(0xFFF8FAFC),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
        ),
      ),
    );
  }

  Widget _primaryBtn(String t, VoidCallback fn) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : fn,
        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
        child: _loading ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Text(t, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
