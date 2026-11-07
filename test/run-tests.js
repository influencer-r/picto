/**
 * Automated test suite for C++ to PictoBlox / Blockly converter
 */

const assert = require('assert');
const tokenizer = require('../js/tokenizer');
const parser = require('../js/parser');
const astToBlockly = require('../js/ast-to-blockly');
const samples = require('../js/samples');

console.log('=== Running C++ to PictoBlox Unit Tests ===\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// 1. Tokenizer test
test('Tokenizer basic tokens', () => {
  const code = 'const int led = 13; void setup() { pinMode(led, OUTPUT); }';
  const { tokens, diagnostics } = tokenizer.tokenize(code);
  assert.strictEqual(diagnostics.length, 0);
  assert(tokens.some(t => t.type === 'KEYWORD' && t.value === 'const'));
  assert(tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'led'));
  assert(tokens.some(t => t.type === 'NUMBER' && t.value === '13'));
});

// 2. Parser test - Blink
test('Parser: Blink sketch AST structure', () => {
  const code = samples.SAMPLES.blink.code;
  const { tokens } = tokenizer.tokenize(code);
  const ast = parser.parse(tokens);

  assert.strictEqual(ast.type, 'Program');
  assert.strictEqual(ast.globals.length, 1);
  assert.strictEqual(ast.globals[0].name, 'ledPin');
  assert.strictEqual(ast.functions.length, 2);
  assert.strictEqual(ast.functions[0].name, 'setup');
  assert.strictEqual(ast.functions[1].name, 'loop');
});

// 3. Parser test - Array and for loop
test('Parser: Array declarations and for loops', () => {
  const code = 'int arr[3] = {10, 20, 30}; for (int i = 0; i < 3; i++) { int x = arr[i]; }';
  const { tokens } = tokenizer.tokenize(code);
  const ast = parser.parse(tokens);

  assert.strictEqual(ast.globals.length, 1);
  assert.strictEqual(ast.globals[0].isArray, true);
  assert.strictEqual(ast.globals[0].initializer.elements.length, 3);
});

// 4. AST to Blockly conversion - Blink
test('AST to Blockly: Blink converts to arduino_setup_loop block', () => {
  const code = samples.SAMPLES.blink.code;
  const { tokens } = tokenizer.tokenize(code);
  const ast = parser.parse(tokens);
  const result = astToBlockly.convertToBlocklyXml(ast);

  assert(result.xml.includes('<block type="arduino_setup_loop"'));
  assert(result.xml.includes('<block type="arduino_pin_mode"'));
  assert(result.xml.includes('<block type="arduino_digital_write"'));
  assert(result.xml.includes('<block type="arduino_delay"'));
  assert(result.stats.blocksGenerated >= 5);
});

// 5. AST to Blockly conversion - 0-based to 1-based indexing requirement
test('0-based to 1-based list indexing conversion', () => {
  const code = `
    int pins[3] = {1, 2, 3};
    void setup() {
      int first = pins[0];
      int second = pins[i];
      pins[0] = 99;
    }
  `;
  const { tokens } = tokenizer.tokenize(code);
  const ast = parser.parse(tokens);
  const result = astToBlockly.convertToBlocklyXml(ast);

  // Literal index: pins[0] should convert to 1
  assert(result.xml.includes('<field name="NUM">1</field>'), '0-based literal index 0 converted to 1');

  // Expression index: pins[i] should convert to math_arithmetic ADD 1
  assert(result.xml.includes('<field name="OP">ADD</field>'), 'Variable index wrapped in ADD');

  // Array assignment: pins[0] = 99 converts to lists_setIndex
  assert(result.xml.includes('<block type="lists_setIndex"'), 'Array assignment uses lists_setIndex');
  assert.strictEqual(result.stats.indexedConversions >= 3, true);
});

// 6. Test all predefined samples
for (const [key, sample] of Object.entries(samples.SAMPLES)) {
  test(`Sample "${sample.name}" converts cleanly`, () => {
    const { tokens } = tokenizer.tokenize(sample.code);
    const ast = parser.parse(tokens);
    const result = astToBlockly.convertToBlocklyXml(ast);
    assert(result.xml.length > 100);
    assert(result.stats.blocksGenerated > 0);
  });
}

// 7. PictoBlox .sb3 Schema Generation Test
const exporterModule = require('../js/pictoblox-exporter');
test('PictoBlox .sb3 project.json schema builder', () => {
  const mockWorkspace = {
    getAllBlocks: () => [
      {
        id: 'blk_1',
        type: 'arduino_setup_loop',
        getParent: () => null,
        getNextBlock: () => null,
        inputList: []
      }
    ],
    getAllVariables: () => [
      { getId: () => 'v1', name: 'ledPin', type: '' },
      { getId: () => 'v2', name: 'myList', type: 'list' }
    ]
  };

  const exporter = new exporterModule.Exporter(mockWorkspace);
  const schema = exporter.getProjectJson();

  assert.strictEqual(schema.meta.semver, '3.0.0');
  assert.strictEqual(schema.targets.length, 2);
  assert.strictEqual(schema.targets[0].isStage, true);
  assert.strictEqual(schema.targets[1].name, 'Arduino Uno');
  assert.strictEqual(schema.targets[1].blocks['blk_1'].opcode, 'arduino_setup_loop');
  assert(schema.targets[0].variables['v1']);
  assert(schema.targets[0].lists['v2']);
});

console.log(`\n=== Tests Complete: ${passedTests}/${totalTests} Passed ===\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
