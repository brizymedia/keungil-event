plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.brizymedia.keungilalert"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.brizymedia.keungilalert"
        minSdk = 26          // 안드로이드 8.0 — 알림 채널이 이때 생겼다
        targetSdk = 34
        versionCode = 2
        versionName = "0.2"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    // 하루 한 번 입찰 공고 확인 (폰이 자는 동안에도 깨워 준다)
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
