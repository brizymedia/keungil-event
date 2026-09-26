plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/*
 * 서명 열쇠 — 플레이스토어 「업로드 키」이자 직접 배포 APK 의 서명 열쇠.
 * 파일과 비밀번호는 저장소에 없다. GitHub Actions 가 비밀(secrets)에서 꺼내 환경변수로 넘긴다.
 *   KEUNGIL_KEYSTORE     열쇠 파일(.p12) 경로
 *   KEUNGIL_KEYSTORE_PW  비밀번호 (열쇠 이름은 upload, 열쇠 비밀번호는 저장소 비밀번호와 같다)
 * 환경변수가 없으면(내 PC 에서 그냥 돌릴 때) 디버그 열쇠로 서명한다 — 시험용일 뿐, 그 APK 를 배포하면 안 된다.
 * 한 번 정한 열쇠는 바꾸면 안 된다: 서명이 다른 APK 는 옛 것 위에 설치되지 않는다(지우고 다시 깔아야 함).
 */
val 열쇠파일: String? = System.getenv("KEUNGIL_KEYSTORE")
val 열쇠비번: String? = System.getenv("KEUNGIL_KEYSTORE_PW")
val 열쇠있음 = !열쇠파일.isNullOrBlank() && !열쇠비번.isNullOrBlank()

android {
    namespace = "com.brizymedia.keungilalert"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.brizymedia.keungilalert"
        minSdk = 26          // 안드로이드 8.0 — 알림 채널이 이때 생겼다
        targetSdk = 36       // 플레이스토어: 2026-08-31 부터 새 앱은 36(안드로이드 16) 이상이어야 올릴 수 있다
        versionCode = 3      // 올릴 때마다 1 씩 올린다 (플레이스토어는 같은 번호를 두 번 받지 않는다)
        versionName = "0.3"
    }

    signingConfigs {
        create("release") {
            if (열쇠있음) {
                storeFile = file(열쇠파일!!)
                storePassword = 열쇠비번
                keyAlias = "upload"
                keyPassword = 열쇠비번
                storeType = "PKCS12"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (열쇠있음) signingConfigs.getByName("release")
                            else signingConfigs.getByName("debug")
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
