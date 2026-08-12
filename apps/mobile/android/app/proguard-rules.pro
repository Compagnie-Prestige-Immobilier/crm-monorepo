# Drift / sqlite3 load their natives through the sqlite3 Dart package; nothing to keep
# on the Java side. flutter_secure_storage and workmanager are annotation-driven.
-keep class androidx.work.** { *; }
-dontwarn org.slf4j.**
