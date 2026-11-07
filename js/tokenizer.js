/**
 * C++ / Arduino Lexical Tokenizer
 * Parses C++ source into a stream of typed tokens with line/column metadata.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CppTokenizer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TokenType = {
    KEYWORD: 'KEYWORD',
    IDENTIFIER: 'IDENTIFIER',
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    CHAR: 'CHAR',
    OPERATOR: 'OPERATOR',
    PUNCTUATION: 'PUNCTUATION',
    PREPROCESSOR: 'PREPROCESSOR',
    COMMENT: 'COMMENT',
    EOF: 'EOF'
  };

  const KEYWORDS = new Set([
    'void', 'int', 'long', 'float', 'double', 'char', 'bool', 'boolean', 'String', 'uint8_t', 'uint16_t', 'uint32_t',
    'int8_t', 'int16_t', 'int32_t', 'size_t', 'unsigned', 'signed', 'short', 'byte', 'const', 'static', 'auto',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
    'true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN',
    'null', 'nullptr'
  ]);

  const TWO_CHAR_OPS = new Set([
    '==', '!=', '<=', '>=', '&&', '||', '++', '--',
    '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '->', '::'
  ]);

  const ONE_CHAR_OPS = new Set([
    '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', '?'
  ]);

  const PUNCTUATIONS = new Set([
    ';', ',', '(', ')', '{', '}', '[', ']', ':', '.'
  ]);

  class Token {
    constructor(type, value, line, column, raw) {
      this.type = type;
      this.value = value;
      this.line = line;
      this.column = column;
      this.raw = raw !== undefined ? raw : value;
    }
  }

  class Tokenizer {
    constructor(source) {
      this.source = source || '';
      this.length = this.source.length;
      this.pos = 0;
      this.line = 1;
      this.column = 1;
      this.diagnostics = [];
    }

    peek(offset = 0) {
      const idx = this.pos + offset;
      if (idx >= this.length) return null;
      return this.source[idx];
    }

    advance() {
      if (this.pos >= this.length) return null;
      const ch = this.source[this.pos++];
      if (ch === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      return ch;
    }

    isWhitespace(ch) {
      return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
    }

    isAlpha(ch) {
      return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
    }

    isDigit(ch) {
      return ch >= '0' && ch <= '9';
    }

    isAlphaNumeric(ch) {
      return this.isAlpha(ch) || this.isDigit(ch);
    }

    tokenize(includeComments = false) {
      const tokens = [];

      while (this.pos < this.length) {
        const startLine = this.line;
        const startCol = this.column;
        const ch = this.peek();

        // Skip whitespace
        if (this.isWhitespace(ch)) {
          this.advance();
          continue;
        }

        // Preprocessor directive (e.g., #define PIN 13, #include <Arduino.h>)
        if (ch === '#') {
          let directive = '';
          while (this.pos < this.length && this.peek() !== '\n') {
            directive += this.advance();
          }
          tokens.push(new Token(TokenType.PREPROCESSOR, directive.trim(), startLine, startCol));
          continue;
        }

        // Comments
        if (ch === '/' && this.peek(1) === '/') {
          let comment = '';
          while (this.pos < this.length && this.peek() !== '\n') {
            comment += this.advance();
          }
          if (includeComments) {
            tokens.push(new Token(TokenType.COMMENT, comment, startLine, startCol));
          }
          continue;
        }

        if (ch === '/' && this.peek(1) === '*') {
          let comment = '';
          this.advance(); // /
          this.advance(); // *
          comment += '/*';
          while (this.pos < this.length) {
            if (this.peek() === '*' && this.peek(1) === '/') {
              this.advance();
              this.advance();
              comment += '*/';
              break;
            }
            comment += this.advance();
          }
          if (includeComments) {
            tokens.push(new Token(TokenType.COMMENT, comment, startLine, startCol));
          }
          continue;
        }

        // Numbers: Decimal, Hex (0x..), Binary (0b..), Float (12.34)
        if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek(1)))) {
          let numStr = '';
          if (ch === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
            numStr += this.advance(); // 0
            numStr += this.advance(); // x
            while (this.pos < this.length && /[0-9a-fA-F]/.test(this.peek())) {
              numStr += this.advance();
            }
          } else if (ch === '0' && (this.peek(1) === 'b' || this.peek(1) === 'B')) {
            numStr += this.advance(); // 0
            numStr += this.advance(); // b
            while (this.pos < this.length && /[01]/.test(this.peek())) {
              numStr += this.advance();
            }
          } else {
            let hasDot = false;
            while (this.pos < this.length) {
              const cur = this.peek();
              if (this.isDigit(cur)) {
                numStr += this.advance();
              } else if (cur === '.' && !hasDot && this.isDigit(this.peek(1))) {
                hasDot = true;
                numStr += this.advance();
              } else if (cur === 'f' || cur === 'F' || cur === 'u' || cur === 'U' || cur === 'l' || cur === 'L') {
                this.advance(); // Skip suffix
                break;
              } else {
                break;
              }
            }
          }
          tokens.push(new Token(TokenType.NUMBER, numStr, startLine, startCol));
          continue;
        }

        // Strings: "..."
        if (ch === '"') {
          this.advance(); // skip opening quote
          let str = '';
          let escaped = false;
          while (this.pos < this.length) {
            const cur = this.peek();
            if (escaped) {
              if (cur === 'n') str += '\n';
              else if (cur === 't') str += '\t';
              else if (cur === 'r') str += '\r';
              else if (cur === '\\') str += '\\';
              else if (cur === '"') str += '"';
              else str += cur;
              this.advance();
              escaped = false;
            } else if (cur === '\\') {
              escaped = true;
              this.advance();
            } else if (cur === '"') {
              this.advance(); // skip closing quote
              break;
            } else if (cur === '\n') {
              this.diagnostics.push({ line: startLine, column: startCol, message: 'Unterminated string literal' });
              break;
            } else {
              str += this.advance();
            }
          }
          tokens.push(new Token(TokenType.STRING, str, startLine, startCol));
          continue;
        }

        // Characters: 'a'
        if (ch === "'") {
          this.advance(); // skip opening quote
          let charVal = '';
          if (this.peek() === '\\') {
            this.advance();
            const esc = this.advance();
            if (esc === 'n') charVal = '\n';
            else if (esc === 't') charVal = '\t';
            else if (esc === '0') charVal = '\0';
            else charVal = esc;
          } else {
            charVal = this.advance() || '';
          }
          if (this.peek() === "'") {
            this.advance();
          }
          tokens.push(new Token(TokenType.CHAR, charVal, startLine, startCol));
          continue;
        }

        // Identifiers and Keywords
        if (this.isAlpha(ch)) {
          let id = '';
          while (this.pos < this.length && this.isAlphaNumeric(this.peek())) {
            id += this.advance();
          }
          const type = KEYWORDS.has(id) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
          tokens.push(new Token(type, id, startLine, startCol));
          continue;
        }

        // Two-character operators
        const twoChar = ch + (this.peek(1) || '');
        if (TWO_CHAR_OPS.has(twoChar)) {
          this.advance();
          this.advance();
          tokens.push(new Token(TokenType.OPERATOR, twoChar, startLine, startCol));
          continue;
        }

        // One-character operators
        if (ONE_CHAR_OPS.has(ch)) {
          this.advance();
          tokens.push(new Token(TokenType.OPERATOR, ch, startLine, startCol));
          continue;
        }

        // Punctuations
        if (PUNCTUATIONS.has(ch)) {
          this.advance();
          tokens.push(new Token(TokenType.PUNCTUATION, ch, startLine, startCol));
          continue;
        }

        // Unknown character
        this.diagnostics.push({
          line: startLine,
          column: startCol,
          message: `Unexpected character: "${ch}"`
        });
        this.advance();
      }

      tokens.push(new Token(TokenType.EOF, '', this.line, this.column));
      return { tokens, diagnostics: this.diagnostics };
    }
  }

  return {
    TokenType,
    Token,
    Tokenizer,
    tokenize: (src, includeComments) => new Tokenizer(src).tokenize(includeComments)
  };
}));
