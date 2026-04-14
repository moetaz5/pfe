@echo off
echo ======================================================
echo   CORRECTION FINALE : MedicaSign Mobile (WINDOWS)
echo ======================================================
echo.
echo 1. Branchement du lecteur virtuel T: pour eviter les espaces...
subst T: /D >nul 2>&1
subst T: "%CD%"
if errorlevel 1 (
    echo [ERREUR] Impossible de creer le lecteur T:. Essayez de lancer ce script en ADMIN.
    pause
    exit /b
)

echo 2. Nettoyage et Lancement...
T:
call flutter clean
echo.
echo 3. Lancement de l'application...
call flutter run

echo.
echo 4. Nettoyage final du lecteur T:
subst T: /D
pause
