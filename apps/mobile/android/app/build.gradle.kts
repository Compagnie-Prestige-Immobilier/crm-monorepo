plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
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

    buildTypes {
        release {
            // TODO: real signing config before the first store upload.
            signingConfig = signingConfigs.getByName("debug")
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
