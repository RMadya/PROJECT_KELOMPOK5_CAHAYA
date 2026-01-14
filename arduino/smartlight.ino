#include <WiFi.h> // GUNAKAN <ESP8266WiFi.h> JIKA PAKAI ESP8266
#include <HTTPClient.h>
#include <ArduinoJson.h> // Butuh library "ArduinoJson" by Benoit Blanchon (install via Library Manager)

// --- KONFIGURASI WIFI ---
const char* ssid = "NAMA_WIFI_KAMU";
const char* password = "PASSWORD_WIFI_KAMU";

// --- KONFIGURASI SERVER ---
// Ganti 192.168.x.x dengan IP Laptop kamu (Cek pakai 'ipconfig' di CMD)
// JANGAN PAKAI 'localhost' atau '127.0.0.1' karena itu menunjuk ke ESP32 itu sendiri
const char* serverUrl = "http://192.168.1.10:3000/api/sensors/data"; 

// --- KONFIGURASI PERANGKAT ---
const char* deviceId = "LAMP_001"; // Harus sesuai dengan yang ada di database (init-db.js)

// --- PIN ---
const int ldrPin = 34; // Pin Analog untuk LDR (Pastikan pin ini mendukung ADC)
const int ledPin = 2;  // Pin LED bawaan atau Relay untuk Lampu 

void setup() {
  Serial.begin(115200);
  
  pinMode(ledPin, OUTPUT); 

  // Koneksi WiFi
  WiFi.begin(ssid, password); 
  Serial.print("Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terkoneksi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // 1. BACA SENSOR
    int lightIntensity = analogRead(ldrPin);
    // Optional: Konversi nilai analog (0-4095) ke 0-1000 atau range lain jika perlu
    // lightIntensity = map(lightIntensity, 0, 4095, 0, 1000); 

    Serial.print("Intensitas Cahaya: ");
    Serial.println(lightIntensity);

    // 2. SIAPKAN DATA JSON
    // Format yang diterima server: { "device_id": "...", "light_intensity": 123 }
    StaticJsonDocument<200> doc;
    doc["device_id"] = deviceId;
    doc["light_intensity"] = lightIntensity;

    String requestBody;
    serializeJson(doc, requestBody);

    // 3. KIRIM DATA KE SERVER (POST)
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(requestBody);

    // 4. TERIMA RESPON & KONTROL LAMPU
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Respon Server: " + response);

      // Parse Respon
      StaticJsonDocument<200> responseDoc;
      DeserializationError error = deserializeJson(responseDoc, response);

      if (!error) {
        // Server mengembalikan { ..., "auto_action": "ON"|"OFF", "current_status": "ON"|"OFF" }
        const char* status = responseDoc["current_status"];
        
        if (strcmp(status, "ON") == 0) {
          digitalWrite(ledPin, HIGH); // Nyalakan Lampu
          Serial.println("Lampu: NYALA");
        } else {
          digitalWrite(ledPin, LOW);  // Matikan Lampu
          Serial.println("Lampu: MATI");
        }
      } else {
        Serial.print("Gagal parse JSON: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.print("Error saat mengirim POST: ");
      Serial.println(httpResponseCode);
    }

    http.end(); // Bebaskan resource
  } else {
    Serial.println("WiFi Terputus!");
    // Coba reconnect
    WiFi.begin(ssid, password);
  }

  // Kirim data setiap 5 detik
  delay(5000);
}
