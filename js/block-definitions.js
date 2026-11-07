/**
 * Custom Blockly block definitions for PictoBlox / Arduino
 * Defines rich visual blocks with PictoBlox color palette and icons.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PictoBloxBlocks = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // PictoBlox & Arduino Color Scheme
  const COLORS = {
    ARDUINO: '#00979D',    // PictoBlox Teal / Arduino Brand
    PINS: '#4C97FF',       // Blue (Digital & Analog I/O)
    TIME: '#5CB1D6',       // Sky Blue (Delay, Millis)
    SOUND: '#D65CD6',      // Purple / Magenta (Tone, Buzzer)
    SERIAL: '#FF6680',     // Coral Red (Serial communication)
    CONTROL: '#FFAB19',    // Orange (Loops, If/Else)
    LOGIC: '#59C059',      // Green (Conditions, Booleans)
    MATH: '#4C97FF',       // Blue (Math operations)
    VARIABLES: '#FF8C1A',  // Darker Orange
    LISTS: '#FF661A',      // Reddish Orange
    PROCEDURES: '#FF6680'  // Coral Pink
  };

  function init(Blockly) {
    if (!Blockly || !Blockly.Blocks) {
      console.warn('Blockly is not loaded yet.');
      return;
    }

    // 1. Arduino Setup & Loop Block (Main entrypoint for PictoBlox / Arduino sketches)
    Blockly.Blocks['arduino_setup_loop'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('⚙️ When Arduino Starts (setup)');
        this.appendStatementInput('SETUP')
          .setCheck(null);
        this.appendDummyInput()
          .appendField('🔄 Forever repeat (loop)');
        this.appendStatementInput('LOOP')
          .setCheck(null);
        this.setColour(COLORS.ARDUINO);
        this.setTooltip('C++ Arduino setup() and loop() functions container.');
        this.setHelpUrl('https://docs.arduino.cc/');
      }
    };

    // When Arduino Boots (Event block alternative)
    Blockly.Blocks['arduino_when_run'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('🚀 When Arduino Boots');
        this.setNextStatement(true, null);
        this.setColour(COLORS.ARDUINO);
        this.setTooltip('Runs once at startup');
      }
    };

    // 2. Pin Mode Configuration
    Blockly.Blocks['arduino_pin_mode'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('set pin');
        this.appendDummyInput()
          .appendField('as')
          .appendField(new Blockly.FieldDropdown([
            ['OUTPUT', 'OUTPUT'],
            ['INPUT', 'INPUT'],
            ['INPUT_PULLUP', 'INPUT_PULLUP']
          ]), 'MODE');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.PINS);
        this.setTooltip('Configures the specified pin to behave either as an input or an output.');
      }
    };

    // 3. Digital Write
    Blockly.Blocks['arduino_digital_write'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('digital write pin');
        this.appendValueInput('STATE')
          .setCheck(['Number', 'Boolean', 'String'])
          .appendField('to');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.PINS);
        this.setTooltip('Writes HIGH or LOW value to a digital pin.');
      }
    };

    // Digital Pin State (HIGH / LOW constant)
    Blockly.Blocks['arduino_level'] = {
      init: function () {
        this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([
            ['HIGH', 'HIGH'],
            ['LOW', 'LOW']
          ]), 'LEVEL');
        this.setOutput(true, ['Number', 'Boolean', 'String']);
        this.setColour(COLORS.PINS);
        this.setTooltip('Digital HIGH (1) or LOW (0)');
      }
    };

    // 4. Digital Read
    Blockly.Blocks['arduino_digital_read'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('read digital pin');
        this.setOutput(true, ['Number', 'Boolean']);
        this.setColour(COLORS.PINS);
        this.setTooltip('Reads the value from a specified digital pin (HIGH or LOW).');
      }
    };

    // 5. Analog Write (PWM)
    Blockly.Blocks['arduino_analog_write'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('set PWM pin');
        this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendField('to value');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.PINS);
        this.setTooltip('Writes an analog (PWM) value (0-255) to a pin.');
      }
    };

    // 6. Analog Read
    Blockly.Blocks['arduino_analog_read'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('read analog pin');
        this.setOutput(true, 'Number');
        this.setColour(COLORS.PINS);
        this.setTooltip('Reads the value from the specified analog pin (0-1023).');
      }
    };

    // 7. Tone / Buzzer
    Blockly.Blocks['arduino_tone'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('🔊 play tone on pin');
        this.appendValueInput('FREQUENCY')
          .setCheck('Number')
          .appendField('freq (Hz)');
        this.appendValueInput('DURATION')
          .setCheck('Number')
          .appendField('for (ms)');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.SOUND);
        this.setTooltip('Plays a tone on a buzzer connected to a pin.');
      }
    };

    // Tone without duration
    Blockly.Blocks['arduino_tone_continuous'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('🔊 play continuous tone on pin');
        this.appendValueInput('FREQUENCY')
          .setCheck('Number')
          .appendField('freq (Hz)');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.SOUND);
        this.setTooltip('Plays a continuous tone on a buzzer until noTone is called.');
      }
    };

    // 8. No Tone
    Blockly.Blocks['arduino_notone'] = {
      init: function () {
        this.appendValueInput('PIN')
          .setCheck(['Number', 'String'])
          .appendField('🔇 stop tone on pin');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.SOUND);
        this.setTooltip('Stops the tone playing on a pin.');
      }
    };

    // 9. Delay Milliseconds
    Blockly.Blocks['arduino_delay'] = {
      init: function () {
        this.appendValueInput('DELAY_TIME_MS')
          .setCheck('Number')
          .appendField('⏱️ wait');
        this.appendDummyInput()
          .appendField('milliseconds');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.TIME);
        this.setTooltip('Pauses the program for the amount of time (in milliseconds).');
      }
    };

    // 10. Delay Microseconds
    Blockly.Blocks['arduino_delay_microseconds'] = {
      init: function () {
        this.appendValueInput('DELAY_TIME_US')
          .setCheck('Number')
          .appendField('⏱️ wait');
        this.appendDummyInput()
          .appendField('microseconds');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.TIME);
        this.setTooltip('Pauses the program for the amount of time (in microseconds).');
      }
    };

    // 11. Millis & Micros
    Blockly.Blocks['arduino_millis'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('⏱️ time since start (millis)');
        this.setOutput(true, 'Number');
        this.setColour(COLORS.TIME);
        this.setTooltip('Returns the number of milliseconds passed since the Arduino board began running.');
      }
    };

    Blockly.Blocks['arduino_micros'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('⏱️ time since start (micros)');
        this.setOutput(true, 'Number');
        this.setColour(COLORS.TIME);
        this.setTooltip('Returns the number of microseconds passed since the Arduino board began running.');
      }
    };

    // 12. Serial Communication
    Blockly.Blocks['arduino_serial_begin'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('📟 Serial begin at')
          .appendField(new Blockly.FieldDropdown([
            ['9600', '9600'],
            ['19200', '19200'],
            ['38400', '38400'],
            ['57600', '57600'],
            ['115200', '115200']
          ]), 'BAUD')
          .appendField('baud');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.SERIAL);
        this.setTooltip('Initializes serial communication at the specified baud rate.');
      }
    };

    Blockly.Blocks['arduino_serial_print'] = {
      init: function () {
        this.appendValueInput('CONTENT')
          .appendField('📟 Serial print');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.SERIAL);
        this.setTooltip('Prints data to the serial port as human-readable ASCII text.');
      }
    };

    Blockly.Blocks['arduino_serial_println'] = {
      init: function () {
        this.appendValueInput('CONTENT')
          .appendField('📟 Serial println');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.SERIAL);
        this.setTooltip('Prints data to the serial port followed by a carriage return and newline.');
      }
    };

    // 13. Map and Constrain
    Blockly.Blocks['arduino_map'] = {
      init: function () {
        this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendField('map');
        this.appendValueInput('FROM_LOW')
          .setCheck('Number')
          .appendField('from low');
        this.appendValueInput('FROM_HIGH')
          .setCheck('Number')
          .appendField('high');
        this.appendValueInput('TO_LOW')
          .setCheck('Number')
          .appendField('to low');
        this.appendValueInput('TO_HIGH')
          .setCheck('Number')
          .appendField('high');
        this.setOutput(true, 'Number');
        this.setColour(COLORS.MATH);
        this.setTooltip('Re-maps a number from one range to another.');
      }
    };

    Blockly.Blocks['arduino_constrain'] = {
      init: function () {
        this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendField('constrain');
        this.appendValueInput('LOW')
          .setCheck('Number')
          .appendField('between min');
        this.appendValueInput('HIGH')
          .setCheck('Number')
          .appendField('and max');
        this.setOutput(true, 'Number');
        this.setColour(COLORS.MATH);
        this.setTooltip('Constrains a number to be within a range.');
      }
    };

    // 14. Array / List item block with 1-based indexing explicitly marked
    Blockly.Blocks['pictoblox_array_get'] = {
      init: function () {
        this.appendValueInput('INDEX')
          .setCheck('Number')
          .appendField('item')
          .appendField('(1-based)');
        this.appendDummyInput()
          .appendField('of list')
          .appendField(new Blockly.FieldVariable('myList'), 'VAR');
        this.setOutput(true, null);
        this.setColour(COLORS.LISTS);
        this.setTooltip('Gets item at 1-based index (converted from C++ 0-based array index).');
      }
    };

    Blockly.Blocks['pictoblox_array_set'] = {
      init: function () {
        this.appendValueInput('INDEX')
          .setCheck('Number')
          .appendField('replace item')
          .appendField('(1-based)');
        this.appendDummyInput()
          .appendField('of list')
          .appendField(new Blockly.FieldVariable('myList'), 'VAR');
        this.appendValueInput('VALUE')
          .appendField('with');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLORS.LISTS);
        this.setTooltip('Replaces item at 1-based index in list.');
      }
    };

    // Generic statement comment or unknown call fallback block
    Blockly.Blocks['arduino_custom_code'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('⚡ C++:')
          .appendField(new Blockly.FieldTextInput('code();'), 'CODE');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#888888');
        this.setTooltip('Direct C++ code line');
      }
    };
  }

  // Generate Toolbox XML configuration
  function getToolboxXml() {
    return `
      <xml id="toolbox" style="display: none">
        <category name="Pins &amp; I/O" colour="${COLORS.PINS}">
          <block type="arduino_pin_mode">
            <value name="PIN">
              <shadow type="math_number"><field name="NUM">13</field></shadow>
            </value>
          </block>
          <block type="arduino_digital_write">
            <value name="PIN">
              <shadow type="math_number"><field name="NUM">13</field></shadow>
            </value>
            <value name="STATE">
              <shadow type="arduino_level"><field name="LEVEL">HIGH</field></shadow>
            </value>
          </block>
          <block type="arduino_digital_read">
            <value name="PIN">
              <shadow type="math_number"><field name="NUM">2</field></shadow>
            </value>
          </block>
          <block type="arduino_level"></block>
          <block type="arduino_analog_write">
            <value name="PIN">
              <shadow type="math_number"><field name="NUM">9</field></shadow>
            </value>
            <value name="VALUE">
              <shadow type="math_number"><field name="NUM">128</field></shadow>
            </value>
          </block>
          <block type="arduino_analog_read">
            <value name="PIN">
              <shadow type="text"><field name="TEXT">A0</field></shadow>
            </value>
          </block>
        </category>

        <category name="Timing" colour="${COLORS.TIME}">
          <block type="arduino_delay">
            <value name="DELAY_TIME_MS">
              <shadow type="math_number"><field name="NUM">1000</field></shadow>
            </value>
          </block>
          <block type="arduino_delay_microseconds">
            <value name="DELAY_TIME_US">
              <shadow type="math_number"><field name="NUM">50</field></shadow>
            </value>
          </block>
          <block type="arduino_millis"></block>
          <block type="arduino_micros"></block>
        </category>

        <category name="Sound" colour="${COLORS.SOUND}">
          <block type="arduino_tone">
            <value name="PIN">
              <shadow type="math_number"><field name="NUM">8</field></shadow>
            </value>
            <value name="FREQUENCY">
              <shadow type="math_number"><field name="NUM">440</field></shadow>
            </value>
            <value name="DURATION">
              <shadow type="math_number"><field name="NUM">500</field></shadow>
            </value>
          </block>
          <block type="arduino_notone">
            <value name="PIN">
              <shadow type="math_number"><field name="NUM">8</field></shadow>
            </value>
          </block>
        </category>

        <category name="Serial" colour="${COLORS.SERIAL}">
          <block type="arduino_serial_begin"></block>
          <block type="arduino_serial_print">
            <value name="CONTENT">
              <shadow type="text"><field name="TEXT">Hello PictoBlox!</field></shadow>
            </value>
          </block>
          <block type="arduino_serial_println">
            <value name="CONTENT">
              <shadow type="text"><field name="TEXT">Sensor Reading:</field></shadow>
            </value>
          </block>
        </category>

        <category name="Control" colour="${COLORS.CONTROL}">
          <block type="arduino_setup_loop"></block>
          <block type="controls_if"></block>
          <block type="controls_whileUntil"></block>
          <block type="controls_for">
            <value name="FROM">
              <shadow type="math_number"><field name="NUM">0</field></shadow>
            </value>
            <value name="TO">
              <shadow type="math_number"><field name="NUM">10</field></shadow>
            </value>
            <value name="BY">
              <shadow type="math_number"><field name="NUM">1</field></shadow>
            </value>
          </block>
          <block type="controls_flow_statements"></block>
        </category>

        <category name="Logic" colour="${COLORS.LOGIC}">
          <block type="logic_compare"></block>
          <block type="logic_operation"></block>
          <block type="logic_negate"></block>
          <block type="logic_boolean"></block>
        </category>

        <category name="Math" colour="${COLORS.MATH}">
          <block type="math_number"></block>
          <block type="math_arithmetic"></block>
          <block type="math_modulo"></block>
          <block type="arduino_map"></block>
          <block type="arduino_constrain"></block>
        </category>

        <category name="Text" colour="#5CB1D6">
          <block type="text"></block>
          <block type="text_join"></block>
        </category>

        <category name="Lists / Arrays" colour="${COLORS.LISTS}">
          <block type="lists_create_with"></block>
          <block type="lists_getIndex">
            <value name="VALUE">
              <block type="variables_get"><field name="VAR">myList</field></block>
            </value>
            <value name="AT">
              <shadow type="math_number"><field name="NUM">1</field></shadow>
            </value>
          </block>
          <block type="lists_setIndex">
            <value name="LIST">
              <block type="variables_get"><field name="VAR">myList</field></block>
            </value>
            <value name="AT">
              <shadow type="math_number"><field name="NUM">1</field></shadow>
            </value>
          </block>
          <block type="pictoblox_array_get"></block>
          <block type="pictoblox_array_set"></block>
        </category>

        <category name="Variables" colour="${COLORS.VARIABLES}" custom="VARIABLE"></category>
        <category name="Functions" colour="${COLORS.PROCEDURES}" custom="PROCEDURE"></category>
      </xml>
    `;
  }

  return {
    init,
    getToolboxXml,
    COLORS
  };
}));
