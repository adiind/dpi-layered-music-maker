#include <Arduino.h>
#include <Adafruit_NeoPixel.h>
#include <Adafruit_PN532.h>

// DPI final demo controller for an ESP32-WROOM-32 / 38-pin dev board.
// Hardware: 5x KY-040 rotary encoders and 5x PN532 readers in SPI mode.
// Serial baud: 115200.
//
// App-to-controller serial commands:
//   WRITE:<tagId>:<layerId>:<optionId>
//   VOLUME:<layerId>:<0-100>
//
// App-readable serial events:
//   LAYER:<layerId>:<optionId>
//   TAG:<tagId>:<uid>
//   TAG_PRESENT:<tagId>:<uid>
//   TAG_REMOVED:<tagId>
//   BUTTON:<layerId>:PRESS
//   ENC:<layerId>:+1|-1
//   VOLUME:<layerId>:<0-100>
//   MUTE:<layerId>:0|1
//   WRITE_READY:<tagId>:<payload>
//   WRITE_SUCCESS:<tagId>:<uid>:<layerId>:<optionId>
//   WRITE_UNVERIFIED:<tagId>:<uid>:<layerId>:<optionId>:<reason>
//   WRITE_FAIL:<tagId>:<reason>
//   READ_CARD:<tagId>:<uid>:<layerId>:<optionId>:<payload>
//   TAG_UNSUPPORTED:<tagId>:<uid>:uid-length-{n}

constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint16_t NFC_READ_TIMEOUT_MS = 120;
constexpr uint16_t NFC_WRITE_READ_TIMEOUT_MS = 220;
constexpr uint32_t NFC_REPEAT_WINDOW_MS = 1200;
constexpr uint32_t NFC_REMOVED_WINDOW_MS = 1600;
constexpr uint32_t NFC_RETRY_WINDOW_MS = 3000;
constexpr uint32_t NFC_WRITE_TIMEOUT_MS = 6000;
constexpr uint16_t SERIAL_COMMAND_LIMIT = 160;
constexpr uint16_t NDEF_READ_LIMIT = 160;
constexpr size_t DPI_PAYLOAD_LIMIT = 96;
constexpr uint32_t BUTTON_DEBOUNCE_MS = 45;
constexpr uint8_t ENCODER_VOLUME_STEP_PERCENT = 4;

const char DPI_PAYLOAD_PREFIX[] = "dpi://v1/layer/";
const char DPI_PAYLOAD_OPTION_MARKER[] = "/option/";

constexpr uint8_t PN532_SCK = 18;
constexpr uint8_t PN532_MISO = 19;
constexpr uint8_t PN532_MOSI = 23;

constexpr uint8_t PN532_CS_FOUNDATION = 5;
constexpr uint8_t PN532_CS_TEXTURE = 4;
constexpr uint8_t PN532_CS_DRUMS = 15;
constexpr uint8_t PN532_CS_KEYS = 2;
constexpr uint8_t PN532_CS_SOLO = 0;

constexpr uint8_t NEOPIXEL_PIN = 12;
constexpr uint8_t NEOPIXEL_COUNT = 25;
constexpr uint8_t NEOPIXELS_PER_LAYER = 5;
constexpr uint8_t NEOPIXEL_MAX_BRIGHTNESS = 140;

Adafruit_PN532 nfcFoundation(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_CS_FOUNDATION);
Adafruit_PN532 nfcTexture(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_CS_TEXTURE);
Adafruit_PN532 nfcDrums(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_CS_DRUMS);
Adafruit_PN532 nfcKeys(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_CS_KEYS);
Adafruit_PN532 nfcSolo(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_CS_SOLO);
Adafruit_NeoPixel layerPixels(NEOPIXEL_COUNT, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);

struct LayerSpec {
  const char *id;
  const char *name;
  const char *options[3];
  uint8_t red;
  uint8_t green;
  uint8_t blue;
};

const LayerSpec LAYERS[] = {
    {"foundation", "Foundation", {"bass-guitar", "bass-guitar-b", "bouncy-synth-chords"}, 255, 210, 0},
    {"texture", "Texture", {"synth-wavey", "brushed-snare", "ethereal-echo-thing"}, 255, 116, 0},
    {"drums", "Drums", {"drum-simple", "drum-poom-tss", "drum-w-duck"}, 255, 35, 30},
    {"keys", "Keys", {"piano-1", "piano-2", "piano-3"}, 0, 190, 80},
    {"solo", "Solo", {"guitar-notes", "distort-guitar", "piano-solo"}, 0, 120, 255},
};

struct EncoderState {
  const char *layerId;
  const char *label;
  uint8_t clkPin;
  uint8_t dtPin;
  uint8_t swPin;
  uint8_t lastState;
  int8_t accumulator;
  bool lastButtonPressed;
  uint32_t lastButtonChangeMs;
};

EncoderState encoders[] = {
    {"foundation", "Foundation", 32, 33, 25, 0, 0, false, 0},
    {"texture", "Texture", 26, 27, 14, 0, 0, false, 0},
    {"drums", "Drums", 16, 17, 13, 0, 0, false, 0},
    {"keys", "Keys", 34, 35, 21, 0, 0, false, 0},
    {"solo", "Solo", 36, 39, 22, 0, 0, false, 0},
};

struct NfcReaderState {
  const char *tagId;
  const char *layerId;
  const char *label;
  uint8_t csPin;
  Adafruit_PN532 *reader;
  bool ready;
  bool tagPresent;
  uint32_t lastRetryMs;
  uint32_t lastSeenMs;
  uint32_t lastPresenceEmitMs;
  String lastUid;
};

NfcReaderState nfcReaders[] = {
    {"tag-1", "foundation", "Foundation reader", PN532_CS_FOUNDATION, &nfcFoundation, false, false, 0, 0, 0, ""},
    {"tag-2", "texture", "Texture reader", PN532_CS_TEXTURE, &nfcTexture, false, false, 0, 0, 0, ""},
    {"tag-3", "drums", "Drums reader", PN532_CS_DRUMS, &nfcDrums, false, false, 0, 0, 0, ""},
    {"tag-4", "keys", "Keys reader", PN532_CS_KEYS, &nfcKeys, false, false, 0, 0, 0, ""},
    {"tag-5", "solo", "Solo reader", PN532_CS_SOLO, &nfcSolo, false, false, 0, 0, 0, ""},
};

constexpr size_t LAYER_COUNT = sizeof(LAYERS) / sizeof(LAYERS[0]);
constexpr size_t ENCODER_COUNT = sizeof(encoders) / sizeof(encoders[0]);
constexpr size_t NFC_READER_COUNT = sizeof(nfcReaders) / sizeof(nfcReaders[0]);

String serialCommand;
String lastNtagReadError;
uint8_t layerVolumes[LAYER_COUNT] = {80, 75, 70, 78, 82};
bool layerMuted[LAYER_COUNT] = {false, false, false, false, false};
bool layerTagPresent[LAYER_COUNT] = {false, false, false, false, false};

// Quadrature transition table. Four valid transitions make one detent.
const int8_t QUADRATURE_TABLE[16] = {
    0, -1, 1, 0,
    1, 0, 0, -1,
    -1, 0, 0, 1,
    0, 1, -1, 0,
};

static bool supportsInternalPullup(uint8_t pin) {
  return pin < 34;
}

static uint8_t readEncoderState(const EncoderState &encoder) {
  const uint8_t clk = digitalRead(encoder.clkPin) == HIGH ? 1 : 0;
  const uint8_t dt = digitalRead(encoder.dtPin) == HIGH ? 1 : 0;
  return (clk << 1) | dt;
}

static const LayerSpec *findLayer(const char *layerId) {
  for (size_t index = 0; index < LAYER_COUNT; index++) {
    if (strcmp(LAYERS[index].id, layerId) == 0) {
      return &LAYERS[index];
    }
  }

  return nullptr;
}

static int8_t findLayerIndex(const char *layerId) {
  for (size_t index = 0; index < LAYER_COUNT; index++) {
    if (strcmp(LAYERS[index].id, layerId) == 0) {
      return (int8_t)index;
    }
  }

  return -1;
}

static uint8_t scaleColor(uint8_t value, uint8_t volumePercent) {
  const uint16_t scaledBrightness = ((uint16_t)NEOPIXEL_MAX_BRIGHTNESS * volumePercent) / 100;
  return ((uint16_t)value * scaledBrightness) / 255;
}

static void renderNeoPixels() {
  for (size_t layerIndex = 0; layerIndex < LAYER_COUNT; layerIndex++) {
    const LayerSpec &layer = LAYERS[layerIndex];
    const uint8_t volume = layerMuted[layerIndex] || !layerTagPresent[layerIndex] ? 0 : layerVolumes[layerIndex];
    const uint8_t red = scaleColor(layer.red, volume);
    const uint8_t green = scaleColor(layer.green, volume);
    const uint8_t blue = scaleColor(layer.blue, volume);

    for (uint8_t pixelOffset = 0; pixelOffset < NEOPIXELS_PER_LAYER; pixelOffset++) {
      const uint16_t pixelIndex = (layerIndex * NEOPIXELS_PER_LAYER) + pixelOffset;
      if (pixelIndex < NEOPIXEL_COUNT) {
        layerPixels.setPixelColor(pixelIndex, red, green, blue);
      }
    }
  }

  layerPixels.show();
}

static void setReaderLayerPresence(const NfcReaderState &readerState, bool present) {
  const int8_t layerIndex = findLayerIndex(readerState.layerId);
  if (layerIndex < 0) return;

  layerTagPresent[layerIndex] = present;
  renderNeoPixels();
}

static bool setLayerVolume(const char *layerId, int percent) {
  const int8_t layerIndex = findLayerIndex(layerId);
  if (layerIndex < 0) {
    return false;
  }

  layerVolumes[layerIndex] = constrain(percent, 0, 100);
  if (percent > 0) {
    layerMuted[layerIndex] = false;
  }
  renderNeoPixels();
  return true;
}

static NfcReaderState *findNfcReader(const char *tagId) {
  for (size_t index = 0; index < NFC_READER_COUNT; index++) {
    if (strcmp(nfcReaders[index].tagId, tagId) == 0) {
      return &nfcReaders[index];
    }
  }

  return nullptr;
}

static const char *findLayerOption(const LayerSpec &layer, const char *optionId) {
  for (uint8_t index = 0; index < 3; index++) {
    if (strcmp(layer.options[index], optionId) == 0) {
      return layer.options[index];
    }
  }

  return nullptr;
}

static String buildDpiPayload(const char *layerId, const char *optionId) {
  String payload = DPI_PAYLOAD_PREFIX;
  payload += layerId;
  payload += DPI_PAYLOAD_OPTION_MARKER;
  payload += optionId;
  return payload;
}

static void printWriteFail(const char *tagId, const char *reason) {
  Serial.print("WRITE_FAIL:");
  Serial.print(tagId);
  Serial.print(":");
  Serial.println(reason);
}

static void printWriteDebug(const char *tagId, const String &message) {
  Serial.print("WRITE_DEBUG:");
  Serial.print(tagId);
  Serial.print(":");
  Serial.println(message);
}

static void printWriteUnverified(
    const NfcReaderState &readerState,
    const String &uidText,
    const LayerSpec &layer,
    const char *optionId,
    const String &reason) {
  Serial.print("WRITE_UNVERIFIED:");
  Serial.print(readerState.tagId);
  Serial.print(":");
  Serial.print(uidText);
  Serial.print(":");
  Serial.print(layer.id);
  Serial.print(":");
  Serial.print(optionId);
  Serial.print(":");
  Serial.println(reason);
}

static void printTagUnsupported(const NfcReaderState &readerState, const String &uidText, uint8_t uidLength) {
  Serial.print("TAG_UNSUPPORTED:");
  Serial.print(readerState.tagId);
  Serial.print(":");
  Serial.print(uidText);
  Serial.print(":uid-length-");
  Serial.println(uidLength);
}

static void printTagPresent(const NfcReaderState &readerState, const String &uidText) {
  Serial.print("TAG_PRESENT:");
  Serial.print(readerState.tagId);
  Serial.print(":");
  Serial.println(uidText);
}

static void printTagRemoved(const NfcReaderState &readerState) {
  Serial.print("TAG_REMOVED:");
  Serial.println(readerState.tagId);
}

static void printLayerVolume(const char *layerId, uint8_t volumePercent) {
  Serial.print("VOLUME:");
  Serial.print(layerId);
  Serial.print(":");
  Serial.println(volumePercent);
}

static void printLayerMute(const char *layerId, bool muted) {
  Serial.print("MUTE:");
  Serial.print(layerId);
  Serial.print(":");
  Serial.println(muted ? 1 : 0);
}

static void adjustLayerVolumeFromEncoder(EncoderState &encoder, int8_t direction) {
  const int8_t layerIndex = findLayerIndex(encoder.layerId);
  if (layerIndex < 0) return;

  const int nextVolume = (int)layerVolumes[layerIndex] + (direction * ENCODER_VOLUME_STEP_PERCENT);
  layerVolumes[layerIndex] = constrain(nextVolume, 0, 100);
  if (layerMuted[layerIndex]) {
    layerMuted[layerIndex] = false;
    printLayerMute(encoder.layerId, false);
  }

  renderNeoPixels();

  Serial.print("ENC:");
  Serial.print(encoder.layerId);
  Serial.println(direction > 0 ? ":+1" : ":-1");
  printLayerVolume(encoder.layerId, layerVolumes[layerIndex]);
}

static void toggleLayerMuteFromEncoder(EncoderState &encoder) {
  const int8_t layerIndex = findLayerIndex(encoder.layerId);
  if (layerIndex < 0) return;

  layerMuted[layerIndex] = !layerMuted[layerIndex];
  renderNeoPixels();
  printLayerMute(encoder.layerId, layerMuted[layerIndex]);
  printLayerVolume(encoder.layerId, layerMuted[layerIndex] ? 0 : layerVolumes[layerIndex]);
}

static void readEncoders() {
  for (size_t index = 0; index < ENCODER_COUNT; index++) {
    EncoderState &encoder = encoders[index];
    const uint8_t currentState = readEncoderState(encoder);
    const uint8_t transition = (encoder.lastState << 2) | currentState;
    const int8_t movement = QUADRATURE_TABLE[transition];

    if (movement != 0) {
      encoder.accumulator += movement;

      if (encoder.accumulator >= 4) {
        encoder.accumulator = 0;
        adjustLayerVolumeFromEncoder(encoder, 1);
      } else if (encoder.accumulator <= -4) {
        encoder.accumulator = 0;
        adjustLayerVolumeFromEncoder(encoder, -1);
      }
    }

    encoder.lastState = currentState;

    const bool buttonPressed = digitalRead(encoder.swPin) == LOW;
    const uint32_t now = millis();

    if (buttonPressed != encoder.lastButtonPressed && now - encoder.lastButtonChangeMs >= BUTTON_DEBOUNCE_MS) {
      encoder.lastButtonPressed = buttonPressed;
      encoder.lastButtonChangeMs = now;

      if (buttonPressed) {
        Serial.print("BUTTON:");
        Serial.print(encoder.layerId);
        Serial.println(":PRESS");
        toggleLayerMuteFromEncoder(encoder);
      }
    }
  }
}

static String uidToHex(const uint8_t *uid, uint8_t uidLength) {
  String output;

  for (uint8_t index = 0; index < uidLength; index++) {
    if (uid[index] < 0x10) {
      output += '0';
    }

    output += String(uid[index], HEX);

    if (index + 1 < uidLength) {
      output += ':';
    }
  }

  output.toUpperCase();
  return output;
}

static bool parseDpiPayload(const String &payload, const LayerSpec **layerOut, const char **optionOut) {
  const int prefixLength = strlen(DPI_PAYLOAD_PREFIX);
  if (!payload.startsWith(DPI_PAYLOAD_PREFIX)) {
    return false;
  }

  const int optionMarker = payload.indexOf(DPI_PAYLOAD_OPTION_MARKER, prefixLength);
  if (optionMarker < 0) {
    return false;
  }

  const int optionStart = optionMarker + strlen(DPI_PAYLOAD_OPTION_MARKER);
  const String layerId = payload.substring(prefixLength, optionMarker);
  const String optionId = payload.substring(optionStart);
  const LayerSpec *layer = findLayer(layerId.c_str());
  if (!layer) {
    return false;
  }

  const char *option = findLayerOption(*layer, optionId.c_str());
  if (!option) {
    return false;
  }

  *layerOut = layer;
  *optionOut = option;
  return true;
}

static bool parseNdefUriRecord(const uint8_t *message, uint16_t messageLength, String &payload) {
  if (messageLength < 5) {
    return false;
  }

  const uint8_t header = message[0];
  const bool shortRecord = (header & 0x10) != 0;
  const bool hasIdLength = (header & 0x08) != 0;
  const uint8_t typeNameFormat = header & 0x07;
  uint32_t uriPayloadLength = 0;
  uint16_t cursor = 0;

  if (typeNameFormat != 0x01) {
    return false;
  }

  const uint8_t typeLength = message[1];
  if (shortRecord) {
    uriPayloadLength = message[2];
    cursor = 3;
  } else {
    if (messageLength < 7) {
      return false;
    }

    uriPayloadLength = ((uint32_t)message[2] << 24) |
                       ((uint32_t)message[3] << 16) |
                       ((uint32_t)message[4] << 8) |
                       message[5];
    cursor = 6;
  }

  uint8_t idLength = 0;
  if (hasIdLength) {
    if (cursor >= messageLength) {
      return false;
    }

    idLength = message[cursor++];
  }

  if (uriPayloadLength < 1 || uriPayloadLength > UINT16_MAX) {
    return false;
  }

  if ((uint32_t)cursor + typeLength + idLength + uriPayloadLength > messageLength) {
    return false;
  }

  if (typeLength != 1 || message[cursor] != 0x55) {
    return false;
  }

  cursor += typeLength + idLength;
  const uint8_t uriPrefix = message[cursor++];
  if (uriPrefix != NDEF_URIPREFIX_NONE) {
    return false;
  }

  payload = "";
  payload.reserve(uriPayloadLength - 1);
  for (uint32_t index = 1; index < uriPayloadLength; index++) {
    const char nextChar = (char)message[cursor++];
    if (nextChar < 32 || nextChar > 126) {
      return false;
    }

    payload += nextChar;
  }

  return payload.startsWith(DPI_PAYLOAD_PREFIX);
}

static bool readNtagPageWithRetry(Adafruit_PN532 &reader, uint8_t pageNumber, uint8_t *page) {
  for (uint8_t attempt = 0; attempt < 3; attempt++) {
    if (reader.ntag2xx_ReadPage(pageNumber, page)) {
      return true;
    }

    delay(20);
  }

  lastNtagReadError = "page-read-failed-";
  lastNtagReadError += pageNumber;
  return false;
}

static bool readDpiPayloadFromKnownPages(Adafruit_PN532 &reader, String &payload) {
  payload = "";
  lastNtagReadError = "";

  uint8_t firstPage[4] = {0};
  if (!readNtagPageWithRetry(reader, 4, firstPage)) {
    return false;
  }

  if (firstPage[0] != 0x03) {
    lastNtagReadError = "dpi-tlv-not-at-page-4";
    return false;
  }

  const uint16_t tlvLength = firstPage[1];
  if (tlvLength == 0 || tlvLength == 0xFF || tlvLength > NDEF_READ_LIMIT - 3) {
    lastNtagReadError = "dpi-tlv-length-invalid";
    return false;
  }

  const uint16_t totalLength = tlvLength + 2;
  uint8_t data[NDEF_READ_LIMIT] = {0};
  memcpy(data, firstPage, 4);

  uint16_t loaded = 4;
  while (loaded < totalLength) {
    uint8_t page[4] = {0};
    const uint8_t pageNumber = 4 + (loaded / 4);
    if (!readNtagPageWithRetry(reader, pageNumber, page)) {
      return false;
    }

    const uint8_t bytesToCopy = min((uint16_t)4, (uint16_t)(totalLength - loaded));
    memcpy(data + loaded, page, bytesToCopy);
    loaded += bytesToCopy;
  }

  if (!parseNdefUriRecord(data + 2, tlvLength, payload)) {
    lastNtagReadError = "dpi-payload-not-found";
    return false;
  }

  return true;
}

static bool readDpiPayloadFromNtag(Adafruit_PN532 &reader, String &payload) {
  payload = "";
  lastNtagReadError = "";

  if (readDpiPayloadFromKnownPages(reader, payload)) {
    return true;
  }
  const String directReadError = lastNtagReadError;

  uint8_t cc[4] = {0};
  if (!readNtagPageWithRetry(reader, 3, cc)) {
    if (directReadError.length() > 0) {
      lastNtagReadError = directReadError;
    }
    return false;
  }

  if (cc[0] != 0xE1 || (cc[1] & 0xF0) != 0x10) {
    lastNtagReadError = "ndef-capability-missing";
    return false;
  }

  uint16_t dataLength = (uint16_t)cc[2] * 8;
  if (dataLength == 0) {
    lastNtagReadError = "ndef-data-length-zero";
    return false;
  }

  if (dataLength > NDEF_READ_LIMIT) {
    dataLength = NDEF_READ_LIMIT;
  }

  uint8_t data[NDEF_READ_LIMIT] = {0};
  uint16_t loaded = 0;
  uint16_t needed = 8;

  while (loaded < dataLength) {
    while (loaded < needed && loaded < dataLength) {
      uint8_t page[4] = {0};
      const uint8_t pageNumber = 4 + (loaded / 4);
      if (!readNtagPageWithRetry(reader, pageNumber, page)) {
        return false;
      }

      const uint8_t bytesToCopy = min((uint16_t)4, (uint16_t)(dataLength - loaded));
      memcpy(data + loaded, page, bytesToCopy);
      loaded += bytesToCopy;
    }

    uint16_t cursor = 0;
    bool needsMoreBytes = false;
    while (cursor < loaded) {
      const uint8_t tlvType = data[cursor++];
      if (tlvType == 0x00) {
        continue;
      }

      if (tlvType == 0xFE) {
        lastNtagReadError = "ndef-terminator-before-dpi-payload";
        return false;
      }

      if (cursor >= loaded) {
        needed = min((uint16_t)(loaded + 4), dataLength);
        needsMoreBytes = true;
        break;
      }

      uint16_t tlvLength = data[cursor++];
      if (tlvLength == 0xFF) {
        if (cursor + 1 >= loaded) {
          needed = min((uint16_t)(loaded + 4), dataLength);
          needsMoreBytes = true;
          break;
        }

        tlvLength = ((uint16_t)data[cursor] << 8) | data[cursor + 1];
        cursor += 2;
      }

      if (cursor + tlvLength > loaded) {
        needed = min((uint16_t)(cursor + tlvLength), dataLength);
        needsMoreBytes = true;
        break;
      }

      if (tlvType == 0x03 && parseNdefUriRecord(data + cursor, tlvLength, payload)) {
        return true;
      }

      cursor += tlvLength;
    }

    if (!needsMoreBytes) {
      break;
    }
  }

  lastNtagReadError = "dpi-payload-not-found";
  return false;
}

static void printReadCard(const NfcReaderState &readerState, const String &uidText, const String &payload) {
  const LayerSpec *layer = nullptr;
  const char *option = nullptr;
  if (!parseDpiPayload(payload, &layer, &option)) {
    return;
  }

  Serial.print("READ_CARD:");
  Serial.print(readerState.tagId);
  Serial.print(":");
  Serial.print(uidText);
  Serial.print(":");
  Serial.print(layer->id);
  Serial.print(":");
  Serial.print(option);
  Serial.print(":");
  Serial.println(payload);
}

static bool readNtagDataLength(Adafruit_PN532 &reader, uint16_t &dataLength) {
  uint8_t cc[4] = {0};
  if (!readNtagPageWithRetry(reader, 3, cc)) {
    return false;
  }

  if (cc[0] != 0xE1 || (cc[1] & 0xF0) != 0x10) {
    return false;
  }

  dataLength = (uint16_t)cc[2] * 8;
  return dataLength > 0;
}

static bool writeDpiPayloadAsNdef(Adafruit_PN532 &reader, const String &payload, uint16_t dataLength) {
  const uint16_t uriLength = payload.length();
  const uint16_t ndefLength = uriLength + 5;
  const uint16_t tlvLength = ndefLength + 3;
  if (uriLength == 0 || uriLength >= DPI_PAYLOAD_LIMIT || ndefLength > 254 || tlvLength > dataLength) {
    return false;
  }

  uint8_t data[DPI_PAYLOAD_LIMIT + 8] = {0};
  uint16_t cursor = 0;
  data[cursor++] = 0x03;
  data[cursor++] = (uint8_t)ndefLength;
  data[cursor++] = 0xD1;
  data[cursor++] = 0x01;
  data[cursor++] = (uint8_t)(uriLength + 1);
  data[cursor++] = 0x55;
  data[cursor++] = NDEF_URIPREFIX_NONE;

  for (uint16_t index = 0; index < uriLength; index++) {
    data[cursor++] = (uint8_t)payload[index];
  }

  data[cursor++] = 0xFE;

  const uint8_t pagesToWrite = (cursor + 3) / 4;
  for (uint8_t pageOffset = 0; pageOffset < pagesToWrite; pageOffset++) {
    uint8_t page[4] = {0};
    for (uint8_t byteOffset = 0; byteOffset < 4; byteOffset++) {
      const uint16_t dataIndex = (pageOffset * 4) + byteOffset;
      if (dataIndex < cursor) {
        page[byteOffset] = data[dataIndex];
      }
    }

    if (!reader.ntag2xx_WritePage(4 + pageOffset, page)) {
      return false;
    }

    delay(12);
  }

  return true;
}

static bool verifyDpiPayloadOnTag(NfcReaderState &readerState, const String &expectedPayload, String &verifiedPayload) {
  for (uint8_t attempt = 0; attempt < 4; attempt++) {
    uint8_t uid[10] = {0};
    uint8_t uidLength = 0;
    readerState.reader->readPassiveTargetID(
        PN532_MIFARE_ISO14443A,
        uid,
        &uidLength,
        NFC_WRITE_READ_TIMEOUT_MS);

    if (readDpiPayloadFromNtag(*readerState.reader, verifiedPayload)) {
      return verifiedPayload == expectedPayload;
    }

    delay(80);
  }

  return false;
}

static bool waitForCardOnReader(NfcReaderState &readerState, uint8_t *uid, uint8_t *uidLength) {
  const uint32_t startMs = millis();

  while (millis() - startMs < NFC_WRITE_TIMEOUT_MS) {
    deselectAllNfcReaders();

    if (readerState.reader->readPassiveTargetID(
            PN532_MIFARE_ISO14443A,
            uid,
            uidLength,
            NFC_WRITE_READ_TIMEOUT_MS)) {
      return true;
    }

    readEncoders();
    delay(5);
  }

  return false;
}

static void writeDpiPayloadToTag(NfcReaderState &readerState, const LayerSpec &layer, const char *optionId) {
  if (!readerState.ready) {
    readerState.ready = startNfcReader(readerState);
    if (!readerState.ready) {
      printWriteFail(readerState.tagId, "reader-not-ready");
      return;
    }
  }

  const String payload = buildDpiPayload(layer.id, optionId);
  if (payload.length() >= DPI_PAYLOAD_LIMIT) {
    printWriteFail(readerState.tagId, "payload-too-long");
    return;
  }

  Serial.print("WRITE_READY:");
  Serial.print(readerState.tagId);
  Serial.print(":");
  Serial.println(payload);

  uint8_t uid[10] = {0};
  uint8_t uidLength = 0;
  if (!waitForCardOnReader(readerState, uid, &uidLength)) {
    printWriteFail(readerState.tagId, "no-card");
    return;
  }

  const String uidText = uidToHex(uid, uidLength);
  if (uidLength != 7) {
    printTagUnsupported(readerState, uidText, uidLength);
    printWriteFail(readerState.tagId, "uid-length-not-7");
    return;
  }

  uint16_t dataLength = 0;
  if (!readNtagDataLength(*readerState.reader, dataLength)) {
    printWriteFail(readerState.tagId, "ndef-capability-missing");
    return;
  }

  if (payload.length() + 8 > dataLength) {
    printWriteFail(readerState.tagId, "payload-too-large");
    return;
  }

  if (!writeDpiPayloadAsNdef(*readerState.reader, payload, dataLength)) {
    printWriteFail(readerState.tagId, "write-error");
    return;
  }

  delay(80);
  String verifiedPayload;
  if (!verifyDpiPayloadOnTag(readerState, payload, verifiedPayload)) {
    String reason = lastNtagReadError.length() > 0 ? lastNtagReadError : "readback-empty";
    String debugMessage = "verify-";
    debugMessage += reason;
    printWriteDebug(readerState.tagId, debugMessage);

    if (verifiedPayload.length() > 0) {
      printWriteFail(readerState.tagId, "verify-mismatch");
      return;
    }

    readerState.lastUid = uidText;
    readerState.lastSeenMs = millis();
    printWriteUnverified(readerState, uidText, layer, optionId, reason);
    return;
  }

  readerState.lastUid = uidText;
  readerState.lastSeenMs = millis();

  Serial.print("WRITE_SUCCESS:");
  Serial.print(readerState.tagId);
  Serial.print(":");
  Serial.print(uidText);
  Serial.print(":");
  Serial.print(layer.id);
  Serial.print(":");
  Serial.println(optionId);
}

static void handleWriteCommand(const String &command) {
  const int firstSeparator = command.indexOf(':');
  const int secondSeparator = command.indexOf(':', firstSeparator + 1);
  const int thirdSeparator = command.indexOf(':', secondSeparator + 1);

  if (firstSeparator < 0 || secondSeparator < 0 || thirdSeparator < 0) {
    printWriteFail("unknown", "bad-command");
    return;
  }

  const String tagId = command.substring(firstSeparator + 1, secondSeparator);
  const String layerId = command.substring(secondSeparator + 1, thirdSeparator);
  const String optionId = command.substring(thirdSeparator + 1);

  if (tagId.length() == 0 || layerId.length() == 0 || optionId.length() == 0) {
    printWriteFail(tagId.length() ? tagId.c_str() : "unknown", "empty-field");
    return;
  }

  NfcReaderState *readerState = findNfcReader(tagId.c_str());
  if (!readerState) {
    printWriteFail(tagId.c_str(), "unknown-tag");
    return;
  }

  const LayerSpec *layer = findLayer(layerId.c_str());
  if (!layer) {
    printWriteFail(readerState->tagId, "unknown-layer");
    return;
  }

  const char *option = findLayerOption(*layer, optionId.c_str());
  if (!option) {
    printWriteFail(readerState->tagId, "unknown-option");
    return;
  }

  writeDpiPayloadToTag(*readerState, *layer, option);
}

static void handleVolumeCommand(const String &command) {
  const int firstSeparator = command.indexOf(':');
  const int secondSeparator = command.indexOf(':', firstSeparator + 1);

  if (firstSeparator < 0 || secondSeparator < 0) {
    Serial.println("VOLUME_FAIL:bad-command");
    return;
  }

  const String layerId = command.substring(firstSeparator + 1, secondSeparator);
  const String percentValue = command.substring(secondSeparator + 1);

  if (layerId.length() == 0 || percentValue.length() == 0) {
    Serial.println("VOLUME_FAIL:empty-field");
    return;
  }

  if (!setLayerVolume(layerId.c_str(), percentValue.toInt())) {
    Serial.print("VOLUME_FAIL:unknown-layer:");
    Serial.println(layerId);
  }
}

static void handleSerialCommand(const String &command) {
  if (command.length() == 0) {
    return;
  }

  if (command.startsWith("WRITE:")) {
    handleWriteCommand(command);
  } else if (command.startsWith("VOLUME:")) {
    handleVolumeCommand(command);
  }
}

static void readSerialCommands() {
  while (Serial.available()) {
    const char nextChar = (char)Serial.read();

    if (nextChar == '\r') {
      continue;
    }

    if (nextChar == '\n') {
      handleSerialCommand(serialCommand);
      serialCommand = "";
      continue;
    }

    if (serialCommand.length() >= SERIAL_COMMAND_LIMIT) {
      serialCommand = "";
      printWriteFail("unknown", "command-too-long");
      continue;
    }

    serialCommand += nextChar;
  }
}

static void deselectAllNfcReaders() {
  for (size_t index = 0; index < NFC_READER_COUNT; index++) {
    digitalWrite(nfcReaders[index].csPin, HIGH);
  }
}

static bool startNfcReader(NfcReaderState &readerState) {
  deselectAllNfcReaders();

  Serial.print("PN532 ");
  Serial.print(readerState.tagId);
  Serial.print(" ");
  Serial.print(readerState.label);
  Serial.print(": trying SPI CS GPIO");
  Serial.println(readerState.csPin);

  if (!readerState.reader->begin()) {
    Serial.println("  begin failed");
    return false;
  }

  const uint32_t versionData = readerState.reader->getFirmwareVersion();
  if (!versionData) {
    Serial.println("  no response");
    return false;
  }

  Serial.print("  found PN5");
  Serial.print((versionData >> 24) & 0xFF, HEX);
  Serial.print(" firmware ");
  Serial.print((versionData >> 16) & 0xFF, DEC);
  Serial.print(".");
  Serial.println((versionData >> 8) & 0xFF, DEC);

  readerState.reader->SAMConfig();
  readerState.reader->setPassiveActivationRetries(0x08);
  readerState.tagPresent = false;
  readerState.lastSeenMs = 0;
  readerState.lastPresenceEmitMs = 0;
  readerState.lastUid = "";
  setReaderLayerPresence(readerState, false);
  return true;
}

static void startNfcReaders() {
  for (size_t index = 0; index < NFC_READER_COUNT; index++) {
    nfcReaders[index].ready = startNfcReader(nfcReaders[index]);
  }
}

static void readNfcReader(NfcReaderState &readerState) {
  if (!readerState.ready) {
    if (millis() - readerState.lastRetryMs >= NFC_RETRY_WINDOW_MS) {
      readerState.lastRetryMs = millis();
      readerState.ready = startNfcReader(readerState);
    }

    return;
  }

  deselectAllNfcReaders();

  uint8_t uid[10] = {0};
  uint8_t uidLength = 0;
  const bool found = readerState.reader->readPassiveTargetID(
      PN532_MIFARE_ISO14443A,
      uid,
      &uidLength,
      NFC_READ_TIMEOUT_MS);

  const uint32_t now = millis();
  if (!found) {
    if (readerState.tagPresent && now - readerState.lastSeenMs >= NFC_REMOVED_WINDOW_MS) {
      readerState.tagPresent = false;
      readerState.lastUid = "";
      readerState.lastPresenceEmitMs = now;
      setReaderLayerPresence(readerState, false);
      printTagRemoved(readerState);
    }

    return;
  }

  const String uidText = uidToHex(uid, uidLength);
  const bool wasPresent = readerState.tagPresent;
  const String previousUid = readerState.lastUid;
  const uint32_t previousSeenMs = readerState.lastSeenMs;
  const bool uidChanged = uidText != previousUid;

  readerState.tagPresent = true;
  readerState.lastUid = uidText;
  readerState.lastSeenMs = now;
  setReaderLayerPresence(readerState, true);

  if (!wasPresent || uidChanged) {
    readerState.lastPresenceEmitMs = now;
    printTagPresent(readerState, uidText);
  }

  if (!uidChanged && now - previousSeenMs < NFC_REPEAT_WINDOW_MS) {
    return;
  }

  Serial.print("TAG:");
  Serial.print(readerState.tagId);
  Serial.print(":");
  Serial.println(uidText);

  Serial.print("READER:");
  Serial.print(readerState.layerId);
  Serial.print(":");
  Serial.println(uidText);

  if (uidLength != 7) {
    printTagUnsupported(readerState, uidText, uidLength);
    return;
  }

  String payload;
  if (readDpiPayloadFromNtag(*readerState.reader, payload)) {
    printReadCard(readerState, uidText, payload);
  }
}

static void readNfcReaders() {
  for (size_t index = 0; index < NFC_READER_COUNT; index++) {
    readNfcReader(nfcReaders[index]);
  }
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  while (!Serial && millis() < 2500) {
    delay(10);
  }

  Serial.println();
  Serial.println("DPI ESP32 layer controller");
  Serial.println("5x KY-040 encoders + 5x PN532 SPI readers");
  Serial.println("Serial protocol: LAYER:<layerId>:<optionId>, TAG/TAG_PRESENT/TAG_REMOVED, WRITE:<tagId>:<layerId>:<optionId>, VOLUME:<layerId>:<0-100>");

  layerPixels.begin();
  layerPixels.clear();
  renderNeoPixels();
  Serial.print("NeoPixel strip: DATA GPIO");
  Serial.print(NEOPIXEL_PIN);
  Serial.print(", LEDs ");
  Serial.println(NEOPIXEL_COUNT);

  for (size_t index = 0; index < NFC_READER_COUNT; index++) {
    pinMode(nfcReaders[index].csPin, OUTPUT);
    digitalWrite(nfcReaders[index].csPin, HIGH);
  }

  for (size_t index = 0; index < ENCODER_COUNT; index++) {
    EncoderState &encoder = encoders[index];

    pinMode(encoder.clkPin, supportsInternalPullup(encoder.clkPin) ? INPUT_PULLUP : INPUT);
    pinMode(encoder.dtPin, supportsInternalPullup(encoder.dtPin) ? INPUT_PULLUP : INPUT);
    pinMode(encoder.swPin, INPUT_PULLUP);
    encoder.lastState = readEncoderState(encoder);
    encoder.lastButtonPressed = digitalRead(encoder.swPin) == LOW;

    Serial.print("Encoder ");
    Serial.print(encoder.label);
    Serial.print(": CLK GPIO");
    Serial.print(encoder.clkPin);
    Serial.print(", DT GPIO");
    Serial.print(encoder.dtPin);
    Serial.print(", SW GPIO");
    Serial.println(encoder.swPin);
  }

  startNfcReaders();
  Serial.println("Ready.");
}

void loop() {
  readSerialCommands();
  readEncoders();
  readNfcReaders();
  delay(2);
}
