/**
 * C++ / Arduino Recursive Descent AST Parser
 * Converts token streams into an Abstract Syntax Tree (AST) optimized
 * for PictoBlox / Blockly workspace generation.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./tokenizer'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./tokenizer'));
  } else {
    root.CppParser = factory(root.CppTokenizer);
  }
}(typeof self !== 'undefined' ? self : this, function (tokenizerModule) {
  'use strict';

  const { TokenType } = tokenizerModule;

  const TYPE_NAMES = new Set([
    'void', 'int', 'long', 'float', 'double', 'char', 'bool', 'boolean', 'String',
    'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'size_t',
    'unsigned', 'signed', 'short', 'byte'
  ]);

  class Parser {
    constructor(tokens) {
      this.tokens = tokens || [];
      this.pos = 0;
      this.diagnostics = [];
    }

    peek(offset = 0) {
      const idx = this.pos + offset;
      if (idx >= this.tokens.length) {
        return this.tokens[this.tokens.length - 1]; // EOF token
      }
      return this.tokens[idx];
    }

    advance() {
      const tok = this.peek();
      if (this.pos < this.tokens.length) {
        this.pos++;
      }
      return tok;
    }

    match(type, value = null) {
      const tok = this.peek();
      if (tok.type === type && (value === null || tok.value === value)) {
        return this.advance();
      }
      return null;
    }

    matchIdentifier() {
      const tok = this.peek();
      if (tok.type === TokenType.IDENTIFIER || tok.value === 'setup' || tok.value === 'loop' || tok.value === 'main') {
        return this.advance();
      }
      return null;
    }

    expectIdentifier(contextDesc = '') {
      const id = this.matchIdentifier();
      if (id) return id;
      const current = this.peek();
      this.diagnostics.push({
        line: current.line,
        column: current.column,
        message: `Expected identifier ${contextDesc ? 'at ' + contextDesc : ''}, but found "${current.value}" (${current.type}) at line ${current.line}:${current.column}`,
        severity: 'error'
      });
      return null;
    }

    expect(type, value = null, contextDesc = '') {
      const tok = this.match(type, value);
      if (tok) return tok;

      const current = this.peek();
      const expected = value ? `"${value}"` : type;
      const msg = `Expected ${expected} ${contextDesc ? 'at ' + contextDesc : ''}, but found "${current.value}" (${current.type}) at line ${current.line}:${current.column}`;
      this.diagnostics.push({
        line: current.line,
        column: current.column,
        message: msg,
        severity: 'error'
      });
      return null;
    }

    synchronize(stopTokens = [';', '}', ')']) {
      while (this.peek().type !== TokenType.EOF) {
        if (stopTokens.includes(this.peek().value)) {
          this.advance();
          break;
        }
        this.advance();
      }
    }

    parse() {
      const program = {
        type: 'Program',
        preprocessors: [],
        globals: [],
        functions: [],
        topLevelStatements: [],
        diagnostics: this.diagnostics
      };

      while (this.peek().type !== TokenType.EOF) {
        const cur = this.peek();

        // Preprocessor directives (#define, #include)
        if (cur.type === TokenType.PREPROCESSOR) {
          program.preprocessors.push(this.parsePreprocessor());
          continue;
        }

        // Top level declarations: global variables or functions
        if (this.isTypeDeclaration()) {
          const item = this.parseTopLevelItem();
          if (item) {
            if (item.type === 'FunctionDeclaration') {
              program.functions.push(item);
            } else if (item.type === 'VariableDeclarationList') {
              program.globals.push(...item.declarations);
            } else {
              program.globals.push(item);
            }
          }
        } else if (cur.value === ';') {
          this.advance(); // Stray semicolon
        } else if (['if', 'for', 'while', 'do'].includes(cur.value) || cur.type === TokenType.IDENTIFIER) {
          // Top-level statement support
          const stmt = this.parseStatement();
          if (stmt) {
            if (stmt.type === 'VariableDeclarationList') {
              program.globals.push(...stmt.declarations);
            } else {
              program.topLevelStatements.push(stmt);
            }
          }
        } else {
          // Unexpected top-level token
          this.diagnostics.push({
            line: cur.line,
            column: cur.column,
            message: `Unexpected token "${cur.value}" at top-level.`,
            severity: 'warning'
          });
          this.advance();
        }
      }

      return program;
    }

    parsePreprocessor() {
      const tok = this.advance();
      const raw = tok.value;
      const parts = raw.split(/\s+/);
      const directive = parts[0];

      if (directive === '#define' && parts.length >= 3) {
        return {
          type: 'DefineDirective',
          name: parts[1],
          value: parts.slice(2).join(' '),
          line: tok.line
        };
      } else if (directive === '#include' && parts.length >= 2) {
        return {
          type: 'IncludeDirective',
          header: parts[1].replace(/[<>"]/g, ''),
          line: tok.line
        };
      }
      return {
        type: 'RawPreprocessor',
        raw: raw,
        line: tok.line
      };
    }

    isTypeDeclaration() {
      let offset = 0;
      let tok = this.peek(offset);
      if (tok.value === 'const' || tok.value === 'static' || tok.value === 'unsigned') {
        offset++;
        tok = this.peek(offset);
      }
      if (TYPE_NAMES.has(tok.value) || tok.value === 'void') {
        return true;
      }
      // Custom classes/types like Servo or Adafruit_NeoPixel
      if (tok.type === TokenType.IDENTIFIER && this.peek(offset + 1).type === TokenType.IDENTIFIER) {
        return true;
      }
      return false;
    }

    parseTopLevelItem() {
      let isConst = false;
      let isStatic = false;

      while (this.peek().value === 'const' || this.peek().value === 'static') {
        if (this.peek().value === 'const') isConst = true;
        if (this.peek().value === 'static') isStatic = true;
        this.advance();
      }

      let typeName = this.advance().value;
      if (typeName === 'unsigned' && TYPE_NAMES.has(this.peek().value)) {
        typeName += ' ' + this.advance().value;
      }

      const nameTok = this.expectIdentifier('declaration identifier');
      if (!nameTok) {
        this.synchronize([';', '}']);
        return null;
      }
      const name = nameTok.value;

      // Check if this is a function definition: name followed by '('
      if (this.peek().value === '(') {
        return this.parseFunctionDeclaration(typeName, name, nameTok.line);
      }

      // Otherwise, it's one or more variable declarations: int a = 1, b = 2;
      return this.parseVariableDeclaration(typeName, name, isConst, isStatic, nameTok.line);
    }

    parseFunctionDeclaration(returnType, name, line) {
      this.expect(TokenType.PUNCTUATION, '(', 'function parameters');
      const params = [];
      while (this.peek().value !== ')' && this.peek().type !== TokenType.EOF) {
        // e.g. int pin, float val
        let pType = this.advance().value;
        if (pType === 'unsigned' && this.peek().type === TokenType.KEYWORD) {
          pType += ' ' + this.advance().value;
        }
        let pName = '';
        if (this.peek().type === TokenType.IDENTIFIER) {
          pName = this.advance().value;
        }
        params.push({ type: pType, name: pName });
        if (this.peek().value === ',') {
          this.advance();
        } else {
          break;
        }
      }
      this.expect(TokenType.PUNCTUATION, ')', 'end of function parameters');

      let body = null;
      if (this.peek().value === '{') {
        body = this.parseBlockStatement();
      } else if (this.peek().value === ';') {
        // Function prototype
        this.advance();
      }

      return {
        type: 'FunctionDeclaration',
        returnType,
        name,
        params,
        body,
        line
      };
    }

    parseVariableDeclaration(typeName, initialName, isConst, isStatic, line) {
      const declarations = [];
      let currentName = initialName;

      while (true) {
        let isArray = false;
        let arraySize = null;

        // Check for array: name[5] or name[]
        if (this.peek().value === '[') {
          this.advance();
          isArray = true;
          if (this.peek().value !== ']') {
            arraySize = this.parseExpression();
          }
          this.expect(TokenType.PUNCTUATION, ']', 'array dimension');
        }

        let initializer = null;
        if (this.peek().value === '=') {
          this.advance();
          if (this.peek().value === '{') {
            initializer = this.parseArrayInitializer();
          } else {
            initializer = this.parseExpression();
          }
        }

        declarations.push({
          type: 'VariableDeclarator',
          varType: typeName,
          name: currentName,
          isConst,
          isStatic,
          isArray,
          arraySize,
          initializer,
          line
        });

        if (this.peek().value === ',') {
          this.advance();
          const nextNameTok = this.expectIdentifier('variable name');
          if (!nextNameTok) break;
          currentName = nextNameTok.value;
        } else {
          break;
        }
      }

      this.expect(TokenType.PUNCTUATION, ';', 'variable declaration end');

      return {
        type: 'VariableDeclarationList',
        declarations,
        line
      };
    }

    parseArrayInitializer() {
      this.expect(TokenType.PUNCTUATION, '{', 'array initializer start');
      const elements = [];
      while (this.peek().value !== '}' && this.peek().type !== TokenType.EOF) {
        elements.push(this.parseExpression());
        if (this.peek().value === ',') {
          this.advance();
        } else {
          break;
        }
      }
      this.expect(TokenType.PUNCTUATION, '}', 'array initializer end');
      return {
        type: 'ArrayLiteral',
        elements
      };
    }

    parseBlockStatement() {
      this.expect(TokenType.PUNCTUATION, '{', 'block start');
      const statements = [];
      while (this.peek().value !== '}' && this.peek().type !== TokenType.EOF) {
        const stmt = this.parseStatement();
        if (stmt) {
          if (stmt.type === 'VariableDeclarationList') {
            statements.push(...stmt.declarations);
          } else {
            statements.push(stmt);
          }
        }
      }
      this.expect(TokenType.PUNCTUATION, '}', 'block end');
      return {
        type: 'BlockStatement',
        statements
      };
    }

    parseStatement() {
      const cur = this.peek();

      // Empty statement
      if (cur.value === ';') {
        this.advance();
        return null;
      }

      // Block statement
      if (cur.value === '{') {
        return this.parseBlockStatement();
      }

      // Control flow: if
      if (cur.value === 'if') {
        return this.parseIfStatement();
      }

      // Control flow: for
      if (cur.value === 'for') {
        return this.parseForStatement();
      }

      // Control flow: while
      if (cur.value === 'while') {
        return this.parseWhileStatement();
      }

      // Control flow: do-while
      if (cur.value === 'do') {
        return this.parseDoWhileStatement();
      }

      // return
      if (cur.value === 'return') {
        this.advance();
        let arg = null;
        if (this.peek().value !== ';') {
          arg = this.parseExpression();
        }
        this.expect(TokenType.PUNCTUATION, ';', 'return statement');
        return { type: 'ReturnStatement', argument: arg, line: cur.line };
      }

      // break
      if (cur.value === 'break') {
        this.advance();
        this.expect(TokenType.PUNCTUATION, ';', 'break statement');
        return { type: 'BreakStatement', line: cur.line };
      }

      // continue
      if (cur.value === 'continue') {
        this.advance();
        this.expect(TokenType.PUNCTUATION, ';', 'continue statement');
        return { type: 'ContinueStatement', line: cur.line };
      }

      // Local variable declaration
      if (this.isTypeDeclaration()) {
        let isConst = false;
        while (this.peek().value === 'const') {
          isConst = true;
          this.advance();
        }
        let typeName = this.advance().value;
        const nameTok = this.expectIdentifier('variable name');
        if (!nameTok) {
          this.synchronize([';']);
          return null;
        }
        return this.parseVariableDeclaration(typeName, nameTok.value, isConst, false, nameTok.line);
      }

      // Expression statement (e.g., digitalWrite(...); x = 5; x++;)
      const expr = this.parseExpression();
      this.expect(TokenType.PUNCTUATION, ';', 'expression statement');
      return {
        type: 'ExpressionStatement',
        expression: expr,
        line: cur.line
      };
    }

    parseIfStatement() {
      const ifTok = this.advance(); // 'if'
      this.expect(TokenType.PUNCTUATION, '(', 'if condition');
      const test = this.parseExpression();
      this.expect(TokenType.PUNCTUATION, ')', 'end of if condition');

      const consequent = this.parseStatementOrBlock();
      let alternate = null;

      if (this.peek().value === 'else') {
        this.advance(); // 'else'
        alternate = this.parseStatementOrBlock();
      }

      return {
        type: 'IfStatement',
        test,
        consequent,
        alternate,
        line: ifTok.line
      };
    }

    parseForStatement() {
      const forTok = this.advance(); // 'for'
      this.expect(TokenType.PUNCTUATION, '(', 'for clause start');

      let init = null;
      if (this.peek().value !== ';') {
        if (this.isTypeDeclaration()) {
          const typeName = this.advance().value;
          const nameTok = this.expectIdentifier('for init variable name');
          const name = nameTok ? nameTok.value : 'i';
          let initializer = null;
          if (this.peek().value === '=') {
            this.advance();
            initializer = this.parseExpression();
          }
          init = {
            type: 'VariableDeclarator',
            varType: typeName,
            name,
            initializer,
            line: forTok.line
          };
        } else {
          init = this.parseExpression();
        }
      }
      this.expect(TokenType.PUNCTUATION, ';', 'for init semicolon');

      let test = null;
      if (this.peek().value !== ';') {
        test = this.parseExpression();
      }
      this.expect(TokenType.PUNCTUATION, ';', 'for test semicolon');

      let update = null;
      if (this.peek().value !== ')') {
        update = this.parseExpression();
      }
      this.expect(TokenType.PUNCTUATION, ')', 'for clause end');

      const body = this.parseStatementOrBlock();

      return {
        type: 'ForStatement',
        init,
        test,
        update,
        body,
        line: forTok.line
      };
    }

    parseWhileStatement() {
      const whileTok = this.advance(); // 'while'
      this.expect(TokenType.PUNCTUATION, '(', 'while condition');
      const test = this.parseExpression();
      this.expect(TokenType.PUNCTUATION, ')', 'end of while condition');
      const body = this.parseStatementOrBlock();

      return {
        type: 'WhileStatement',
        test,
        body,
        line: whileTok.line
      };
    }

    parseDoWhileStatement() {
      const doTok = this.advance(); // 'do'
      const body = this.parseStatementOrBlock();
      this.expect(TokenType.KEYWORD, 'while', 'do-while condition');
      this.expect(TokenType.PUNCTUATION, '(', 'do-while condition start');
      const test = this.parseExpression();
      this.expect(TokenType.PUNCTUATION, ')', 'do-while condition end');
      this.expect(TokenType.PUNCTUATION, ';', 'do-while statement end');

      return {
        type: 'DoWhileStatement',
        body,
        test,
        line: doTok.line
      };
    }

    parseStatementOrBlock() {
      if (this.peek().value === '{') {
        return this.parseBlockStatement();
      }
      const stmt = this.parseStatement();
      return {
        type: 'BlockStatement',
        statements: stmt ? (stmt.type === 'VariableDeclarationList' ? stmt.declarations : [stmt]) : []
      };
    }

    // Expression parser with operator precedence Pratt-style / layered grammar
    parseExpression() {
      return this.parseAssignment();
    }

    parseAssignment() {
      let left = this.parseLogicalOr();

      const assignOps = ['=', '+=', '-=', '*=', '/=', '%='];
      if (assignOps.includes(this.peek().value)) {
        const op = this.advance().value;
        const right = this.parseAssignment();
        return {
          type: 'AssignmentExpression',
          operator: op,
          left,
          right,
          line: left.line || (this.peek().line)
        };
      }

      return left;
    }

    parseLogicalOr() {
      let left = this.parseLogicalAnd();
      while (this.peek().value === '||') {
        const op = this.advance().value;
        const right = this.parseLogicalAnd();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    }

    parseLogicalAnd() {
      let left = this.parseEquality();
      while (this.peek().value === '&&') {
        const op = this.advance().value;
        const right = this.parseEquality();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    }

    parseEquality() {
      let left = this.parseRelational();
      while (this.peek().value === '==' || this.peek().value === '!=') {
        const op = this.advance().value;
        const right = this.parseRelational();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    }

    parseRelational() {
      let left = this.parseAdditive();
      while (['<', '<=', '>', '>='].includes(this.peek().value)) {
        const op = this.advance().value;
        const right = this.parseAdditive();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    }

    parseAdditive() {
      let left = this.parseMultiplicative();
      while (this.peek().value === '+' || this.peek().value === '-') {
        const op = this.advance().value;
        const right = this.parseMultiplicative();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    }

    parseMultiplicative() {
      let left = this.parseUnary();
      while (['*', '/', '%'].includes(this.peek().value)) {
        const op = this.advance().value;
        const right = this.parseUnary();
        left = { type: 'BinaryExpression', operator: op, left, right };
      }
      return left;
    }

    parseUnary() {
      // Prefix unary: !, -, +, ~, ++, --
      if (['!', '-', '+', '~', '++', '--'].includes(this.peek().value)) {
        const op = this.advance().value;
        if (op === '++' || op === '--') {
          const arg = this.parseUnary();
          return {
            type: 'UpdateExpression',
            operator: op,
            argument: arg,
            prefix: true
          };
        }
        const arg = this.parseUnary();
        return {
          type: 'UnaryExpression',
          operator: op,
          argument: arg,
          prefix: true
        };
      }
      return this.parsePostfix();
    }

    parsePostfix() {
      let expr = this.parsePrimary();

      while (true) {
        // Function / Method call: expr(...)
        if (this.peek().value === '(') {
          this.advance();
          const args = [];
          while (this.peek().value !== ')' && this.peek().type !== TokenType.EOF) {
            args.push(this.parseExpression());
            if (this.peek().value === ',') {
              this.advance();
            } else {
              break;
            }
          }
          this.expect(TokenType.PUNCTUATION, ')', 'function call arguments');
          expr = {
            type: 'CallExpression',
            callee: expr,
            arguments: args,
            line: expr.line
          };
          continue;
        }

        // Array indexing: expr[idx]
        if (this.peek().value === '[') {
          this.advance();
          const index = this.parseExpression();
          this.expect(TokenType.PUNCTUATION, ']', 'array access');
          expr = {
            type: 'ArrayAccess',
            array: expr,
            index: index,
            isZeroBased: true, // Tagged for automatic 0-based to 1-based conversion
            line: expr.line
          };
          continue;
        }

        // Member access: expr.prop or expr->prop
        if (this.peek().value === '.' || this.peek().value === '->') {
          const op = this.advance().value;
          const propTok = this.expect(TokenType.IDENTIFIER, null, 'member property');
          const propName = propTok ? propTok.value : '';
          expr = {
            type: 'MemberExpression',
            object: expr,
            property: propName,
            line: expr.line
          };
          continue;
        }

        // Postfix increment / decrement: expr++, expr--
        if (this.peek().value === '++' || this.peek().value === '--') {
          const op = this.advance().value;
          expr = {
            type: 'UpdateExpression',
            operator: op,
            argument: expr,
            prefix: false
          };
          continue;
        }

        break;
      }

      return expr;
    }

    parsePrimary() {
      const tok = this.peek();

      // Parenthesized expression
      if (tok.value === '(') {
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.PUNCTUATION, ')', 'closing parenthesis');
        return expr;
      }

      // Numbers
      if (tok.type === TokenType.NUMBER) {
        this.advance();
        let val;
        if (tok.value.startsWith('0x') || tok.value.startsWith('0X')) {
          val = parseInt(tok.value, 16);
        } else if (tok.value.startsWith('0b') || tok.value.startsWith('0B')) {
          val = parseInt(tok.value.slice(2), 2);
        } else {
          val = parseFloat(tok.value);
        }
        return {
          type: 'Literal',
          valueType: 'number',
          value: val,
          raw: tok.value,
          line: tok.line
        };
      }

      // Strings
      if (tok.type === TokenType.STRING) {
        this.advance();
        return {
          type: 'Literal',
          valueType: 'string',
          value: tok.value,
          raw: `"${tok.value}"`,
          line: tok.line
        };
      }

      // Character literals
      if (tok.type === TokenType.CHAR) {
        this.advance();
        return {
          type: 'Literal',
          valueType: 'char',
          value: tok.value,
          line: tok.line
        };
      }

      // Booleans & Constants
      if (tok.value === 'true' || tok.value === 'false') {
        this.advance();
        return {
          type: 'Literal',
          valueType: 'boolean',
          value: tok.value === 'true',
          line: tok.line
        };
      }

      if (['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN'].includes(tok.value)) {
        this.advance();
        return {
          type: 'ArduinoConstant',
          name: tok.value,
          line: tok.line
        };
      }

      // Identifiers (variable name, function name, object)
      if (tok.type === TokenType.IDENTIFIER || tok.type === TokenType.KEYWORD) {
        this.advance();
        return {
          type: 'Identifier',
          name: tok.value,
          line: tok.line
        };
      }

      // Fallback: create error node and advance
      this.diagnostics.push({
        line: tok.line,
        column: tok.column,
        message: `Unexpected token in expression: "${tok.value}"`,
        severity: 'error'
      });
      this.advance();
      return {
        type: 'ErrorNode',
        token: tok,
        line: tok.line
      };
    }
  }

  return {
    Parser,
    parse: (tokens) => new Parser(tokens).parse()
  };
}));
