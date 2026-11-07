/**
 * PictoBlox / Blockly Project Exporter
 * Generates valid PictoBlox-compatible JSON and XML project schemas,
 * Arduino .ino files, and SVG visual block representations.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PictoBloxExporter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function triggerDownload(content, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  class Exporter {
    constructor(workspace) {
      this.workspace = workspace;
    }

    /**
     * Export Blockly Workspace XML (.xml)
     */
    exportXml(filename = 'pictoblox_sketch.xml') {
      if (!this.workspace || typeof Blockly === 'undefined') {
        throw new Error('Workspace is not initialized');
      }
      const dom = Blockly.Xml.workspaceToDom(this.workspace);
      const xmlText = Blockly.Xml.domToPrettyText(dom);
      triggerDownload(xmlText, filename, 'application/xml');
      return xmlText;
    }

    /**
     * Export PictoBlox Project Schema (.json)
     * Compatible with PictoBlox / Scratch 3.0 project format
     */
    exportPictoBloxJson(filename = 'pictoblox_project.json') {
      if (!this.workspace || typeof Blockly === 'undefined') {
        throw new Error('Workspace is not initialized');
      }

      const allBlocks = this.workspace.getAllBlocks(false);
      const allVariables = this.workspace.getAllVariables();

      const variablesMap = {};
      const listsMap = {};

      for (const v of allVariables) {
        if (v.type === 'list') {
          listsMap[v.getId()] = [v.name, []];
        } else {
          variablesMap[v.getId()] = [v.name, 0];
        }
      }

      // Build Scratch 3 / PictoBlox block schema
      const blocksMap = {};
      for (const b of allBlocks) {
        const id = b.id;
        const parent = b.getParent();
        const next = b.getNextBlock();

        blocksMap[id] = {
          opcode: b.type,
          next: next ? next.id : null,
          parent: parent ? parent.id : null,
          inputs: {},
          fields: {},
          shadow: false,
          topLevel: !parent,
          x: !parent ? (b.getRelativeToSurfaceXY ? b.getRelativeToSurfaceXY().x : 50) : undefined,
          y: !parent ? (b.getRelativeToSurfaceXY ? b.getRelativeToSurfaceXY().y : 50) : undefined
        };

        // Populate fields
        for (const input of b.inputList) {
          for (const field of input.fieldRow) {
            if (field.name) {
              blocksMap[id].fields[field.name] = [field.getValue(), null];
            }
          }
        }
      }

      const projectJson = {
        targets: [
          {
            isStage: true,
            name: "Stage",
            variables: variablesMap,
            lists: listsMap,
            broadcasts: {},
            blocks: {},
            comments: {},
            currentCostume: 0,
            costumes: [],
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
            blocks: blocksMap,
            comments: {},
            currentCostume: 0,
            costumes: [],
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
        extensions: [
          "arduinoUno",
          "evive"
        ],
        meta: {
          semver: "3.0.0",
          vm: "0.2.0",
          agent: "PictoBlox Web Converter v1.0",
          platform: {
            name: "PictoBlox / Blockly",
            url: "https://thestempedia.com/product/pictoblox/"
          }
        }
      };

      const jsonStr = JSON.stringify(projectJson, null, 2);
      triggerDownload(jsonStr, filename, 'application/json');
      return jsonStr;
    }

    /**
     * Export Arduino .ino file
     */
    exportArduinoIno(cppCode, filename = 'sketch.ino') {
      triggerDownload(cppCode || '// Arduino C++ Sketch\nvoid setup() {}\nvoid loop() {}\n', filename, 'text/x-c');
    }

    /**
     * Export Blockly Workspace as SVG image
     */
    exportSvg(filename = 'pictoblox_blocks.svg') {
      if (!this.workspace || typeof Blockly === 'undefined') {
        throw new Error('Workspace is not initialized');
      }

      const canvas = this.workspace.getCanvas();
      if (!canvas) return;

      const svg = canvas.cloneNode(true);
      const bbox = canvas.getBBox();

      const svgDoc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgDoc.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgDoc.setAttribute('version', '1.1');
      svgDoc.setAttribute('width', (bbox.width + 40).toString());
      svgDoc.setAttribute('height', (bbox.height + 40).toString());
      svgDoc.setAttribute('viewBox', `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);

      // Add styles
      const styleEl = document.createElement('style');
      styleEl.textContent = `
        .blocklyText { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 12pt; fill: #fff; font-weight: bold; }
        .blocklyNonEditableText>text { fill: #fff; }
        .blocklyEditableText>text { fill: #000; }
        .blocklyDropdownText { fill: #fff !important; }
      `;
      svgDoc.appendChild(styleEl);
      svgDoc.appendChild(svg);

      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgDoc);

      triggerDownload(source, filename, 'image/svg+xml;charset=utf-8');
    }
  }

  return {
    Exporter,
    triggerDownload
  };
}));
