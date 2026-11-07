/**
 * Sample C++ / Arduino sketches for testing and demonstration
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CppSamples = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SAMPLES = {
    blink: {
      name: "1. LED Blink (Standard I/O)",
      description: "Basic digital output and timing delay commands.",
      code: `// Standard Arduino Blink Sketch
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(1000);
  digitalWrite(ledPin, LOW);
  delay(1000);
}`
    },

    button: {
      name: "2. Pushbutton with If/Else Control",
      description: "Digital input, conditional logic, and status toggling.",
      code: `// Pushbutton with If/Else Control Flow
const int buttonPin = 2;
const int ledPin = 13;
int buttonState = 0;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  buttonState = digitalRead(buttonPin);

  if (buttonState == LOW) {
    digitalWrite(ledPin, HIGH);
    Serial.println("Button Pressed!");
  } else {
    digitalWrite(ledPin, LOW);
    Serial.println("Button Released");
  }

  delay(50);
}`
    },

    analogMap: {
      name: "3. Analog Sensor & PWM Fader",
      description: "Analog reading, map function, PWM output, and Serial telemetry.",
      code: `// Potentiometer Analog Read to PWM LED Fader
const int potPin = A0;
const int ledPin = 9;
int sensorValue = 0;
int outputValue = 0;

void setup() {
  Serial.begin(9600);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  sensorValue = analogRead(potPin);
  outputValue = map(sensorValue, 0, 1023, 0, 255);
  analogWrite(ledPin, outputValue);

  Serial.print("Sensor: ");
  Serial.print(sensorValue);
  Serial.print(" -> PWM: ");
  Serial.println(outputValue);

  delay(20);
}`
    },

    melody: {
      name: "4. Buzzer Tone & Melody",
      description: "Piezo buzzer tone generation and frequency control.",
      code: `// Buzzer Tone Generator
const int buzzerPin = 8;

void setup() {
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  // Play 440 Hz (Note A4) for 200 ms
  tone(buzzerPin, 440, 200);
  delay(250);

  // Play 523 Hz (Note C5) for 200 ms
  tone(buzzerPin, 523, 200);
  delay(250);

  // Play 659 Hz (Note E5) for 400 ms
  tone(buzzerPin, 659, 400);
  delay(500);

  noTone(buzzerPin);
  delay(1000);
}`
    },

    arrayScanner: {
      name: "5. Array Scanner (0-to-1 List Indexing)",
      description: "Demonstrates 0-based C++ array to 1-based PictoBlox list conversion.",
      code: `// Array Scanner: Demonstrates 0-based to 1-based index conversion
int pins[4] = {4, 5, 6, 7};
int sensorValues[4] = {100, 250, 480, 920};

void setup() {
  Serial.begin(9600);

  // Direct 0-based index access (converts to item 1 in Blockly)
  int firstPin = pins[0];
  pinMode(firstPin, OUTPUT);

  // Loop through array (converts pins[i] to item (i + 1) in Blockly)
  for (int i = 0; i < 4; i++) {
    int currentPin = pins[i];
    pinMode(currentPin, OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < 4; i++) {
    int p = pins[i];
    digitalWrite(p, HIGH);
    delay(200);
    digitalWrite(p, LOW);
  }

  // Update array element at index 0 (item 1 in PictoBlox)
  sensorValues[0] = 120;
  delay(1000);
}`
    },

    customFunctions: {
      name: "6. Custom Functions & Procedures",
      description: "User-defined C++ functions with return values and parameters.",
      code: `// Custom Procedure and Return Function
const int ledPin = 13;

int calculateDelay(int multiplier) {
  int base = 100;
  return base * multiplier;
}

void flashLed(int times, int waitTime) {
  for (int i = 0; i < times; i++) {
    digitalWrite(ledPin, HIGH);
    delay(waitTime);
    digitalWrite(ledPin, LOW);
    delay(waitTime);
  }
}

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int d = calculateDelay(3);
  flashLed(2, d);
  delay(1000);
}`
    }
  };

  return {
    SAMPLES,
    getSample: (id) => SAMPLES[id] ? SAMPLES[id].code : ''
  };
}));
