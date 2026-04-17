@echo off
subst Z: /D >nul 2>&1
subst Z: "%CD%"
Z:
call flutter clean
call flutter run -d emulator-5554
subst Z: /D
