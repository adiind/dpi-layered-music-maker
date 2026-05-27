#include <Wire.h>
#include <Adafruit_PN532.h>

#ifndef SDA
#define SDA 22
#endif

#ifndef SCL
#define SCL 23
#endif

#ifndef D6
#define D6 16
#endif

#ifndef D7
#define D7 17
#endif

// The Adafruit PN532 library accepts -1 for unused IRQ and reset pins.
#define PN532_IRQ -1
#define PN532_RESET -1
#define PN532_UART_RX D7
#define PN532_UART_TX D6

HardwareSerial pn532Serial(1);
Adafruit_PN532 nfcI2C(PN532_IRQ, PN532_RESET, &Wire);
Adafruit_PN532 nfcUART(PN532_RESET, &pn532Serial);
Adafruit_PN532 *nfc = nullptr;
const char *readerPort = nullptr;
unsigned long lastReaderRetryMs = 0;

static String uidToHex(const uint8_t *uid, uint8_t uidLength) {
  String out;
  for (uint8_t i = 0; i < uidLength; i++) {
    if (uid[i] < 0x10) {
      out += '0';
    }
    out += String(uid[i], HEX);
    if (i + 1 < uidLength) {
      out += ':';
    }
  }
  out.toUpperCase();
  return out;
}

static const char *tagFamily(uint8_t uidLength) {
  switch (uidLength) {
    case 4:
      return "MIFARE Classic / 4-byte ISO14443A";
    case 7:
      return "MIFARE Ultralight / NTAG / 7-byte ISO14443A";
    case 10:
      return "10-byte ISO14443A";
    default:
      return "ISO14443A";
  }
}

static void scanI2CBus() {
  Serial.println("Scanning I2C bus...");
  bool foundDevice = false;

  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      foundDevice = true;
      Serial.print("  Found I2C device at 0x");
      if (address < 0x10) {
        Serial.print('0');
      }
      Serial.println(address, HEX);
    }
  }

  if (!foundDevice) {
    Serial.println("  No I2C devices found.");
  }
}

static bool startReader(Adafruit_PN532 &reader, const char *portName) {
  Serial.print("Trying PN532 on ");
  Serial.println(portName);

  if (!reader.begin()) {
    Serial.println("  PN532 begin failed.");
    return false;
  }

  uint32_t versionData = reader.getFirmwareVersion();
  if (!versionData) {
    Serial.println("  No PN532 response.");
    return false;
  }

  Serial.print("Found PN5");
  Serial.print((versionData >> 24) & 0xFF, HEX);
  Serial.print(" firmware ");
  Serial.print((versionData >> 16) & 0xFF, DEC);
  Serial.print('.');
  Serial.println((versionData >> 8) & 0xFF, DEC);

  reader.SAMConfig();
  reader.setPassiveActivationRetries(0x10);
  nfc = &reader;
  readerPort = portName;
  return true;
}

static bool startUARTReader(int8_t rxPin, int8_t txPin, const char *portName) {
  pn532Serial.end();
  delay(50);
  pn532Serial.setPins(rxPin, txPin);
  pn532Serial.begin(115200, SERIAL_8N1, rxPin, txPin);
  delay(100);
  return startReader(nfcUART, portName);
}

static bool tryAllReaderPorts() {
  scanI2CBus();

  if (startReader(nfcI2C, "Grove I2C port (PN532 I2C mode, address 0x24)")) {
    return true;
  }

  if (startUARTReader(PN532_UART_RX, PN532_UART_TX,
                      "Grove UART port (RX=D7/GPIO17, TX=D6/GPIO16)")) {
    return true;
  }

  return startUARTReader(PN532_UART_TX, PN532_UART_RX,
                         "Grove UART port with swapped pins (RX=D6/GPIO16, TX=D7/GPIO17)");
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) {
    delay(10);
  }

  Serial.println();
  Serial.println("XIAO ESP32-C6 + PN532 NFC reader");
  Serial.println("Bring an NFC tag near the PN532 to print its UID.");
  Serial.println("I2C Grove port: SDA=D4/GPIO22, SCL=D5/GPIO23.");
  Serial.println("UART Grove port: XIAO RX=D7/GPIO17, TX=D6/GPIO16.");

  Wire.begin(SDA, SCL);
  Wire.setClock(100000);
  tryAllReaderPorts();

  if (nfc == nullptr) {
    Serial.println();
    Serial.println("Didn't find a PN532.");
    Serial.println("Use the I2C/IIC Grove socket if the PN532 is switched to I2C mode.");
    Serial.println("Use the UART Grove socket if the PN532 is still in its default UART mode.");
    Serial.println("For I2C, the PN532 should show up at address 0x24.");
    Serial.println("I will keep retrying every 3 seconds.");
    return;
  }

  Serial.print("Ready for NFC tags on ");
  Serial.println(readerPort);
}

void loop() {
  if (nfc == nullptr) {
    if (millis() - lastReaderRetryMs >= 3000) {
      lastReaderRetryMs = millis();
      Serial.println();
      Serial.println("Retrying PN532 detection...");
      if (tryAllReaderPorts()) {
        Serial.print("Ready for NFC tags on ");
        Serial.println(readerPort);
      }
    }
    delay(50);
    return;
  }

  uint8_t uid[10] = {0};
  uint8_t uidLength = 0;

  bool tagFound = nfc->readPassiveTargetID(
      PN532_MIFARE_ISO14443A,
      uid,
      &uidLength,
      250);

  if (tagFound) {
    Serial.println();
    Serial.println("NFC tag recognized");
    Serial.print("  Type: ");
    Serial.println(tagFamily(uidLength));
    Serial.print("  UID length: ");
    Serial.print(uidLength);
    Serial.println(" bytes");
    Serial.print("  UID: ");
    Serial.println(uidToHex(uid, uidLength));

    while (nfc->readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 250)) {
      delay(100);
    }
    Serial.println("Tag removed. Ready for another tag.");
  }

  delay(50);
}
