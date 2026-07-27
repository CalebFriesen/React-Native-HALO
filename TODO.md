Change from auto to manual

Find where it saves it to, and configure to save to the HALO HALO repo

Create overlay feature

# 1. Navigate to the project root
cd C:\Users\caleb\StudioProjects\React-Native-HALO

# 2. Install dependencies & start Metro
corepack yarn install
corepack yarn example start

# 3. (New terminal) Navigate to android and build/install the APK
cd C:\Users\caleb\StudioProjects\React-Native-HALO
cd example/android
.\gradlew.bat app:installDebug
adb shell monkey -p documentscanner.example -c android.intent.category.LAUNCHER 1

# 4. (After emulator/device is running) Reverse the Metro port
adb reverse tcp:8081 tcp:8081

# 5. Clear space for computer
cd C:\Users\caleb\StudioProjects\React-Native-HALO\example\android
.\gradlew.bat clean
Remove-Item -Recurse -Force C:\Users\caleb\StudioProjects\React-Native-HALO\node_modules
Remove-Item -Recurse -Force C:\Users\caleb\StudioProjects\React-Native-HALO\example\node_modules