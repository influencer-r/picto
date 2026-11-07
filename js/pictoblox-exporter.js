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

  // Default costume assets required by Scratch 3.0 / PictoBlox
  // Having these in the .sb3 prevents PictoBlox from hanging on the purple loading screen!
  const ASSETS = {
    backdropSvg: '<svg version="1.1" width="480" height="360" viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="480" height="360" fill="#ffffff"/></svg>',
    backdropMd5: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    backdropId: 'cd21514d0531fdffb22204e0ec5ed84a',

    arduinoSvg: '<svg version="1.1" width="96" height="100" viewBox="0 0 96 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="96" height="100" rx="8" fill="#00979C"/><text x="48" y="55" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">Arduino</text></svg>',
    arduinoMd5: '0fb9be3e8397c772915c9de80f31481f.svg',
    arduinoId: '0fb9be3e8397c772915c9de80f31481f'
  };

  function triggerDownloadBlob(blob, filename) {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    a.style.top = '-9999px';
    a.style.opacity = '0';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);

    try {
      const evt = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      a.dispatchEvent(evt);
    } catch (e) {
      a.click();
    }

    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1500);
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
     * Fully populated with targets, costumes, and block mappings
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
            costumes: [
              {
                name: "backdrop1",
                dataFormat: "svg",
                assetId: ASSETS.backdropId,
                md5ext: ASSETS.backdropMd5,
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
            blocks: blocksMap,
            comments: {},
            currentCostume: 0,
            costumes: [
              {
                name: "arduino",
                dataFormat: "svg",
                assetId: ASSETS.arduinoId,
                md5ext: ASSETS.arduinoMd5,
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
     * Export as valid PictoBlox .sb3 package (ZIP archive containing project.json and costume assets)
     * PictoBlox's file dialog specifically looks for .sb3 files.
     */
    async exportPictoBloxSb3(filename = 'my_pictoblox_project.sb3') {
      const projectObj = this.getProjectJson();
      const jsonStr = JSON.stringify(projectObj, null, 2);

      // Check if JSZip is available in browser
      const JSZipLib = (typeof JSZip !== 'undefined') ? JSZip
        : (typeof window !== 'undefined' && window.JSZip) ? window.JSZip
        : null;

      if (!JSZipLib) {
        throw new Error('JSZip library is not loaded. Please ensure JSZip CDN is included in index.html');
      }

      const zip = new JSZipLib();
      // 1. Bundle project.json inside ZIP root
      zip.file('project.json', jsonStr);

      // 2. Include standard SVG costume assets so PictoBlox doesn't get stuck on purple loading screen
      zip.file(ASSETS.backdropMd5, ASSETS.backdropSvg);
      zip.file(ASSETS.arduinoMd5, ASSETS.arduinoSvg);

      // 3. Generate binary ZIP archive with official .sb3 MIME type
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        mimeType: 'application/x.scratch.sb3'
      });

      const finalName = filename.endsWith('.sb3') ? filename : `${filename}.sb3`;
      triggerDownloadBlob(blob, finalName);
      return blob;
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
    ASSETS,
    triggerDownload,
    triggerDownloadBlob
  };
}));
