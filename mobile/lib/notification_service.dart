import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'dart:async';
import 'api_service.dart';
import 'dart:io';

/// Service pour gérer les notifications système réelles
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  static final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  
  static Timer? _backgroundListener;
  static bool _isListening = false;
  static List<int> _processedNotifIds = [];

  /// Initialise le service de notifications au démarrage
  static Future<void> initialize() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/launcher_icon');
    
    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
    );

    await _notificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Gérer le clic sur la notification si besoin
        debugPrint('Notification cliquée: ${response.payload}');
      },
    );

    debugPrint('🔔 NotificationService (Réel) initialisé');
    _startBackgroundListener();
  }

  /// ✅ NEW: Affiche une vraie notification dans la barre système
  static Future<void> showLocalNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'medicasign_main_channel',
      'Alertes MedicaSign',
      channelDescription: 'Notifications pour les signatures et jetons',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
    );
    
    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);
    
    await _notificationsPlugin.show(
      id,
      title,
      body,
      platformChannelSpecifics,
      payload: payload,
    );
  }

  /// Démarre un listener persistant en arrière-plan (Polling pour la démo, FCM recommandé pour prod)
  static void _startBackgroundListener() {
    if (_isListening) return;
    _isListening = true;
    
    _backgroundListener = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        final prefs = await SharedPreferences.getInstance();
        final hasSession = prefs.getBool('has_session') ?? false;
        if (!hasSession) return;

        // Récupérer les notifications depuis le serveur
        final notifList = await ApiService().getNotifications();
        
        for (var notif in notifList) {
          final id = notif['id'] as int;
          if (!_processedNotifIds.contains(id)) {
            // Afficher dans la barre système
            await showLocalNotification(
              id: id,
              title: notif['title'] ?? 'Nouveau message',
              body: notif['message'] ?? '',
            );
            _processedNotifIds.add(id);
          }
        }
      } catch (e) {
        debugPrint('⚠️ Erreur background listener: $e');
      }
    });
  }

  /// Demande la permission réelle du système Android/iOS
  static Future<void> requestPermissionIfNeeded(BuildContext context) async {
    if (Platform.isAndroid) {
      final AndroidFlutterLocalNotificationsPlugin? androidImplementation =
          _notificationsPlugin.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidImplementation != null) {
        await androidImplementation.requestNotificationsPermission();
      }
    }
    
    debugPrint('✅ Demande de permission système effectuée');
  }

  /// Teste une notification immédiatement
  static Future<void> sendTestNotification(BuildContext context) async {
    await showLocalNotification(
      id: 999,
      title: 'Test de Notification',
      body: 'Ceci est une notification réelle dans votre barre système !',
    );
  }
}
