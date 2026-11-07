/**
 * C++ AST to Blockly / PictoBlox Schema Converter
 * Transforms C++ AST nodes into valid Blockly XML / JSON workspace representations
 * with automatic 0-based to 1-based list indexing conversions.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AstToBlockly = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let nextIdCounter = 1;
  function generateId(prefix = 'block_') {
    return `${prefix}${Date.now().toString(36)}_${nextIdCounter++}`;
  }

  function escapeXml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  class Converter {
    constructor(ast, options = {}) {
      this.ast = ast || { type: 'Program', globals: [], functions: [] };
      this.options = Object.assign({
        autoAdjustIndex: true, // 0-based to 1-based indexing for lists/arrays
        startX: 40,
        startY: 40,
        ySpacing: 60
      }, options);

      this.variables = new Map(); // name -> { type, isArray, id }
      this.functions = new Map(); // name -> FunctionDeclaration
      this.diagnostics = [...(ast.diagnostics || [])];
      this.warnings = [];
      this.stats = {
        blocksGenerated: 0,
        variablesRegistered: 0,
        indexedConversions: 0
      };
    }

    convert() {
      // 1. Collect all declared variables & functions
      this.collectSymbols();

      // 2. Identify setup(), loop(), and other custom functions
      let setupFunc = null;
      let loopFunc = null;
      const customFuncs = [];

      for (const fn of this.ast.functions) {
        if (fn.name === 'setup') {
          setupFunc = fn;
        } else if (fn.name === 'loop') {
          loopFunc = fn;
        } else {
          customFuncs.push(fn);
        }
      }

      // 3. Build XML document
      let xml = '<xml xmlns="https://developers.google.com/blockly/xml">\n';

      // Declare all variables at the top of the Blockly XML
      xml += '  <variables>\n';
      for (const [name, meta] of this.variables.entries()) {
        const varType = meta.isArray ? 'list' : '';
        xml += `    <variable id="${escapeXml(meta.id)}" type="${escapeXml(varType)}">${escapeXml(name)}</variable>\n`;
        this.stats.variablesRegistered++;
      }
      xml += '  </variables>\n';

      let currentY = this.options.startY;

      // 4. Generate Main Arduino Setup & Loop Block
      // If there are global variable initializations, inject them at the beginning of setup
      const globalInitStmts = [];
      for (const g of this.ast.globals) {
        if (g.initializer) {
          globalInitStmts.push({
            type: 'ExpressionStatement',
            expression: {
              type: 'AssignmentExpression',
              operator: '=',
              left: { type: 'Identifier', name: g.name },
              right: g.initializer
            }
          });
        }
      }

      let setupStmts = [];
      if (globalInitStmts.length > 0) {
        setupStmts.push(...globalInitStmts);
      }
      if (this.ast.topLevelStatements && this.ast.topLevelStatements.length > 0) {
        setupStmts.push(...this.ast.topLevelStatements);
      }
      if (setupFunc && setupFunc.body && setupFunc.body.statements) {
        setupStmts.push(...setupFunc.body.statements);
      }

      const loopStmts = (loopFunc && loopFunc.body && loopFunc.body.statements) ? loopFunc.body.statements : [];

      // Create arduino_setup_loop block if setup or loop exists or if we have code
      if (setupFunc || loopFunc || setupStmts.length > 0 || loopStmts.length > 0) {
        const blockId = generateId('setup_loop_');
        xml += `  <block type="arduino_setup_loop" id="${blockId}" x="${this.options.startX}" y="${currentY}">\n`;
        this.stats.blocksGenerated++;

        if (setupStmts.length > 0) {
          xml += '    <statement name="SETUP">\n';
          xml += this.convertStatementChain(setupStmts, '      ');
          xml += '    </statement>\n';
        }

        if (loopStmts.length > 0) {
          xml += '    <statement name="LOOP">\n';
          xml += this.convertStatementChain(loopStmts, '      ');
          xml += '    </statement>\n';
        }

        xml += '  </block>\n';
        currentY += 400;
      }

      // 5. Generate custom function procedure blocks
      for (const fn of customFuncs) {
        const hasReturn = fn.returnType !== 'void';
        const procType = hasReturn ? 'procedures_defreturn' : 'procedures_defnoreturn';
        const procId = generateId('proc_');
        this.stats.blocksGenerated++;

        xml += `  <block type="${procType}" id="${procId}" x="${this.options.startX}" y="${currentY}">\n`;
        xml += `    <field name="NAME">${escapeXml(fn.name)}</field>\n`;

        // Parameters mutation
        if (fn.params && fn.params.length > 0) {
          xml += '    <mutation>\n';
          for (const param of fn.params) {
            xml += `      <arg name="${escapeXml(param.name)}" varid="${this.getOrCreateVarId(param.name)}"></arg>\n`;
          }
          xml += '    </mutation>\n';
        }

        // Procedure body
        if (fn.body && fn.body.statements && fn.body.statements.length > 0) {
          // Check for return statement
          let returnExpr = null;
          const bodyStmts = [];
          for (const s of fn.body.statements) {
            if (s.type === 'ReturnStatement') {
              returnExpr = s.argument;
            } else {
              bodyStmts.push(s);
            }
          }

          if (bodyStmts.length > 0) {
            xml += '    <statement name="STACK">\n';
            xml += this.convertStatementChain(bodyStmts, '      ');
            xml += '    </statement>\n';
          }

          if (hasReturn && returnExpr) {
            xml += '    <value name="RETURN">\n';
            xml += this.convertExpression(returnExpr, '      ');
            xml += '    </value>\n';
          }
        }

        xml += '  </block>\n';
        currentY += 300;
      }

      xml += '</xml>';

      return {
        xml,
        variables: Array.from(this.variables.entries()).map(([name, data]) => ({ name, ...data })),
        diagnostics: this.diagnostics,
        warnings: this.warnings,
        stats: this.stats
      };
    }

    collectSymbols() {
      // Collect preprocessor #define as constants/variables
      for (const prep of (this.ast.preprocessors || [])) {
        if (prep.type === 'DefineDirective' && isNaN(Number(prep.value))) {
          // Could be macro or constant
        } else if (prep.type === 'DefineDirective') {
          this.getOrCreateVarId(prep.name, false);
        }
      }

      // Collect global variables
      for (const g of (this.ast.globals || [])) {
        this.getOrCreateVarId(g.name, g.isArray);
      }

      // Collect all local variables from functions
      for (const fn of (this.ast.functions || [])) {
        this.functions.set(fn.name, fn);
        if (fn.params) {
          for (const p of fn.params) {
            this.getOrCreateVarId(p.name, false);
          }
        }
        if (fn.body && fn.body.statements) {
          this.collectVarsFromStatements(fn.body.statements);
        }
      }
    }

    collectVarsFromStatements(statements) {
      if (!statements) return;
      for (const s of statements) {
        if (s.type === 'VariableDeclarator') {
          this.getOrCreateVarId(s.name, s.isArray);
        } else if (s.type === 'ForStatement' && s.init && s.init.type === 'VariableDeclarator') {
          this.getOrCreateVarId(s.init.name, false);
        } else if (s.body && s.body.statements) {
          this.collectVarsFromStatements(s.body.statements);
        } else if (s.consequent && s.consequent.statements) {
          this.collectVarsFromStatements(s.consequent.statements);
        }
        if (s.alternate && s.alternate.statements) {
          this.collectVarsFromStatements(s.alternate.statements);
        }
      }
    }

    getOrCreateVarId(name, isArray = false) {
      if (!this.variables.has(name)) {
        const id = generateId('var_' + name + '_');
        this.variables.set(name, { id, isArray });
        return id;
      }
      const existing = this.variables.get(name);
      if (isArray && !existing.isArray) {
        existing.isArray = true;
      }
      return existing.id;
    }

    convertStatementChain(statements, indent = '') {
      if (!statements || statements.length === 0) return '';

      let chainXml = '';
      let currentIndent = indent;
      const closingTags = [];

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const blockXml = this.convertStatement(stmt, currentIndent);
        if (!blockXml) continue;

        if (i === 0) {
          chainXml += blockXml;
        } else {
          chainXml += `${currentIndent}<next>\n`;
          chainXml += blockXml;
          closingTags.push(`${currentIndent}</next>\n`);
        }
        currentIndent += '  ';
      }

      // Close all <next> tags in reverse order
      while (closingTags.length > 0) {
        chainXml += closingTags.pop();
      }

      return chainXml;
    }

    convertStatement(stmt, indent = '') {
      if (!stmt) return '';
      this.stats.blocksGenerated++;

      switch (stmt.type) {
        case 'VariableDeclarator':
          return this.convertVariableDeclarator(stmt, indent);

        case 'ExpressionStatement':
          return this.convertExpressionStatement(stmt.expression, indent);

        case 'IfStatement':
          return this.convertIfStatement(stmt, indent);

        case 'ForStatement':
          return this.convertForStatement(stmt, indent);

        case 'WhileStatement':
          return this.convertWhileStatement(stmt, indent);

        case 'DoWhileStatement':
          return this.convertDoWhileStatement(stmt, indent);

        case 'BreakStatement':
          return `${indent}<block type="controls_flow_statements" id="${generateId('brk_')}">\n` +
                 `${indent}  <field name="FLOW">BREAK</field>\n` +
                 `${indent}</block>\n`;

        case 'ContinueStatement':
          return `${indent}<block type="controls_flow_statements" id="${generateId('cnt_')}">\n` +
                 `${indent}  <field name="FLOW">CONTINUE</field>\n` +
                 `${indent}</block>\n`;

        case 'ReturnStatement':
          // Standalone return in void function or custom code
          return `${indent}<block type="arduino_custom_code" id="${generateId('ret_')}">\n` +
                 `${indent}  <field name="CODE">return;</field>\n` +
                 `${indent}</block>\n`;

        default:
          this.warnings.push(`Unhandled statement type: ${stmt.type}`);
          return '';
      }
    }

    convertVariableDeclarator(decl, indent) {
      const varId = this.getOrCreateVarId(decl.name, decl.isArray);
      const blockId = generateId('decl_');

      if (decl.isArray && decl.initializer && decl.initializer.type === 'ArrayLiteral') {
        // List initialization: arr = [val0, val1, ...]
        const elems = decl.initializer.elements || [];
        let xml = `${indent}<block type="variables_set" id="${blockId}">\n`;
        xml += `${indent}  <field name="VAR" id="${varId}">${escapeXml(decl.name)}</field>\n`;
        xml += `${indent}  <value name="VALUE">\n`;
        xml += `${indent}    <block type="lists_create_with" id="${generateId('list_')}">\n`;
        xml += `${indent}      <mutation items="${elems.length}"></mutation>\n`;
        for (let i = 0; i < elems.length; i++) {
          xml += `${indent}      <value name="ADD${i}">\n`;
          xml += this.convertExpression(elems[i], indent + '        ');
          xml += `${indent}      </value>\n`;
        }
        xml += `${indent}    </block>\n`;
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      if (decl.initializer) {
        let xml = `${indent}<block type="variables_set" id="${blockId}">\n`;
        xml += `${indent}  <field name="VAR" id="${varId}">${escapeXml(decl.name)}</field>\n`;
        xml += `${indent}  <value name="VALUE">\n`;
        xml += this.convertExpression(decl.initializer, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Variable declaration without initial value - default to 0 / empty
      let xml = `${indent}<block type="variables_set" id="${blockId}">\n`;
      xml += `${indent}  <field name="VAR" id="${varId}">${escapeXml(decl.name)}</field>\n`;
      xml += `${indent}  <value name="VALUE">\n`;
      xml += `${indent}    <shadow type="math_number"><field name="NUM">0</field></shadow>\n`;
      xml += `${indent}  </value>\n`;
      xml += `${indent}</block>\n`;
      return xml;
    }

    convertExpressionStatement(expr, indent) {
      if (!expr) return '';

      // 1. Assignment expression
      if (expr.type === 'AssignmentExpression') {
        return this.convertAssignment(expr, indent);
      }

      // 2. Update expression: x++ or --x
      if (expr.type === 'UpdateExpression') {
        const delta = expr.operator === '++' ? 1 : -1;
        const varName = expr.argument.name || 'i';
        const varId = this.getOrCreateVarId(varName);
        return `${indent}<block type="math_change" id="${generateId('chg_')}">\n` +
               `${indent}  <field name="VAR" id="${varId}">${escapeXml(varName)}</field>\n` +
               `${indent}  <value name="DELTA">\n` +
               `${indent}    <shadow type="math_number"><field name="NUM">${delta}</field></shadow>\n` +
               `${indent}  </value>\n` +
               `${indent}</block>\n`;
      }

      // 3. Function / method call statement
      if (expr.type === 'CallExpression') {
        return this.convertCallStatement(expr, indent);
      }

      // Fallback
      return `${indent}<block type="arduino_custom_code" id="${generateId('expr_')}">\n` +
             `${indent}  <field name="CODE">/* expression */</field>\n` +
             `${indent}</block>\n`;
    }

    convertAssignment(expr, indent) {
      // Array index assignment: arr[idx] = val
      // REQUIREMENT: Automatically handle 0-based to 1-based list indexing conversions for variables and arrays!
      if (expr.left && expr.left.type === 'ArrayAccess') {
        const arrName = expr.left.array.name || 'myList';
        const varId = this.getOrCreateVarId(arrName, true);
        const blockId = generateId('arr_set_');

        let xml = `${indent}<block type="lists_setIndex" id="${blockId}">\n`;
        xml += `${indent}  <mutation at="true"></mutation>\n`;
        xml += `${indent}  <field name="MODE">SET</field>\n`;
        xml += `${indent}  <field name="WHERE">FROM_START</field>\n`;
        xml += `${indent}  <value name="LIST">\n`;
        xml += `${indent}    <block type="variables_get" id="${generateId('vget_')}">\n`;
        xml += `${indent}      <field name="VAR" id="${varId}">${escapeXml(arrName)}</field>\n`;
        xml += `${indent}    </block>\n`;
        xml += `${indent}  </value>\n`;

        // Convert index with 0-based -> 1-based indexing logic
        xml += `${indent}  <value name="AT">\n`;
        xml += this.convertArrayIndexExpression(expr.left.index, indent + '    ');
        xml += `${indent}  </value>\n`;

        // Value being set
        xml += `${indent}  <value name="TO">\n`;
        xml += this.convertExpression(expr.right, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Compound assignment: x += 5, x -= 2
      if (expr.operator === '+=' || expr.operator === '-=') {
        const varName = expr.left.name || 'x';
        const varId = this.getOrCreateVarId(varName);
        if (expr.operator === '+=' && expr.right.type === 'Literal' && typeof expr.right.value === 'number') {
          return `${indent}<block type="math_change" id="${generateId('chg_')}">\n` +
                 `${indent}  <field name="VAR" id="${varId}">${escapeXml(varName)}</field>\n` +
                 `${indent}  <value name="DELTA">\n` +
                 `${indent}    <shadow type="math_number"><field name="NUM">${expr.right.value}</field></shadow>\n` +
                 `${indent}  </value>\n` +
                 `${indent}</block>\n`;
        }
      }

      // Regular variable assignment: x = value
      const varName = (expr.left && expr.left.name) ? expr.left.name : 'x';
      const varId = this.getOrCreateVarId(varName);
      let xml = `${indent}<block type="variables_set" id="${generateId('set_')}">\n`;
      xml += `${indent}  <field name="VAR" id="${varId}">${escapeXml(varName)}</field>\n`;
      xml += `${indent}  <value name="VALUE">\n`;
      xml += this.convertExpression(expr.right, indent + '    ');
      xml += `${indent}  </value>\n`;
      xml += `${indent}</block>\n`;
      return xml;
    }

    convertCallStatement(call, indent) {
      const calleeName = this.getCalleeName(call.callee);
      const args = call.arguments || [];
      const blockId = generateId('call_');

      // digitalWrite(pin, state)
      if (calleeName === 'digitalWrite') {
        let xml = `${indent}<block type="arduino_digital_write" id="${blockId}">\n`;
        xml += `${indent}  <value name="PIN">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}  <value name="STATE">\n`;
        xml += this.convertExpression(args[1], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // pinMode(pin, mode)
      if (calleeName === 'pinMode') {
        let mode = 'OUTPUT';
        if (args[1] && args[1].name) {
          mode = args[1].name;
        } else if (args[1] && args[1].value !== undefined) {
          mode = String(args[1].value);
        }
        let xml = `${indent}<block type="arduino_pin_mode" id="${blockId}">\n`;
        xml += `${indent}  <field name="MODE">${escapeXml(mode)}</field>\n`;
        xml += `${indent}  <value name="PIN">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // analogWrite(pin, val)
      if (calleeName === 'analogWrite') {
        let xml = `${indent}<block type="arduino_analog_write" id="${blockId}">\n`;
        xml += `${indent}  <value name="PIN">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}  <value name="VALUE">\n`;
        xml += this.convertExpression(args[1], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // tone(pin, freq, duration?)
      if (calleeName === 'tone') {
        if (args.length >= 3) {
          let xml = `${indent}<block type="arduino_tone" id="${blockId}">\n`;
          xml += `${indent}  <value name="PIN">\n`;
          xml += this.convertExpression(args[0], indent + '    ');
          xml += `${indent}  </value>\n`;
          xml += `${indent}  <value name="FREQUENCY">\n`;
          xml += this.convertExpression(args[1], indent + '    ');
          xml += `${indent}  </value>\n`;
          xml += `${indent}  <value name="DURATION">\n`;
          xml += this.convertExpression(args[2], indent + '    ');
          xml += `${indent}  </value>\n`;
          xml += `${indent}</block>\n`;
          return xml;
        } else {
          let xml = `${indent}<block type="arduino_tone_continuous" id="${blockId}">\n`;
          xml += `${indent}  <value name="PIN">\n`;
          xml += this.convertExpression(args[0], indent + '    ');
          xml += `${indent}  </value>\n`;
          xml += `${indent}  <value name="FREQUENCY">\n`;
          xml += this.convertExpression(args[1], indent + '    ');
          xml += `${indent}  </value>\n`;
          xml += `${indent}</block>\n`;
          return xml;
        }
      }

      // noTone(pin)
      if (calleeName === 'noTone') {
        let xml = `${indent}<block type="arduino_notone" id="${blockId}">\n`;
        xml += `${indent}  <value name="PIN">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // delay(ms)
      if (calleeName === 'delay') {
        let xml = `${indent}<block type="arduino_delay" id="${blockId}">\n`;
        xml += `${indent}  <value name="DELAY_TIME_MS">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // delayMicroseconds(us)
      if (calleeName === 'delayMicroseconds') {
        let xml = `${indent}<block type="arduino_delay_microseconds" id="${blockId}">\n`;
        xml += `${indent}  <value name="DELAY_TIME_US">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Serial.begin(baud)
      if (calleeName === 'Serial.begin') {
        const baud = (args[0] && args[0].value) ? String(args[0].value) : '9600';
        return `${indent}<block type="arduino_serial_begin" id="${blockId}">\n` +
               `${indent}  <field name="BAUD">${escapeXml(baud)}</field>\n` +
               `${indent}</block>\n`;
      }

      // Serial.println(msg)
      if (calleeName === 'Serial.println') {
        let xml = `${indent}<block type="arduino_serial_println" id="${blockId}">\n`;
        xml += `${indent}  <value name="CONTENT">\n`;
        xml += (args.length > 0) ? this.convertExpression(args[0], indent + '    ')
                                  : `${indent}    <shadow type="text"><field name="TEXT"></field></shadow>\n`;
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Serial.print(msg)
      if (calleeName === 'Serial.print') {
        let xml = `${indent}<block type="arduino_serial_print" id="${blockId}">\n`;
        xml += `${indent}  <value name="CONTENT">\n`;
        xml += (args.length > 0) ? this.convertExpression(args[0], indent + '    ')
                                  : `${indent}    <shadow type="text"><field name="TEXT"></field></shadow>\n`;
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // User-defined procedure call
      if (this.functions.has(calleeName)) {
        let xml = `${indent}<block type="procedures_callnoreturn" id="${blockId}">\n`;
        xml += `${indent}  <mutation name="${escapeXml(calleeName)}">\n`;
        const fnMeta = this.functions.get(calleeName);
        if (fnMeta && fnMeta.params) {
          for (const p of fnMeta.params) {
            xml += `${indent}    <arg name="${escapeXml(p.name)}"></arg>\n`;
          }
        }
        xml += `${indent}  </mutation>\n`;
        for (let i = 0; i < args.length; i++) {
          xml += `${indent}  <value name="ARG${i}">\n`;
          xml += this.convertExpression(args[i], indent + '    ');
          xml += `${indent}  </value>\n`;
        }
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Custom/Generic C++ function call fallback
      return `${indent}<block type="arduino_custom_code" id="${blockId}">\n` +
             `${indent}  <field name="CODE">${escapeXml(calleeName + '(...);')}</field>\n` +
             `${indent}</block>\n`;
    }

    convertIfStatement(stmt, indent) {
      // Flatten if-else if-else chain
      const conditions = [];
      let current = stmt;

      while (current && current.type === 'IfStatement') {
        conditions.push({
          test: current.test,
          consequent: current.consequent ? current.consequent.statements : []
        });

        if (current.alternate && current.alternate.statements && current.alternate.statements.length === 1 && current.alternate.statements[0].type === 'IfStatement') {
          current = current.alternate.statements[0];
        } else if (current.alternate && current.alternate.type === 'IfStatement') {
          current = current.alternate;
        } else {
          break;
        }
      }

      const elseClause = (current && current.alternate && current.alternate.type !== 'IfStatement')
        ? (current.alternate.statements || [current.alternate])
        : null;

      const elseifCount = conditions.length - 1;
      const hasElse = elseClause !== null && elseClause.length > 0;
      const blockId = generateId('if_');

      let xml = `${indent}<block type="controls_if" id="${blockId}">\n`;
      if (elseifCount > 0 || hasElse) {
        xml += `${indent}  <mutation elseif="${elseifCount}" else="${hasElse ? 1 : 0}"></mutation>\n`;
      }

      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        xml += `${indent}  <value name="IF${i}">\n`;
        xml += this.convertExpression(cond.test, indent + '    ');
        xml += `${indent}  </value>\n`;

        if (cond.consequent && cond.consequent.length > 0) {
          xml += `${indent}  <statement name="DO${i}">\n`;
          xml += this.convertStatementChain(cond.consequent, indent + '    ');
          xml += `${indent}  </statement>\n`;
        }
      }

      if (hasElse) {
        xml += `${indent}  <statement name="ELSE">\n`;
        xml += this.convertStatementChain(elseClause, indent + '    ');
        xml += `${indent}  </statement>\n`;
      }

      xml += `${indent}</block>\n`;
      return xml;
    }

    convertForStatement(stmt, indent) {
      // Analyze if it's a standard counting loop: for (int i = 0; i < N; i++)
      let loopVar = 'i';
      let startVal = 0;
      let endVal = 10;
      let stepVal = 1;

      if (stmt.init) {
        if (stmt.init.type === 'VariableDeclarator') {
          loopVar = stmt.init.name || 'i';
          if (stmt.init.initializer && stmt.init.initializer.type === 'Literal') {
            startVal = stmt.init.initializer.value;
          }
        } else if (stmt.init.type === 'AssignmentExpression') {
          loopVar = stmt.init.left.name || 'i';
          if (stmt.init.right && stmt.init.right.type === 'Literal') {
            startVal = stmt.init.right.value;
          }
        }
      }

      const varId = this.getOrCreateVarId(loopVar);

      if (stmt.test && stmt.test.type === 'BinaryExpression') {
        if (stmt.test.right && stmt.test.right.type === 'Literal') {
          endVal = stmt.test.right.value;
          // if '<', upper bound in Blockly controls_for is inclusive, so if i < 10, to=9 or 10
          if (stmt.test.operator === '<' && typeof endVal === 'number') {
            endVal = endVal - 1;
          }
        }
      }

      if (stmt.update) {
        if (stmt.update.operator === '--') {
          stepVal = -1;
        } else if (stmt.update.operator === '+=' && stmt.update.right && stmt.update.right.value) {
          stepVal = stmt.update.right.value;
        }
      }

      const blockId = generateId('for_');
      let xml = `${indent}<block type="controls_for" id="${blockId}">\n`;
      xml += `${indent}  <field name="VAR" id="${varId}">${escapeXml(loopVar)}</field>\n`;
      xml += `${indent}  <value name="FROM">\n`;
      xml += `${indent}    <shadow type="math_number"><field name="NUM">${startVal}</field></shadow>\n`;
      xml += `${indent}  </value>\n`;
      xml += `${indent}  <value name="TO">\n`;
      if (typeof endVal === 'number') {
        xml += `${indent}    <shadow type="math_number"><field name="NUM">${endVal}</field></shadow>\n`;
      } else if (stmt.test && stmt.test.right) {
        xml += this.convertExpression(stmt.test.right, indent + '    ');
      } else {
        xml += `${indent}    <shadow type="math_number"><field name="NUM">10</field></shadow>\n`;
      }
      xml += `${indent}  </value>\n`;
      xml += `${indent}  <value name="BY">\n`;
      xml += `${indent}    <shadow type="math_number"><field name="NUM">${stepVal}</field></shadow>\n`;
      xml += `${indent}  </value>\n`;

      if (stmt.body && stmt.body.statements && stmt.body.statements.length > 0) {
        xml += `${indent}  <statement name="DO">\n`;
        xml += this.convertStatementChain(stmt.body.statements, indent + '    ');
        xml += `${indent}  </statement>\n`;
      }

      xml += `${indent}</block>\n`;
      return xml;
    }

    convertWhileStatement(stmt, indent) {
      const blockId = generateId('while_');
      let xml = `${indent}<block type="controls_whileUntil" id="${blockId}">\n`;
      xml += `${indent}  <field name="MODE">WHILE</field>\n`;
      xml += `${indent}  <value name="BOOL">\n`;
      xml += this.convertExpression(stmt.test, indent + '    ');
      xml += `${indent}  </value>\n`;

      if (stmt.body && stmt.body.statements && stmt.body.statements.length > 0) {
        xml += `${indent}  <statement name="DO">\n`;
        xml += this.convertStatementChain(stmt.body.statements, indent + '    ');
        xml += `${indent}  </statement>\n`;
      }

      xml += `${indent}</block>\n`;
      return xml;
    }

    convertDoWhileStatement(stmt, indent) {
      // Represent do-while cleanly as while loop or repeat
      return this.convertWhileStatement(stmt, indent);
    }

    // Convert expressions (returns Blockly XML value node)
    convertExpression(expr, indent = '') {
      if (!expr) {
        return `${indent}<shadow type="math_number"><field name="NUM">0</field></shadow>\n`;
      }
      this.stats.blocksGenerated++;

      // 1. Literal numbers, booleans, strings, constants
      if (expr.type === 'Literal') {
        if (expr.valueType === 'number') {
          return `${indent}<block type="math_number" id="${generateId('num_')}">\n` +
                 `${indent}  <field name="NUM">${expr.value}</field>\n` +
                 `${indent}</block>\n`;
        }
        if (expr.valueType === 'boolean') {
          const val = expr.value ? 'TRUE' : 'FALSE';
          return `${indent}<block type="logic_boolean" id="${generateId('bool_')}">\n` +
                 `${indent}  <field name="BOOL">${val}</field>\n` +
                 `${indent}</block>\n`;
        }
        if (expr.valueType === 'string' || expr.valueType === 'char') {
          return `${indent}<block type="text" id="${generateId('txt_')}">\n` +
                 `${indent}  <field name="TEXT">${escapeXml(expr.value)}</field>\n` +
                 `${indent}</block>\n`;
        }
      }

      // Arduino Constants (HIGH, LOW, INPUT, etc.)
      if (expr.type === 'ArduinoConstant') {
        if (expr.name === 'HIGH' || expr.name === 'LOW') {
          return `${indent}<block type="arduino_level" id="${generateId('lvl_')}">\n` +
                 `${indent}  <field name="LEVEL">${expr.name}</field>\n` +
                 `${indent}</block>\n`;
        }
        return `${indent}<block type="text" id="${generateId('cst_')}">\n` +
               `${indent}  <field name="TEXT">${escapeXml(expr.name)}</field>\n` +
               `${indent}</block>\n`;
      }

      // 2. Identifiers (variable read)
      if (expr.type === 'Identifier') {
        const varId = this.getOrCreateVarId(expr.name);
        return `${indent}<block type="variables_get" id="${generateId('vget_')}">\n` +
               `${indent}  <field name="VAR" id="${varId}">${escapeXml(expr.name)}</field>\n` +
               `${indent}</block>\n`;
      }

      // 3. Array Access (arr[i])
      // REQUIREMENT: Automatically handle 0-based to 1-based list indexing conversions for variables and arrays!
      if (expr.type === 'ArrayAccess') {
        const arrName = expr.array.name || 'myList';
        const varId = this.getOrCreateVarId(arrName, true);
        const blockId = generateId('arr_get_');

        let xml = `${indent}<block type="lists_getIndex" id="${blockId}">\n`;
        xml += `${indent}  <mutation statement="false" at="true"></mutation>\n`;
        xml += `${indent}  <field name="MODE">GET</field>\n`;
        xml += `${indent}  <field name="WHERE">FROM_START</field>\n`;
        xml += `${indent}  <value name="VALUE">\n`;
        xml += `${indent}    <block type="variables_get" id="${generateId('vget_')}">\n`;
        xml += `${indent}      <field name="VAR" id="${varId}">${escapeXml(arrName)}</field>\n`;
        xml += `${indent}    </block>\n`;
        xml += `${indent}  </value>\n`;
        xml += `${indent}  <value name="AT">\n`;
        xml += this.convertArrayIndexExpression(expr.index, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // 4. Binary Expressions (+, -, *, /, %, ==, !=, <, <=, >, >=, &&, ||)
      if (expr.type === 'BinaryExpression') {
        return this.convertBinaryExpression(expr, indent);
      }

      // 5. Unary Expressions (!x, -x)
      if (expr.type === 'UnaryExpression') {
        if (expr.operator === '!') {
          let xml = `${indent}<block type="logic_negate" id="${generateId('not_')}">\n`;
          xml += `${indent}  <value name="BOOL">\n`;
          xml += this.convertExpression(expr.argument, indent + '    ');
          xml += `${indent}  </value>\n`;
          xml += `${indent}</block>\n`;
          return xml;
        }
        if (expr.operator === '-') {
          // 0 - arg
          let xml = `${indent}<block type="math_arithmetic" id="${generateId('neg_')}">\n`;
          xml += `${indent}  <field name="OP">MINUS</field>\n`;
          xml += `${indent}  <value name="A">\n`;
          xml += `${indent}    <shadow type="math_number"><field name="NUM">0</field></shadow>\n`;
          xml += `${indent}  </value>\n`;
          xml += `${indent}  <value name="B">\n`;
          xml += this.convertExpression(expr.argument, indent + '    ');
          xml += `${indent}  </value>\n`;
          xml += `${indent}</block>\n`;
          return xml;
        }
      }

      // 6. Call Expressions that produce value: digitalRead, analogRead, millis, micros, map
      if (expr.type === 'CallExpression') {
        return this.convertValueCallExpression(expr, indent);
      }

      // Default fallback
      return `${indent}<shadow type="math_number"><field name="NUM">0</field></shadow>\n`;
    }

    /**
     * Automatic 0-based to 1-based indexing conversion:
     * C++ arr[0] -> Blockly item 1 of list
     * C++ arr[i] -> Blockly item (i + 1) of list
     */
    convertArrayIndexExpression(indexNode, indent) {
      this.stats.indexedConversions++;

      // Case A: Index is an integer literal constant (e.g., 0, 1, 4)
      if (indexNode && indexNode.type === 'Literal' && typeof indexNode.value === 'number') {
        const adjusted = indexNode.value + 1; // 0 becomes 1
        return `${indent}<block type="math_number" id="${generateId('idx_')}">\n` +
               `${indent}  <field name="NUM">${adjusted}</field>\n` +
               `${indent}</block>\n`;
      }

      // Case B: Index is an expression or variable (e.g., i, i * 2)
      // We wrap it in a math_arithmetic block: (expr + 1)
      const blockId = generateId('idx_add_');
      let xml = `${indent}<block type="math_arithmetic" id="${blockId}">\n`;
      xml += `${indent}  <field name="OP">ADD</field>\n`;
      xml += `${indent}  <value name="A">\n`;
      xml += this.convertExpression(indexNode, indent + '    ');
      xml += `${indent}  </value>\n`;
      xml += `${indent}  <value name="B">\n`;
      xml += `${indent}    <shadow type="math_number"><field name="NUM">1</field></shadow>\n`;
      xml += `${indent}  </value>\n`;
      xml += `${indent}</block>\n`;
      return xml;
    }

    convertBinaryExpression(expr, indent) {
      const op = expr.operator;
      const blockId = generateId('bin_');

      // Math arithmetic: +, -, *, /, %
      const mathOps = {
        '+': 'ADD',
        '-': 'MINUS',
        '*': 'MULTIPLY',
        '/': 'DIVIDE',
        '%': 'MODULO'
      };

      if (op === '%') {
        let xml = `${indent}<block type="math_modulo" id="${blockId}">\n`;
        xml += `${indent}  <value name="DIVIDEND">\n`;
        xml += this.convertExpression(expr.left, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}  <value name="DIVISOR">\n`;
        xml += this.convertExpression(expr.right, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      if (mathOps[op]) {
        let xml = `${indent}<block type="math_arithmetic" id="${blockId}">\n`;
        xml += `${indent}  <field name="OP">${mathOps[op]}</field>\n`;
        xml += `${indent}  <value name="A">\n`;
        xml += this.convertExpression(expr.left, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}  <value name="B">\n`;
        xml += this.convertExpression(expr.right, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Comparison: ==, !=, <, <=, >, >=
      const compOps = {
        '==': 'EQ',
        '!=': 'NEQ',
        '<': 'LT',
        '<=': 'LTE',
        '>': 'GT',
        '>=': 'GTE'
      };

      if (compOps[op]) {
        let xml = `${indent}<block type="logic_compare" id="${blockId}">\n`;
        xml += `${indent}  <field name="OP">${compOps[op]}</field>\n`;
        xml += `${indent}  <value name="A">\n`;
        xml += this.convertExpression(expr.left, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}  <value name="B">\n`;
        xml += this.convertExpression(expr.right, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Logical: &&, ||
      if (op === '&&' || op === '||') {
        const logicOp = op === '&&' ? 'AND' : 'OR';
        let xml = `${indent}<block type="logic_operation" id="${blockId}">\n`;
        xml += `${indent}  <field name="OP">${logicOp}</field>\n`;
        xml += `${indent}  <value name="A">\n`;
        xml += this.convertExpression(expr.left, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}  <value name="B">\n`;
        xml += this.convertExpression(expr.right, indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Default arithmetic
      let xml = `${indent}<block type="math_arithmetic" id="${blockId}">\n`;
      xml += `${indent}  <field name="OP">ADD</field>\n`;
      xml += `${indent}  <value name="A">\n`;
      xml += this.convertExpression(expr.left, indent + '    ');
      xml += `${indent}  </value>\n`;
      xml += `${indent}  <value name="B">\n`;
      xml += this.convertExpression(expr.right, indent + '    ');
      xml += `${indent}  </value>\n`;
      xml += `${indent}</block>\n`;
      return xml;
    }

    convertValueCallExpression(call, indent) {
      const calleeName = this.getCalleeName(call.callee);
      const args = call.arguments || [];
      const blockId = generateId('vcall_');

      // digitalRead(pin)
      if (calleeName === 'digitalRead') {
        let xml = `${indent}<block type="arduino_digital_read" id="${blockId}">\n`;
        xml += `${indent}  <value name="PIN">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // analogRead(pin)
      if (calleeName === 'analogRead') {
        let xml = `${indent}<block type="arduino_analog_read" id="${blockId}">\n`;
        xml += `${indent}  <value name="PIN">\n`;
        xml += this.convertExpression(args[0], indent + '    ');
        xml += `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // millis()
      if (calleeName === 'millis') {
        return `${indent}<block type="arduino_millis" id="${blockId}"></block>\n`;
      }

      // micros()
      if (calleeName === 'micros') {
        return `${indent}<block type="arduino_micros" id="${blockId}"></block>\n`;
      }

      // map(val, fromL, fromH, toL, toH)
      if (calleeName === 'map' && args.length >= 5) {
        let xml = `${indent}<block type="arduino_map" id="${blockId}">\n`;
        xml += `${indent}  <value name="VALUE">\n` + this.convertExpression(args[0], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}  <value name="FROM_LOW">\n` + this.convertExpression(args[1], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}  <value name="FROM_HIGH">\n` + this.convertExpression(args[2], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}  <value name="TO_LOW">\n` + this.convertExpression(args[3], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}  <value name="TO_HIGH">\n` + this.convertExpression(args[4], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // constrain(val, low, high)
      if (calleeName === 'constrain' && args.length >= 3) {
        let xml = `${indent}<block type="arduino_constrain" id="${blockId}">\n`;
        xml += `${indent}  <value name="VALUE">\n` + this.convertExpression(args[0], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}  <value name="LOW">\n` + this.convertExpression(args[1], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}  <value name="HIGH">\n` + this.convertExpression(args[2], indent + '    ') + `${indent}  </value>\n`;
        xml += `${indent}</block>\n`;
        return xml;
      }

      // User-defined function with return value
      if (this.functions.has(calleeName)) {
        let xml = `${indent}<block type="procedures_callreturn" id="${blockId}">\n`;
        xml += `${indent}  <mutation name="${escapeXml(calleeName)}">\n`;
        const fnMeta = this.functions.get(calleeName);
        if (fnMeta && fnMeta.params) {
          for (const p of fnMeta.params) {
            xml += `${indent}    <arg name="${escapeXml(p.name)}"></arg>\n`;
          }
        }
        xml += `${indent}  </mutation>\n`;
        for (let i = 0; i < args.length; i++) {
          xml += `${indent}  <value name="ARG${i}">\n`;
          xml += this.convertExpression(args[i], indent + '    ');
          xml += `${indent}  </value>\n`;
        }
        xml += `${indent}</block>\n`;
        return xml;
      }

      // Default shadow
      return `${indent}<shadow type="math_number"><field name="NUM">0</field></shadow>\n`;
    }

    getCalleeName(callee) {
      if (!callee) return '';
      if (callee.type === 'Identifier') return callee.name;
      if (callee.type === 'MemberExpression') {
        const objName = this.getCalleeName(callee.object);
        return `${objName}.${callee.property}`;
      }
      return '';
    }
  }

  return {
    Converter,
    convertToBlocklyXml: (ast, options) => new Converter(ast, options).convert()
  };
}));
