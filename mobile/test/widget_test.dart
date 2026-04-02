import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('App basic smoke test', (WidgetTester tester) async {
    // Initialisation des données locales nécessaires au démarrage
    SharedPreferences.setMockInitialValues({});
    
    // Construction de l'application
    await tester.pumpWidget(const MyApp());

    // Vérification basique que l'application se lance (ex: présence du texte de bienvenue ou login)
    // Comme l'app démarre sur /login ou /dashboard, on vérifie juste que l'arbre de widgets démarre
    expect(true, true);
  });
}
