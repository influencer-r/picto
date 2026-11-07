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
    },

    roulette: {
      name: "7. 12-LED Roulette Game (User Sketch)",
      description: "12-LED spinning roulette wheel with button stop and happy/sad tone feedback.",
      code: `// Define pin numbers
const int ledPins[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13};
const int redLedPin = 7;
const int buttonPin = A1;
const int buzzerPin = A2;

int totalLeds = 12;
int currentLed = 0;
bool gamePaused = false;

void setup() {
  // Set all LED pins as OUTPUT
  for (int i = 0; i < totalLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
  }

  pinMode(buttonPin, INPUT_PULLUP); // use internal pull-up resistor
  pinMode(buzzerPin, OUTPUT);

  // Turn off all LEDs and buzzer
  turnOffAllLeds();
  digitalWrite(buzzerPin, LOW);
}

void loop() {
  if (!gamePaused) {
    // Turn off all LEDs
    turnOffAllLeds();
    // Turn on current LED
    digitalWrite(ledPins[currentLed], HIGH);
    delay(100); // Adjust scrolling speed here

    // Check for button press
    if (digitalRead(buttonPin) == LOW) {
      gamePaused = true;
      delay(200); // simple debounce
      checkResult();
    }

    // Move to next LED
    currentLed = (currentLed + 1) % totalLeds;
  }
}

void checkResult() {
  if (ledPins[currentLed] == redLedPin) {
    // Correct stop
    happyBeep();
  } else {
    // Wrong stop
    sadBeep();
  }

  delay(2000); // Wait before restarting game
  gamePaused = false;
}

void happyBeep() {
  tone(buzzerPin, 1000, 200); // High tone
  delay(300);
  tone(buzzerPin, 1500, 200); // Higher tone
  delay(300);
  noTone(buzzerPin);
}

void sadBeep() {
  tone(buzzerPin, 400, 400); // Low tone
  delay(500);
  noTone(buzzerPin);
}

void turnOffAllLeds() {
  for (int i = 0; i < totalLeds; i++) {
    digitalWrite(ledPins[i], LOW);
  }
}`
    }
  };

  return {
    SAMPLES,
    getSample: (id) => SAMPLES[id] ? SAMPLES[id].code : ''
  };
}));
