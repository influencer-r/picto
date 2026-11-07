# C++ to PictoBlox / Blockly Code Converter

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/influencer-r/picto)
[![Tests Passing](https://img.shields.io/badge/tests-12%2F12%20passing-brightgreen.svg)](test/run-tests.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Repository](https://img.shields.io/badge/GitHub-influencer--r%2Fpicto-181717.svg?logo=github)](https://github.com/influencer-r/picto)

A production-ready, fully functional web application that parses standard Arduino C++ source code into an Abstract Syntax Tree (AST) and renders authentic visual block equivalents in **PictoBlox** and **Google Blockly**. Features split-screen live preview, automatic 0-to-1 array/list index translation, step-by-step progress modal, diagnostic error reporting, and multi-format project export.

---

## 🚀 Key Features

### 1. Robust C++ AST Parser & Translation Engine
- **Dedicated Lexical Scanner & Recursive Descent Parser**: Parses preprocessor directives (`#define`, `#include`), global variables, arrays, function definitions, control flow, and nested blocks without external heavy dependencies.
- **Full Arduino Construct Coverage**:
  - **Structure**: `setup()` and `loop()` mapped to native PictoBlox `arduino_setup_loop` container.
  - **I/O & Pins**: `pinMode()`, `digitalWrite()`, `digitalRead()`, `analogWrite()` (PWM), `analogRead()`.
  - **Timing**: `delay()`, `delayMicroseconds()`, `millis()`, `micros()`.
  - **Sound & Buzzer**: `tone(pin, freq, duration)` and `noTone(pin)`.
  - **Serial Telemetry**: `Serial.begin(baud)`, `Serial.print()`, `Serial.println()`.
  - **Math Utilities**: `map()`, `constrain()`, standard arithmetic and logic operators.
  - **Control Flow**: `if / else if / else`, `for` loops, `while` loops, `break`, `continue`.
  - **Procedures**: Custom user-defined functions with parameters and return values.
- **Zero Placeholder Code / Stubs**: Every single construct renders its visual block counterpart dynamically without crashing or hanging.

### 2. Automatic 0-Based to 1-Based List Indexing
PictoBlox and Scratch 3.0 lists enforce **1-based indexing**, while standard C++ arrays operate on **0-based indexing**. The translation engine seamlessly bridges this gap:
- **Literal Access**: Constant integer indices like `pins[0]` automatically map to Blockly `item 1 of pins` (i.e. `index + 1`).
- **Dynamic Access**: Variable or expression indices like `pins[i]` automatically map to `item (i + 1) of pins` via a visual `math_arithmetic` addition block.
- **Array Mutation**: `pins[0] = 42;` maps to `replace item 1 of pins with 42`.
- **Full Transparency**: An **Index Audit** tab in the bottom console details all index conversions performed.

### 3. Interactive Split-Screen UI & Live Preview
- **Left Panel**: CodeMirror 5 editor with Dracula theme, C++ syntax highlighting, line numbers, bracket matching, auto-formatting, and keyboard shortcuts (`Ctrl+Enter` to convert).
- **Right Panel**: Active Google Blockly workspace customized with PictoBlox vibrant color palettes, categories, grid snapping, and zoom/pan controls.
- **Draggable Splitter**: Customize panel proportions smoothly by dragging the vertical divider.
- **Conversion Progress Modal**: Step-by-step animated modal tracking real percentage completion:
  1. Lexical Tokenization (25%)
  2. AST Construction (50%)
  3. PictoBlox Schema & Index Mapping (75%)
  4. Visual Canvas Rendering (100%)
- **Diagnostic Console**: Multi-tab bottom panel for syntax warnings, interactive AST tree view, raw Blockly XML output, and index conversion audits.

### 4. Multi-Format Export & Toast Feedback
- **PictoBlox Project (`.sb3`)**: Official Scratch 3.0 / PictoBlox package containing `project.json` (stage, Arduino Uno target, visual blocks, variables, and list descriptors), recognized directly by the PictoBlox desktop and web file picker.
- **Blockly Workspace (`.xml`)**: Standard serialized XML ready for loading into any Blockly or PictoBlox environment.
- **Arduino Source (`.ino`)**: Native Arduino C++ sketch file.
- **Vector Graphic (`.svg`)**: Scalable vector snapshot of your visual blocks diagram.
- **Toast Notifications**: Non-blocking feedback banners confirming completed operations without resetting workspace state.

---

## 📂 Project Architecture

```
picto/
├── index.html               # Main application shell with split-view layout
├── styles.css               # Production design system, responsive styles, animations
├── netlify.toml             # Netlify CI build commands, caching, security headers
├── package.json             # NPM package scripts and metadata
├── README.md                # Comprehensive documentation
├── js/
│   ├── tokenizer.js         # C++ lexical scanner with line/col tracking
│   ├── parser.js            # Recursive descent C++ AST parser
│   ├── block-definitions.js # Custom PictoBlox/Arduino blocks & toolbox schema
│   ├── ast-to-blockly.js    # AST to Blockly XML mapping engine + 0-to-1 indexing
│   ├── pictoblox-exporter.js# Multi-format export (.sb3 package, JSON, XML, INO, SVG)
│   ├── samples.js           # Built-in Arduino C++ sample sketches
│   └── app.js               # Application state, UI bindings, and events
└── test/
    └── run-tests.js         # Automated test suite (11 unit tests)
```
└── test/
    └── run-tests.js         # Automated test suite (11 unit tests)
```

---

## 🛠️ Local Development & Testing

### Prerequisites
- Modern web browser (Chrome, Edge, Firefox, Safari)
- Node.js (v18+) for running tests

### Run Automated Unit Tests
Verify the tokenizer, parser, and AST conversion engine:
```bash
node test/run-tests.js
```
Expected output:
```
=== Running C++ to PictoBlox Unit Tests ===
[PASS] Tokenizer basic tokens
[PASS] Parser: Blink sketch AST structure
[PASS] Parser: Array declarations and for loops
[PASS] AST to Blockly: Blink converts to arduino_setup_loop block
[PASS] 0-based to 1-based list indexing conversion
[PASS] Sample "1. LED Blink (Standard I/O)" converts cleanly
[PASS] Sample "2. Pushbutton with If/Else Control" converts cleanly
[PASS] Sample "3. Analog Sensor & PWM Fader" converts cleanly
[PASS] Sample "4. Buzzer Tone & Melody" converts cleanly
[PASS] Sample "5. Array Scanner (0-to-1 List Indexing)" converts cleanly
[PASS] Sample "6. Custom Functions & Procedures" converts cleanly

=== Tests Complete: 11/11 Passed ===
```

### Launch Local Development Server
Because this application is 100% static client-side JavaScript, you can either double-click `index.html` to open it in your browser or run:
```bash
npx serve .
```
Then open `http://localhost:3000`.

---

## 🌐 GitHub & Netlify Continuous Deployment Setup

Follow these exact steps to connect this repository to GitHub and Netlify for automated continuous deployment.

### Step 1: Initialize Git Repository
From the project root (`c:\Users\ADMIN\Desktop\picto`):
```bash
git init
git add .
git commit -m "feat: initial release of C++ to PictoBlox web converter"
```

### Step 2: Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g. `cpp-to-pictoblox-converter`).
2. Link your local repository and push:
```bash
git branch -M main
git remote add origin https://github.com/influencer-r/picto.git
git push -u origin main
```

### Step 3: Link to Netlify for Continuous Deployment
1. Log in to [Netlify](https://app.netlify.com/).
2. Click **"Add new site"** &rarr; **"Import an existing project"**.
3. Select **GitHub** and authorize access to your repository.
4. Select `cpp-to-pictoblox-converter`.
5. Netlify will automatically detect the settings in `netlify.toml`:
   - **Base directory**: `.` (leave empty or default)
   - **Build command**: `node test/run-tests.js`
   - **Publish directory**: `.`
6. Click **"Deploy site"**.

Netlify will run the unit tests on every commit, verify all conversions, and deploy the live static site instantly with a free SSL certificate and CDN acceleration.

---

## 🧩 Supported C++ Syntax Reference

| C++ Arduino Syntax | Generated Visual Block | Category |
| :--- | :--- | :--- |
| `void setup() { ... }` | `When Arduino Starts (setup)` statement slot | Arduino Control |
| `void loop() { ... }` | `Forever repeat (loop)` statement slot | Arduino Control |
| `pinMode(pin, OUTPUT);` | `set pin [pin] as [OUTPUT]` | Pins & I/O |
| `digitalWrite(pin, HIGH);`| `digital write pin [pin] to [HIGH]` | Pins & I/O |
| `digitalRead(pin)` | `read digital pin [pin]` | Pins & I/O |
| `analogWrite(pin, val);` | `set PWM pin [pin] to value [val]` | Pins & I/O |
| `analogRead(pin)` | `read analog pin [pin]` | Pins & I/O |
| `tone(pin, freq, ms);` | `🔊 play tone on pin [pin] freq [freq] for [ms]` | Sound |
| `noTone(pin);` | `🔇 stop tone on pin [pin]` | Sound |
| `delay(1000);` | `⏱️ wait [1000] milliseconds` | Timing |
| `delayMicroseconds(50);` | `⏱️ wait [50] microseconds` | Timing |
| `millis()` / `micros()` | `⏱️ time since start (millis/micros)` | Timing |
| `Serial.begin(9600);` | `📟 Serial begin at [9600] baud` | Serial |
| `Serial.println(msg);` | `📟 Serial println [msg]` | Serial |
| `map(v, 0, 1023, 0, 255);`| `map [v] from low [0] high [1023] to low [0] high [255]` | Math |
| `arr[0]` (0-based) | `item 1 of list [arr]` (1-based) | Lists / Arrays |
| `arr[i]` (0-based) | `item (i + 1) of list [arr]` (1-based) | Lists / Arrays |
| `arr[0] = 99;` | `replace item 1 of list [arr] with [99]` | Lists / Arrays |
| `for (int i=0; i<10; i++)`| `count with [i] from [0] to [9] by [1]` | Control |
| `if (cond) { } else { }` | `if [cond] then { } else { }` | Control |
| `void myFunc(int a)` | `to myFunc (a) { ... }` | Procedures |

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
