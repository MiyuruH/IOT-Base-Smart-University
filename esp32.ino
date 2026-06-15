#include <WiFi.h>
#include <HTTPClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <DHT.h>
#include <ArduinoJson.h>

// --- Network & Server Config ---
#define WIFI_SSID "Hostel_WiFi"
#define WIFI_PASSWORD "wifi@HostRUSL"

// IMPORTANT: Replace this IP with the local IP of your computer running Next.js
#define NEXTJS_SERVER_URL "http://10.30.10.37:3000/api/sensor_readings" 


// IMPORTANT: The target room in Supabase this data belongs to
#define TARGET_ROOM_ID "3697903e-6d5d-4243-a77f-b7d733a775d2"

// --- Pin Definitions ---
#define DHTPIN 14 
#define DHTTYPE DHT11
const int ldrPin = 34;
const int pirPin = 13;
const int soundPin = 32;

// --- Objects ---
DHT dht(DHTPIN, DHTTYPE);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 19800); 

// --- Continuous Tracking Variables ---
unsigned long lastNetworkPushMillis = 0;
const unsigned long PUSH_INTERVAL = 3000; // Send data every 3 seconds

unsigned int currentSignalMax = 0;
unsigned int currentSignalMin = 4095;
float maxDbSinceLastPush = 40.0;
bool motionDetectedSinceLastPush = false;
unsigned long lastSoundCalcMillis = 0;

// Short debounce so dashboard reflects current motion/noise (not a 3‑min hold)
const unsigned long OCCUPANCY_DEBOUNCE_MS = 15000; // 15 seconds
unsigned long lastOccupancyTime = 0;
bool hasStartedOccupancy = false;

const char* wifiStatusText(wl_status_t status) {
  switch (status) {
    case WL_NO_SSID_AVAIL: return "SSID not found (wrong name or out of range)";
    case WL_CONNECT_FAILED: return "Wrong password or auth failed";
    case WL_CONNECTION_LOST: return "Connection lost";
    case WL_DISCONNECTED: return "Disconnected";
    default: return "Still connecting...";
  }
}

bool connectWiFi() {
  Serial.printf("Connecting to \"%s\" (2.4 GHz only)...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const int maxAttempts = 40; // ~20 seconds
  for (int attempt = 0; attempt < maxAttempts; attempt++) {
    wl_status_t status = WiFi.status();
    if (status == WL_CONNECTED) {
      Serial.println("WiFi Connected");
      Serial.print("ESP32 IP Address: ");
      Serial.println(WiFi.localIP());
      return true;
    }
    Serial.print(".");
    if (attempt % 4 == 3) {
      Serial.printf(" [%s] ", wifiStatusText(status));
    }
    delay(500);
  }

  Serial.println();
  Serial.printf(
    "WiFi failed after %d s. Status=%d (%s)\n",
    maxAttempts / 2,
    WiFi.status(),
    wifiStatusText(WiFi.status())
  );
  Serial.println("Check: SSID/password, 2.4 GHz network, router in range.");
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nNavSense ESP32 starting...");
  pinMode(pirPin, INPUT);
  pinMode(soundPin, INPUT);
  dht.begin();

  if (!connectWiFi()) {
    Serial.println("Retrying WiFi in loop() — fix credentials or network.");
  }

  timeClient.begin();
}

void loop() {
  // Prevent timeClient from freezing the loop if NTP is blocked
  static unsigned long lastNTP = 0;
  if (millis() - lastNTP > 60000 || lastNTP == 0) {
    timeClient.update();
    lastNTP = millis();
  }
  
  // ==========================================
  // 1. CONTINUOUS FAST SENSING (Semi-Blocking)
  // ==========================================
  
  // Catch any motion instantly before the window
  if (digitalRead(pirPin) == HIGH) {
    motionDetectedSinceLastPush = true;
  }
  
  // B. Sample sound cleanly for 100ms (immune to other loop delays)
  unsigned int sampleWindow = 100; 
  unsigned int signalMax = 0, signalMin = 4095;
  unsigned long start = millis();
  
  while (millis() - start < sampleWindow) {
    int s = analogRead(soundPin);
    if (s < 4095) {
      if (s > signalMax) signalMax = s;
      if (s < signalMin) signalMin = s;
    }
    // Also check PIR inside this loop so we never miss a quick movement
    if (digitalRead(pirPin) == HIGH) {
      motionDetectedSinceLastPush = true;
    }
  }
  
  // Map tiny analog peaks (150) to high dB values for extreme sensitivity
  float dB = map(signalMax - signalMin, 0, 150, 40, 110);
  if (dB < 40) dB = 40;
  if (dB > 110) dB = 110; // Cap at 110dB so it doesn't overflow
  
  // Remember the loudest sound heard in this 3-second interval
  if (dB > maxDbSinceLastPush) {
    maxDbSinceLastPush = dB;
  }
  
  // ==========================================
  // 2. PERIODIC DATA PUSH (Every 3 seconds)
  // ==========================================
  // Non-blocking timer: millis() tracks total uptime in milliseconds.
  // Subtracting lastNetworkPushMillis gives time passed since the last data push.
  // If 3000ms (3 seconds) have passed, we push the data and reset the timer.
  // This allows the ESP32 to keep sensing continuously without freezing.
  if (millis() - lastNetworkPushMillis >= PUSH_INTERVAL) {
    lastNetworkPushMillis = millis(); // Reset the timer for the next 3-second interval
    
    // Read DHT11 (Slow sensor, takes ~250ms)
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    
    // Read Light
    int ldr = analogRead(ldrPin);
    bool lightOn = (ldr < 2000); 
    
    // Occupancy: motion or loud noise this interval; 15s debounce after activity stops
    bool activityNow = motionDetectedSinceLastPush || maxDbSinceLastPush > 60;
    if (activityNow) {
      lastOccupancyTime = millis();
      hasStartedOccupancy = true;
    }
    bool isOcc = activityNow;
    if (!isOcc && hasStartedOccupancy) {
      isOcc = (millis() - lastOccupancyTime < OCCUPANCY_DEBOUNCE_MS);
    }

    // --- Serial Monitor Preview ---
    Serial.print(timeClient.getFormattedTime()); 
    Serial.print(" -> ");
    Serial.print("Light("); Serial.print(lightOn ? "ON" : "OFF"); Serial.print(") , ");
    Serial.print("PIR("); Serial.print(motionDetectedSinceLastPush ? "ON" : "OFF"); Serial.print(") , ");
    Serial.print(maxDbSinceLastPush, 1); Serial.print("dB , ");
    Serial.print(t, 1); Serial.print("°C -> ");
    
    // --- Send to Next.js API ---
    if(WiFi.status() == WL_CONNECTED){
      WiFiClient client;
      HTTPClient http;
      
      http.begin(client, NEXTJS_SERVER_URL);
      http.addHeader("Content-Type", "application/json");
      http.setTimeout(15000); 
      
      StaticJsonDocument<256> doc;
      doc["room_id"] = TARGET_ROOM_ID;
      if (isnan(t)) doc["temp"] = 0; else doc["temp"] = t; 
      if (isnan(h)) doc["humidity"] = 0; else doc["humidity"] = h;
      
      doc["noise_level"] = maxDbSinceLastPush;
      doc["is_occupied"] = isOcc;
      doc["light_status"] = lightOn;
      
      String requestBody;
      serializeJson(doc, requestBody);
      
      int httpResponseCode = http.POST(requestBody);
      
      if (httpResponseCode > 0) {
        Serial.print("Data pushed. API Code: ");
        Serial.println(httpResponseCode);
        String response = http.getString(); // clear buffer completely
      } else {
        Serial.print("Failed to push. Error code: ");
        Serial.println(httpResponseCode);
      }
      
      http.end();
      client.stop(); // Force socket to close properly
    } else {
      Serial.println("WiFi Disconnected! Reconnecting...");
      connectWiFi();
    }
    
    // --- Reset trackers for the next interval ---
    motionDetectedSinceLastPush = false;
    maxDbSinceLastPush = 40.0;
  }
}
