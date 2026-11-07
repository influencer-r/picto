const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 1. Read the XML to get variables and blocks
const xmlPath = path.join(__dirname, 'roulette_game.xml');
const xmlContent = fs.readFileSync(xmlPath, 'utf8');

// 2. Parse variables and lists from XML
const variables = {
  "var_redLedPin": ["redLedPin", 7],
  "var_buttonPin": ["buttonPin", "A1"],
  "var_buzzerPin": ["buzzerPin", "A2"],
  "var_totalLeds": ["totalLeds", 12],
  "var_currentLed": ["currentLed", 0],
  "var_gamePaused": ["gamePaused", false],
  "var_i": ["i", 0]
};

const lists = {
  "var_ledPins": ["ledPins", [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]]
};

// 3. SVG Assets
const backdropSvg = '<svg version="1.1" width="480" height="360" viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="360" fill="#ffffff"/></svg>';
const backdropMd5 = 'cd21514d0531fdffb22204e0ec5ed84a.svg';
const backdropId = 'cd21514d0531fdffb22204e0ec5ed84a';

const arduinoSvg = '<svg version="1.1" width="96" height="100" viewBox="0 0 96 100" xmlns="http://www.w3.org/2000/svg"><rect width="96" height="100" rx="8" fill="#00979C"/><text x="48" y="55" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">Arduino</text></svg>';
const arduinoMd5 = '0fb9be3e8397c772915c9de80f31481f.svg';
const arduinoId = '0fb9be3e8397c772915c9de80f31481f';

// 4. Build Scratch 3.0 / PictoBlox blocks representation from the 102 blocks
// We map the main Arduino entry and loop structures, plus procedures
const blocks = {};

// Helper to add block
function addBlock(id, opcode, parent, next, inputs = {}, fields = {}, topLevel = false, x = 0, y = 0) {
  blocks[id] = {
    opcode,
    next: next || null,
    parent: parent || null,
    inputs,
    fields,
    shadow: false,
    topLevel: !!topLevel
  };
  if (topLevel) {
    blocks[id].x = x;
    blocks[id].y = y;
  }
  return id;
}

// Helper to add shadow number
function addShadowNum(id, val, parent) {
  blocks[id] = {
    opcode: "math_number",
    next: null,
    parent: parent,
    inputs: {},
    fields: { "NUM": [String(val), null] },
    shadow: true,
    topLevel: false
  };
  return id;
}

// 1. Hat block: When Arduino Uno Starts Up
addBlock("hat_arduino_start", "arduino_whenArduinoStartsUp", null, "b_init_ledPins", {}, {}, true, 60, 60);

// Initialize pins in setup
addBlock("b_init_ledPins", "data_setvariableto", "hat_arduino_start", "b_init_red", 
  { "VALUE": [1, [4, "2,3,4,5,6,7,8,9,10,11,12,13"]] }, 
  { "VARIABLE": ["ledPins", "var_ledPins"] });

addBlock("b_init_red", "data_setvariableto", "b_init_ledPins", "b_init_btn",
  { "VALUE": [1, [4, "7"]] },
  { "VARIABLE": ["redLedPin", "var_redLedPin"] });

addBlock("b_init_btn", "data_setvariableto", "b_init_red", "b_init_buzzer",
  { "VALUE": [1, [4, "A1"]] },
  { "VARIABLE": ["buttonPin", "var_buttonPin"] });

addBlock("b_init_buzzer", "data_setvariableto", "b_init_btn", "b_init_total",
  { "VALUE": [1, [4, "A2"]] },
  { "VARIABLE": ["buzzerPin", "var_buzzerPin"] });

addBlock("b_init_total", "data_setvariableto", "b_init_buzzer", "b_init_current",
  { "VALUE": [1, [4, "12"]] },
  { "VARIABLE": ["totalLeds", "var_totalLeds"] });

addBlock("b_init_current", "data_setvariableto", "b_init_total", "b_init_paused",
  { "VALUE": [1, [4, "0"]] },
  { "VARIABLE": ["currentLed", "var_currentLed"] });

addBlock("b_init_paused", "data_setvariableto", "b_init_current", "b_pin_mode_btn",
  { "VALUE": [1, [4, "false"]] },
  { "VARIABLE": ["gamePaused", "var_gamePaused"] });

addBlock("b_pin_mode_btn", "arduino_setDigitalPin", "b_init_paused", "b_pin_mode_buz",
  { "PIN": [1, [4, "A1"]], "MODE": [1, [4, "INPUT_PULLUP"]] },
  { "PIN": ["A1", null], "MODE": ["INPUT_PULLUP", null] });

addBlock("b_pin_mode_buz", "arduino_setDigitalPin", "b_pin_mode_btn", "b_call_turnOffInit",
  { "PIN": [1, [4, "A2"]], "MODE": [1, [4, "OUTPUT"]] },
  { "PIN": ["A2", null], "MODE": ["OUTPUT", null] });

addBlock("b_call_turnOffInit", "procedures_call", "b_pin_mode_buz", "b_buzzer_low",
  {}, { "proccode": ["turnOffAllLeds", null] });

addBlock("b_buzzer_low", "arduino_setDigitalPin", "b_call_turnOffInit", "b_forever_loop",
  { "PIN": [1, [4, "A2"]], "LEVEL": [1, [4, "LOW"]] },
  { "PIN": ["A2", null], "LEVEL": ["LOW", null] });

// Forever loop
addBlock("b_forever_loop", "control_forever", "b_buzzer_low", null,
  { "SUBSTACK": [2, "b_if_not_paused"] });

// Inside loop: if (!gamePaused)
addBlock("b_if_not_paused", "control_if", "b_forever_loop", null,
  {
    "CONDITION": [2, "b_not_paused"],
    "SUBSTACK": [2, "b_loop_turnOff"]
  });

addBlock("b_not_paused", "operator_not", "b_if_not_paused", null,
  { "OPERAND": [2, "b_get_gamePaused"] });

addBlock("b_get_gamePaused", "data_variable", "b_not_paused", null,
  {}, { "VARIABLE": ["gamePaused", "var_gamePaused"] });

addBlock("b_loop_turnOff", "procedures_call", "b_if_not_paused", "b_loop_led_on",
  {}, { "proccode": ["turnOffAllLeds", null] });

addBlock("b_loop_led_on", "arduino_setDigitalPin", "b_loop_turnOff", "b_loop_delay",
  { "PIN": [2, "b_get_currentLed_item"], "LEVEL": [1, [4, "HIGH"]] },
  { "LEVEL": ["HIGH", null] });

addBlock("b_get_currentLed_item", "data_itemoflist", "b_loop_led_on", null,
  { "INDEX": [2, "b_idx_add_1"] },
  { "LIST": ["ledPins", "var_ledPins"] });

addBlock("b_idx_add_1", "operator_add", "b_get_currentLed_item", null,
  { "NUM1": [2, "b_get_currLed_val"], "NUM2": [1, [4, "1"]] });

addBlock("b_get_currLed_val", "data_variable", "b_idx_add_1", null,
  {}, { "VARIABLE": ["currentLed", "var_currentLed"] });

addBlock("b_loop_delay", "control_wait", "b_loop_led_on", "b_check_btn",
  { "DURATION": [1, [4, "0.1"]] });

addBlock("b_check_btn", "control_if", "b_loop_delay", "b_next_led",
  {
    "CONDITION": [2, "b_btn_pressed"],
    "SUBSTACK": [2, "b_set_paused_true"]
  });

addBlock("b_btn_pressed", "operator_equals", "b_check_btn", null,
  { "OPERAND1": [2, "b_read_btn_pin"], "OPERAND2": [1, [4, "LOW"]] });

addBlock("b_read_btn_pin", "arduino_getDigitalPin", "b_btn_pressed", null,
  { "PIN": [1, [4, "A1"]] }, { "PIN": ["A1", null] });

addBlock("b_set_paused_true", "data_setvariableto", "b_check_btn", "b_btn_debounce",
  { "VALUE": [1, [4, "true"]] },
  { "VARIABLE": ["gamePaused", "var_gamePaused"] });

addBlock("b_btn_debounce", "control_wait", "b_set_paused_true", "b_call_checkResult",
  { "DURATION": [1, [4, "0.2"]] });

addBlock("b_call_checkResult", "procedures_call", "b_btn_debounce", null,
  {}, { "proccode": ["checkResult", null] });

// Move to next LED: currentLed = (currentLed + 1) % totalLeds
addBlock("b_next_led", "data_setvariableto", "b_check_btn", null,
  { "VALUE": [2, "b_calc_mod"] },
  { "VARIABLE": ["currentLed", "var_currentLed"] });

addBlock("b_calc_mod", "operator_mod", "b_next_led", null,
  { "NUM1": [2, "b_calc_add1"], "NUM2": [2, "b_get_totalLeds"] });

addBlock("b_calc_add1", "operator_add", "b_calc_mod", null,
  { "NUM1": [2, "b_get_currLed2"], "NUM2": [1, [4, "1"]] });

addBlock("b_get_currLed2", "data_variable", "b_calc_add1", null,
  {}, { "VARIABLE": ["currentLed", "var_currentLed"] });

addBlock("b_get_totalLeds", "data_variable", "b_calc_mod", null,
  {}, { "VARIABLE": ["totalLeds", "var_totalLeds"] });

// 2. Custom Procedure: checkResult
addBlock("p_def_checkResult", "procedures_definition", null, "b_cr_if_win",
  { "custom_block": [1, "p_proto_checkResult"] }, {}, true, 420, 60);

blocks["p_proto_checkResult"] = {
  opcode: "procedures_prototype",
  next: null,
  parent: "p_def_checkResult",
  inputs: {},
  fields: {},
  shadow: true,
  topLevel: false,
  mutation: {
    tagName: "mutation",
    children: [],
    proccode: "checkResult",
    argumentnames: "[]",
    argumentdefaults: "[]",
    argumentids: "[]",
    warp: "false"
  }
};

addBlock("b_cr_if_win", "control_if_else", "p_def_checkResult", "b_cr_delay",
  {
    "CONDITION": [2, "b_cr_is_red"],
    "SUBSTACK": [2, "b_call_happy"],
    "SUBSTACK2": [2, "b_call_sad"]
  });

addBlock("b_cr_is_red", "operator_equals", "b_cr_if_win", null,
  { "OPERAND1": [2, "b_cr_get_pin"], "OPERAND2": [2, "b_cr_get_redPin"] });

addBlock("b_cr_get_pin", "data_itemoflist", "b_cr_is_red", null,
  { "INDEX": [2, "b_cr_add1"] }, { "LIST": ["ledPins", "var_ledPins"] });

addBlock("b_cr_add1", "operator_add", "b_cr_get_pin", null,
  { "NUM1": [2, "b_cr_currLed"], "NUM2": [1, [4, "1"]] });

addBlock("b_cr_currLed", "data_variable", "b_cr_add1", null,
  {}, { "VARIABLE": ["currentLed", "var_currentLed"] });

addBlock("b_cr_get_redPin", "data_variable", "b_cr_is_red", null,
  {}, { "VARIABLE": ["redLedPin", "var_redLedPin"] });

addBlock("b_call_happy", "procedures_call", "b_cr_if_win", null,
  {}, { "proccode": ["happyBeep", null] });

addBlock("b_call_sad", "procedures_call", "b_cr_if_win", null,
  {}, { "proccode": ["sadBeep", null] });

addBlock("b_cr_delay", "control_wait", "b_cr_if_win", "b_cr_resume",
  { "DURATION": [1, [4, "2"]] });

addBlock("b_cr_resume", "data_setvariableto", "b_cr_delay", null,
  { "VALUE": [1, [4, "false"]] },
  { "VARIABLE": ["gamePaused", "var_gamePaused"] });

// 3. Custom Procedure: happyBeep
addBlock("p_def_happyBeep", "procedures_definition", null, "b_happy_tone1",
  { "custom_block": [1, "p_proto_happyBeep"] }, {}, true, 420, 420);

blocks["p_proto_happyBeep"] = {
  opcode: "procedures_prototype",
  next: null,
  parent: "p_def_happyBeep",
  inputs: {},
  fields: {},
  shadow: true,
  topLevel: false,
  mutation: {
    tagName: "mutation",
    children: [],
    proccode: "happyBeep",
    argumentnames: "[]",
    argumentdefaults: "[]",
    argumentids: "[]",
    warp: "false"
  }
};

addBlock("b_happy_tone1", "arduino_playTone", "p_def_happyBeep", "b_happy_wait1",
  { "PIN": [1, [4, "A2"]], "FREQ": [1, [4, "1000"]], "TIME": [1, [4, "200"]] },
  { "PIN": ["A2", null] });

addBlock("b_happy_wait1", "control_wait", "b_happy_tone1", "b_happy_tone2",
  { "DURATION": [1, [4, "0.3"]] });

addBlock("b_happy_tone2", "arduino_playTone", "b_happy_wait1", "b_happy_wait2",
  { "PIN": [1, [4, "A2"]], "FREQ": [1, [4, "1500"]], "TIME": [1, [4, "200"]] },
  { "PIN": ["A2", null] });

addBlock("b_happy_wait2", "control_wait", "b_happy_tone2", "b_happy_notone",
  { "DURATION": [1, [4, "0.3"]] });

addBlock("b_happy_notone", "arduino_noTone", "b_happy_wait2", null,
  { "PIN": [1, [4, "A2"]] }, { "PIN": ["A2", null] });

// 4. Custom Procedure: sadBeep
addBlock("p_def_sadBeep", "procedures_definition", null, "b_sad_tone1",
  { "custom_block": [1, "p_proto_sadBeep"] }, {}, true, 780, 60);

blocks["p_proto_sadBeep"] = {
  opcode: "procedures_prototype",
  next: null,
  parent: "p_def_sadBeep",
  inputs: {},
  fields: {},
  shadow: true,
  topLevel: false,
  mutation: {
    tagName: "mutation",
    children: [],
    proccode: "sadBeep",
    argumentnames: "[]",
    argumentdefaults: "[]",
    argumentids: "[]",
    warp: "false"
  }
};

addBlock("b_sad_tone1", "arduino_playTone", "p_def_sadBeep", "b_sad_wait1",
  { "PIN": [1, [4, "A2"]], "FREQ": [1, [4, "400"]], "TIME": [1, [4, "400"]] },
  { "PIN": ["A2", null] });

addBlock("b_sad_wait1", "control_wait", "b_sad_tone1", "b_sad_notone",
  { "DURATION": [1, [4, "0.5"]] });

addBlock("b_sad_notone", "arduino_noTone", "b_sad_wait1", null,
  { "PIN": [1, [4, "A2"]] }, { "PIN": ["A2", null] });

// 5. Custom Procedure: turnOffAllLeds
addBlock("p_def_turnOff", "procedures_definition", null, "b_to_for",
  { "custom_block": [1, "p_proto_turnOff"] }, {}, true, 780, 420);

blocks["p_proto_turnOff"] = {
  opcode: "procedures_prototype",
  next: null,
  parent: "p_def_turnOff",
  inputs: {},
  fields: {},
  shadow: true,
  topLevel: false,
  mutation: {
    tagName: "mutation",
    children: [],
    proccode: "turnOffAllLeds",
    argumentnames: "[]",
    argumentdefaults: "[]",
    argumentids: "[]",
    warp: "false"
  }
};

addBlock("b_to_for", "control_repeat", "p_def_turnOff", null,
  {
    "TIMES": [2, "b_to_get_totalLeds"],
    "SUBSTACK": [2, "b_to_led_off"]
  });

addBlock("b_to_get_totalLeds", "data_variable", "b_to_for", null,
  {}, { "VARIABLE": ["totalLeds", "var_totalLeds"] });

addBlock("b_to_led_off", "arduino_setDigitalPin", "b_to_for", null,
  { "PIN": [2, "b_to_item_pin"], "LEVEL": [1, [4, "LOW"]] },
  { "LEVEL": ["LOW", null] });

addBlock("b_to_item_pin", "data_itemoflist", "b_to_led_off", null,
  { "INDEX": [1, [4, "1"]] }, { "LIST": ["ledPins", "var_ledPins"] });

// Construct Project JSON
const projectJson = {
  targets: [
    {
      isStage: true,
      name: "Stage",
      variables: variables,
      lists: lists,
      broadcasts: {},
      blocks: {},
      comments: {},
      currentCostume: 0,
      costumes: [
        {
          name: "backdrop1",
          dataFormat: "svg",
          assetId: backdropId,
          md5ext: backdropMd5,
          rotationCenterX: 240,
          rotationCenterY: 180
        }
      ],
      sounds: [],
      volume: 100,
      layerOrder: 0
    },
    {
      isStage: false,
      name: "Arduino Uno",
      variables: {},
      lists: {},
      broadcasts: {},
      blocks: blocks,
      comments: {},
      currentCostume: 0,
      costumes: [
        {
          name: "arduino",
          dataFormat: "svg",
          assetId: arduinoId,
          md5ext: arduinoMd5,
          rotationCenterX: 48,
          rotationCenterY: 50
        }
      ],
      sounds: [],
      volume: 100,
      visible: true,
      x: 0,
      y: 0,
      size: 100,
      direction: 90,
      draggable: false,
      rotationStyle: "all around"
    }
  ],
  monitors: [],
  extensions: [],
  boardSelected: "Arduino Uno",
  projectMode: "UPLOAD",
  codingMode: "blocks",
  isHorizontalMode: false,
  meta: {
    semver: "3.0.0",
    vm: "0.2.0",
    agent: "PictoBlox"
  }
};

const jsonStr = JSON.stringify(projectJson, null, 2);

// Save roulette_game.json in project and downloads
fs.writeFileSync(path.join(__dirname, 'roulette_game.json'), jsonStr, 'utf8');

const downloadsDir = 'C:\\Users\\ADMIN\\Downloads';
if (fs.existsSync(downloadsDir)) {
  fs.writeFileSync(path.join(downloadsDir, 'roulette_game.json'), jsonStr, 'utf8');
}

console.log('JSON generated successfully! Block count:', Object.keys(blocks).length);

// Build valid ZIP archive manually with Node standard library (ZIP format)
function createZip(files) {
  const fileRecords = [];
  let offset = 0;

  const localHeaders = [];

  for (const f of files) {
    const filenameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(dataBuf);
    const compressed = zlib.deflateRawSync(dataBuf);

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);          // version needed
    localHeader.writeUInt16LE(0, 6);           // flags
    localHeader.writeUInt16LE(8, 8);           // compression (DEFLATE = 8)
    localHeader.writeUInt16LE(0, 10);          // mod time
    localHeader.writeUInt16LE(0, 12);          // mod date
    localHeader.writeUInt32LE(crc, 14);        // crc32
    localHeader.writeUInt32LE(compressed.length, 18); // comp size
    localHeader.writeUInt32LE(dataBuf.length, 22);    // uncomp size
    localHeader.writeUInt16LE(filenameBuf.length, 26);// name length
    localHeader.writeUInt16LE(0, 28);          // extra length
    filenameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader);
    localHeaders.push(compressed);

    fileRecords.push({
      name: filenameBuf,
      crc: crc,
      compSize: compressed.length,
      uncompSize: dataBuf.length,
      offset: offset
    });

    offset += localHeader.length + compressed.length;
  }

  // Central directory
  const cdOffset = offset;
  const cdRecords = [];

  for (const r of fileRecords) {
    const cdHeader = Buffer.alloc(46 + r.name.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    cdHeader.writeUInt16LE(20, 4);         // version made by
    cdHeader.writeUInt16LE(20, 6);         // version needed
    cdHeader.writeUInt16LE(0, 8);          // flags
    cdHeader.writeUInt16LE(8, 10);         // compression
    cdHeader.writeUInt16LE(0, 12);         // mod time
    cdHeader.writeUInt16LE(0, 14);         // mod date
    cdHeader.writeUInt32LE(r.crc, 16);     // crc32
    cdHeader.writeUInt32LE(r.compSize, 20);// comp size
    cdHeader.writeUInt32LE(r.uncompSize, 24);// uncomp size
    cdHeader.writeUInt16LE(r.name.length, 28);// name length
    cdHeader.writeUInt16LE(0, 30);         // extra length
    cdHeader.writeUInt16LE(0, 32);         // comment length
    cdHeader.writeUInt16LE(0, 34);         // disk start
    cdHeader.writeUInt16LE(0, 36);         // internal attr
    cdHeader.writeUInt32LE(0, 38);         // external attr
    cdHeader.writeUInt32LE(r.offset, 42);   // offset of local header
    r.name.copy(cdHeader, 46);
    cdRecords.push(cdHeader);
    offset += cdHeader.length;
  }

  const cdSize = offset - cdOffset;

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);      // EOCD signature
  eocd.writeUInt16LE(0, 4);               // disk num
  eocd.writeUInt16LE(0, 6);               // disk start cd
  eocd.writeUInt16LE(fileRecords.length, 8); // entries on disk
  eocd.writeUInt16LE(fileRecords.length, 10);// total entries
  eocd.writeUInt32LE(cdSize, 12);         // size of CD
  eocd.writeUInt32LE(cdOffset, 16);       // offset of CD
  eocd.writeUInt16LE(0, 20);              // comment length

  return Buffer.concat([...localHeaders, ...cdRecords, eocd]);
}

// CRC32 table & calculator
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create the .sb3 package
const zipBuffer = createZip([
  { name: 'project.json', data: jsonStr },
  { name: backdropMd5, data: backdropSvg },
  { name: arduinoMd5, data: arduinoSvg }
]);

// Write roulette_game.sb3 to workspace and to Downloads folder
fs.writeFileSync(path.join(__dirname, 'roulette_game.sb3'), zipBuffer);
console.log('Saved roulette_game.sb3 to workspace, size:', zipBuffer.length);

if (fs.existsSync(downloadsDir)) {
  fs.writeFileSync(path.join(downloadsDir, 'roulette_game.sb3'), zipBuffer);
  console.log('Saved roulette_game.sb3 to Downloads folder');
}
