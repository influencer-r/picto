/**
 * PictoBlox / Blockly Project Exporter
 * Generates valid PictoBlox .sb3 packages, JSON/XML schemas,
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

  function triggerDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  }

  function triggerDownload(content, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([content], { type: mimeType });
    triggerDownloadBlob(blob, filename);
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
     * Generate Scratch 3.0 / PictoBlox project.json object
     */
    getProjectJson() {
      if (!this.workspace) {
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
          x: !parent ? (b.getRelativeToSurfaceXY ? Math.round(b.getRelativeToSurfaceXY().x) : 50) : undefined,
          y: !parent ? (b.getRelativeToSurfaceXY ? Math.round(b.getRelativeToSurfaceXY().y) : 50) : undefined
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

      return {
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
    }

    /**
     * Export as valid PictoBlox .sb3 package (ZIP archive containing project.json)
     * PictoBlox's file dialog specifically looks for .sb3 files.
     */
    async exportPictoBloxSb3(filename = 'pictoblox_project.sb3') {
      const projectObj = this.getProjectJson();
      const jsonStr = JSON.stringify(projectObj, null, 2);

      // Check if JSZip is available in browser
      const JSZipLib = (typeof JSZip !== 'undefined') ? JSZip
        : (typeof window !== 'undefined' && window.JSZip) ? window.JSZip
        : null;

      if (JSZipLib) {
        const zip = new JSZipLib();
        zip.file('project.json', jsonStr);

        const blob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
          mimeType: 'application/x.scratch.sb3'
        });

        triggerDownloadBlob(blob, filename);
        return blob;
      } else {
        // Fallback: save directly with .sb3 extension and mime type
        const blob = new Blob([jsonStr], { type: 'application/x.scratch.sb3' });
        triggerDownloadBlob(blob, filename);
        return blob;
      }
    }

    /**
     * Export PictoBlox Project Schema (.json)
     */
    exportPictoBloxJson(filename = 'pictoblox_project.json') {
      const projectJson = this.getProjectJson();
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
    triggerDownload,
    triggerDownloadBlob
  };
}));
