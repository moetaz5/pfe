import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _currentPage = 0;

  final List<_OnboardingPage> _pages = const [
    _OnboardingPage(
      icon: Icons.verified_user_rounded,
      title: 'Bienvenue sur\nMédica-Sign',
      subtitle: 'Plateforme de certification en ligne',
      body:
          'Créez vos factures en toute sécurité grâce à l\'expertise de MEDICACOM, startup tunisienne dédiée à la norme.',
      bullets: [
        'Partenaire de confiance',
        'Conforme aux normes',
        '100 % en ligne',
      ],
    ),
    _OnboardingPage(
      icon: Icons.description_rounded,
      title: 'Signature\nélectronique XML & PDF',
      subtitle: 'Conformité légale garantie',
      body:
          'Signez vos documents fiscaux (factures XML, PDF) conformément sur la signature électronique en Tunisie.',
      bullets: [
        'Factures XML & PDF signées',
        'Archivage sécurisé',
      ],
    ),
    _OnboardingPage(
      icon: Icons.token_rounded,
      title: 'Gestion des\njetons de signature',
      subtitle: 'Achetez et gérez vos crédits',
      body:
          'Achetez des packs de jetons pour signer vos documents. Suivez l\'historique de vos transactions et rechargez à tout moment.',
      bullets: [
        'Recharge en ligne facile',
        'Historique complet',
        'Alertes de solde faible',
      ],
    ),
    _OnboardingPage(
      icon: Icons.notifications_active_rounded,
      title: 'Notifications\nen temps réel',
      subtitle: 'Ne manquez aucune validation',
      body:
          'Recevez des alertes instantanées pour chaque étape : demande acceptée, preuve de paiement reçue, ou document signé.',
      bullets: [
        'Alertes de validation',
        'Suivi du statut en direct',
        'Rappels intelligents',
      ],
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
    // ✅ FIX: Ne pas naviguer vers login, juste fermer l'onboarding
    // L'app principal va vérifier la session et naviguer correctement
    if (mounted) Navigator.of(context).pushReplacementNamed('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // Skip button
            Align(
              alignment: Alignment.topRight,
              child: TextButton(
                onPressed: _finish,
                child: const Text(
                  'Ignorer',
                  style: TextStyle(
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ),

            // Pages
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _currentPage = i),
                itemBuilder: (ctx, i) => _buildPage(_pages[i]),
              ),
            ),

            // Dots indicator
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _pages.length,
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: _currentPage == i ? 24 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _currentPage == i
                        ? const Color(0xFF0247AA)
                        : const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Next / Start button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: () {
                    if (_currentPage < _pages.length - 1) {
                      _controller.nextPage(
                        duration: const Duration(milliseconds: 400),
                        curve: Curves.easeInOut,
                      );
                    } else {
                      _finish();
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0247AA),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18)),
                    elevation: 0,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _currentPage < _pages.length - 1
                            ? 'Suivant'
                            : 'Commencer',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward_rounded,
                          color: Colors.white, size: 20),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),
          ],
        ),
      ),
    );
  }

  Widget _buildPage(_OnboardingPage page) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon circle
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFF0247AA), Color(0xFF1565C0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0247AA).withOpacity(0.3),
                  blurRadius: 30,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Icon(page.icon, size: 52, color: Colors.white),
          ),
          const SizedBox(height: 36),

          // Title
          Text(
            page.title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0247AA),
              height: 1.2,
            ),
          ),
          const SizedBox(height: 8),

          // Subtitle
          Text(
            page.subtitle,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 20),

          // Body text
          Text(
            page.body,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF475569),
              height: 1.6,
            ),
          ),
          const SizedBox(height: 24),

          // Bullets
          Column(
            children: page.bullets
                .map(
                  (b) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_circle_rounded,
                            size: 18, color: Color(0xFF0247AA)),
                        const SizedBox(width: 10),
                        Text(
                          b,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

// ─── Data class ────────────────────────────────────────────────────────────

class _OnboardingPage {
  final IconData icon;
  final String title;
  final String subtitle;
  final String body;
  final List<String> bullets;

  const _OnboardingPage({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.body,
    required this.bullets,
  });
}
