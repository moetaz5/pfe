import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'dart:async';
import 'api_service.dart';

/// Service pour gérer les notifications externes (Push Notifications avec Firebase Cloud Messaging)
/// Gère les permissions, l'enregistrement du token FCM et la réception des notifications
/// ✅ Remains active in background to detect notifications quickly
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  static const String _permKey = 'notif_permission_asked';
  static const String _fcmTokenKey = 'fcm_token';
  
  // ✅ NEW: Background listener timer
  static Timer? _backgroundListener;
  static bool _isListening = false;

  /// Initialise le service de notifications au démarrage
  static Future<void> initialize() async {
    debugPrint('🔔 NotificationService initialisé');
    _startBackgroundListener();
  }

  /// ✅ NEW: Démarre un listener persistant en arrière-plan
  static void _startBackgroundListener() {
    if (_isListening) return;
    _isListening = true;
    
    // Poll pour les notifications toutes les 10 secondes
    _backgroundListener = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        // Récupérer les notifications depuis le serveur
        final notifList = await ApiService().getNotifications();
        debugPrint('✅ Notifications vérifiées: ${notifList.length} trouvées');
      } catch (e) {
        debugPrint('⚠️ Erreur background listener: $e');
      }
    });
    
    debugPrint('🔄 Background notification listener démarré (10s polling)');
  }

  /// ✅ NEW: Arrête le listener persistant
  static void stopBackgroundListener() {
    _backgroundListener?.cancel();
    _isListening = false;
    debugPrint('⛔ Background listener arrêté');
  }

  /// Demande la permission à l'utilisateur (une seule fois au démarrage)
  static Future<void> requestPermissionIfNeeded(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final alreadyAsked = prefs.getBool(_permKey) ?? false;
    if (alreadyAsked) return;

    await prefs.setBool(_permKey, true);

    if (!context.mounted) return;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: const EdgeInsets.all(28),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF0247AA).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.notifications_active_rounded,
                  size: 40, color: Color(0xFF0247AA)),
            ),
            const SizedBox(height: 20),
            const Text(
              'Autoriser MedicaSign à vous envoyer des notifications ?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1E293B),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Recevez des alertes en temps réel pour vos demandes de jetons, validations, demandes acceptées et documents signés. Cela améliore votre expérience de sécurité.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 28),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Ne pas autoriser',
                        style: TextStyle(
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      Navigator.of(ctx).pop();
                      // Envoyer le token FCM au serveur
                      await _registerFCMToken();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0247AA),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: const Text('Autoriser',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Enregistre le token FCM auprès du serveur backend
  static Future<void> _registerFCMToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Simuler l'obtention du token FCM (en production, utiliser firebase_messaging)
      final fcmToken = prefs.getString(_fcmTokenKey) ?? 'device_token_${DateTime.now().millisecondsSinceEpoch}';
      
      // Sauvegarder le token localement
      await prefs.setString(_fcmTokenKey, fcmToken);
      
      // Envoyer le token au serveur
      try {
        await ApiService().registerFCMToken(fcmToken);
        debugPrint('✅ Token FCM enregistré: $fcmToken');
      } catch (e) {
        debugPrint('⚠️ Erreur lors de l\'enregistrement du token: $e');
      }
    } catch (e) {
      debugPrint('❌ Erreur FCM: $e');
    }
  }

  /// Teste une notification (pour vérifier que tout fonctionne)
  static Future<void> sendTestNotification(BuildContext context) async {
    try {
      await ApiService().sendTestNotification();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Notification de test envoyée !'),
            backgroundColor: Color(0xFF0247AA),
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Réinitialise l'état pour reposer la question (utile pour les tests)
  static Future<void> resetPermission() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_permKey);
    await prefs.remove(_fcmTokenKey);
  }
}
