import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Clés de signature hors dépôt (`android/key.properties`). Absentes, tout se
// signe en debug et un clone sans keystore construit quand même.
//
// CPI GO s'auto-mets à jour : Android refuse de remplacer un paquet signé par
// une autre clé. Debug ET release doivent donc lire la MÊME clé quand elle est
// là, sans quoi une release ne peut pas succéder à un build de développement.
val keyProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "sn.cpi.go"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Exigé par flutter_local_notifications (alarme des rappels
        // représentants) : l'API java.time qu'il utilise sous le capot n'est
        // pas nativement disponible avant Android 8.
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "sn.cpi.go"
        // Android 7.0. Below that, the WorkManager + secure-storage stack we rely
        // on for offline sync is not dependable, and the install base in Senegal
        // below API 24 is negligible.
        minSdk = 24
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        // The app ships French copy only; keeping the full resource set for 80
        // languages inflates the APK for nothing on low-end devices.
        resourceConfigurations += listOf("fr", "en")
    }

    signingConfigs {
        if (keyProperties.containsKey("storeFile")) {
            create("cpi") {
                storeFile = file(keyProperties.getProperty("storeFile"))
                storePassword = keyProperties.getProperty("storePassword")
                keyAlias = keyProperties.getProperty("keyAlias")
                keyPassword = keyProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.findByName("cpi") ?: signingConfigs.getByName("debug")
        }
        release {
            signingConfig = signingConfigs.findByName("cpi") ?: signingConfigs.getByName("debug")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
