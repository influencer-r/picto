/**
 * PictoBlox C++ to Visual Blocks Web Application Controller
 * Handles UI interactions, split-screen resizing, CodeMirror editor,
 * Blockly workspace rendering, progress animations, and project exports.
 */

(function () {
  'use strict';

  // State
  let editor = null;
  let workspace = null;
  let isAutoConvert = true;
  let debounceTimer = null;
  let lastConvertedCode = '';
  let currentAst = null;
  let currentXml = '';
  let conversionStats = { blocks: 0, vars: 0, indices: 0 };

  // DOM Elements
  const elements = {
    editorContainer: document.getElementById('cppEditor'),
    blocklyArea: document.getElementById('blocklyArea'),
    blocklyDiv: document.getElementById('blocklyDiv'),
    sampleSelect: document.getElementById('sampleSelect'),
    btnConvert: document.getElementById('btnConvert'),
    btnAutoToggle: document.getElementById('btnAutoToggle'),
    btnBeautify: document.getElementById('btnBeautify'),
    btnClear: document.getElementById('btnClear'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnCenter: document.getElementById('btnCenter'),
    btnExportMenu: document.getElementById('btnExportMenu'),
    exportDropdown: document.getElementById('exportDropdown'),
    diagnosticList: document.getElementById('diagnosticList'),
    diagCountBadge: document.getElementById('diagCountBadge'),
    blockCountBadge: document.getElementById('blockCountBadge'),
    astTreeContainer: document.getElementById('astTreeContainer'),
    xmlPreviewContainer: document.getElementById('xmlPreviewContainer'),
    indexAuditContainer: document.getElementById('indexAuditContainer'),
    progressModal: document.getElementById('progressModal'),
    progressBar: document.getElementById('progressBar'),
    progressPercent: document.getElementById('progressPercent'),
    progressStepLabel: document.getElementById('progressStepLabel'),
    stepItems: document.querySelectorAll('.step-item'),
    toast: document.getElementById('toastNotification'),
    toastMessage: document.getElementById('toastMessage'),
    splitDivider: document.getElementById('splitDivider'),
    consoleToggle: document.getElementById('consoleToggle'),
    bottomConsole: document.getElementById('bottomConsole'),
    consoleTabs: document.querySelectorAll('.console-tab')
  };

  /**
   * Initialize Application
   */
  function init() {
    initCodeMirror();
    initBlockly();
    initSplitPane();
    initEventListeners();
    initSampleSelector();

    // Load initial sample (Blink)
    loadSample('blink');
  }

  /**
   * Initialize CodeMirror 5
   */
  function initCodeMirror() {
    editor = CodeMirror(elements.editorContainer, {
      mode: 'text/x-c++src',
      theme: 'dracula',
      lineNumbers: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      extraKeys: {
        'Ctrl-Enter': () => runConversion(true),
        'Cmd-Enter': () => runConversion(true)
      }
    });

    editor.on('change', () => {
      if (isAutoConvert) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          runConversion(false);
        }, 600);
      }
    });
  }

  /**
   * Initialize Blockly Workspace with PictoBlox configuration
   */
  function initBlockly() {
    if (typeof Blockly === 'undefined' || typeof PictoBloxBlocks === 'undefined') {
      console.error('Blockly or PictoBloxBlocks is missing');
      return;
    }

    // Register custom blocks
    PictoBloxBlocks.init(Blockly);

    // Create PictoBlox workspace theme
    const pictoTheme = Blockly.Theme.defineTheme('pictoblox_theme', {
      base: Blockly.Themes.Classic,
      categoryStyles: {
        pins_category: { colour: '#4C97FF' },
        time_category: { colour: '#5CB1D6' },
        sound_category: { colour: '#D65CD6' },
        serial_category: { colour: '#FF6680' },
        control_category: { colour: '#FFAB19' },
        logic_category: { colour: '#59C059' },
        math_category: { colour: '#4C97FF' },
        lists_category: { colour: '#FF661A' },
        variables_category: { colour: '#FF8C1A' },
        procedures_category: { colour: '#FF6680' }
      },
      componentStyles: {
        workspaceBackgroundColour: '#F9FAFB',
        toolboxBackgroundColour: '#FFFFFF',
        toolboxForegroundColour: '#334155',
        flyoutBackgroundColour: '#FFFFFF',
        flyoutForegroundColour: '#1E293B',
        flyoutOpacity: 0.95,
        scrollbarColour: '#CBD5E1',
        insertionMarkerColour: '#FFAB19',
        insertionMarkerOpacity: 0.6
      }
    });

    const toolboxXml = PictoBloxBlocks.getToolboxXml();

    workspace = Blockly.inject(elements.blocklyDiv, {
      toolbox: toolboxXml,
      theme: pictoTheme,
      renderer: 'geras',
      media: 'https://unpkg.com/blockly/media/',
      grid: {
        spacing: 24,
        length: 3,
        colour: '#E2E8F0',
        snap: true
      },
      zoom: {
        controls: false, // Custom toolbar buttons provided
        wheel: true,
        startScale: 0.88,
        maxScale: 2.2,
        minScale: 0.35,
        scaleSpeed: 1.1
      },
      trashcan: true,
      move: {
        scrollbars: {
          horizontal: true,
          vertical: true
        },
        drag: true,
        wheel: true
      }
    });

    // Handle window resize
    const onResize = () => {
      Blockly.svgResize(workspace);
    };
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 100);

    // Workspace change listener to update block count
    workspace.addChangeListener(() => {
      const count = workspace.getAllBlocks(false).length;
      if (elements.blockCountBadge) {
        elements.blockCountBadge.textContent = `${count} Blocks`;
      }
    });
  }

  /**
   * Split-pane drag to resize
   */
  function initSplitPane() {
    let isDragging = false;
    const divider = elements.splitDivider;
    const leftPane = document.getElementById('leftPane');
    const container = document.querySelector('.main-split-container');

    divider.addEventListener('mousedown', (e) => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const totalWidth = rect.width;
      let percent = (offsetX / totalWidth) * 100;
      percent = Math.max(20, Math.min(80, percent));

      leftPane.style.width = `${percent}%`;
      Blockly.svgResize(workspace);
      editor.refresh();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        Blockly.svgResize(workspace);
      }
    });
  }

  /**
   * Event Listeners
   */
  function initEventListeners() {
    // Convert button
    elements.btnConvert.addEventListener('click', () => {
      runConversion(true);
    });

    // Auto-convert toggle
    elements.btnAutoToggle.addEventListener('click', () => {
      isAutoConvert = !isAutoConvert;
      elements.btnAutoToggle.classList.toggle('active', isAutoConvert);
      showToast(isAutoConvert ? 'Auto-convert enabled' : 'Auto-convert paused (click Convert to update)');
    });

    // Beautify / Format C++ code
    elements.btnBeautify.addEventListener('click', () => {
      beautifyEditorCode();
    });

    // Clear code and canvas
    elements.btnClear.addEventListener('click', () => {
      if (confirm('Clear both C++ editor and Blockly canvas?')) {
        editor.setValue('');
        workspace.clear();
        clearDiagnostics();
        showToast('Workspace cleared');
      }
    });

    // Canvas zoom buttons
    elements.btnZoomIn.addEventListener('click', () => {
      workspace.zoomCenter(1);
    });
    elements.btnZoomOut.addEventListener('click', () => {
      workspace.zoomCenter(-1);
    });
    elements.btnCenter.addEventListener('click', () => {
      workspace.scrollCenter();
    });

    // Export Dropdown Toggle
    elements.btnExportMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.exportDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      elements.exportDropdown.classList.remove('open');
    });

    // Export Options
    document.getElementById('exportXmlBtn').addEventListener('click', () => {
      try {
        const exporter = new PictoBloxExporter.Exporter(workspace);
        exporter.exportXml('sketch_blocks.xml');
        showToast('Download Complete! Workspace exported as XML.');
      } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
      }
    });

    // Robust error-trapped PictoBlox .sb3 export using JSZip
    const attachExportHandler = (btn) => {
      if (!btn) return;
      btn.addEventListener('click', async function(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (elements.exportDropdown) {
          elements.exportDropdown.classList.remove('open');
        }

        try {
          // Verify JSZip is loaded
          const JSZipLib = (typeof JSZip !== 'undefined') ? JSZip
            : (typeof window !== 'undefined' && window.JSZip) ? window.JSZip
            : null;

          if (!JSZipLib) {
            alert("JSZip library is still loading. Please check your internet connection or try again in a moment.");
            return;
          }

          // Retrieve generated project JSON object/string
          const projectJson = getGeneratedProjectJson();

          const zip = new JSZipLib();
          // PictoBlox strictly requires the root logic file inside the .sb3 package to be 'project.json'
          zip.file("project.json", typeof projectJson === 'string' ? projectJson : JSON.stringify(projectJson, null, 2));

          // Embed required costume SVG assets so PictoBlox does not hang on purple loading screen
          if (typeof PictoBloxExporter !== 'undefined' && PictoBloxExporter.ASSETS) {
            zip.file(PictoBloxExporter.ASSETS.backdropMd5, PictoBloxExporter.ASSETS.backdropSvg);
            zip.file(PictoBloxExporter.ASSETS.arduinoMd5, PictoBloxExporter.ASSETS.arduinoSvg);
          }

          // Generate the blob
          const blob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
          });

          // Trigger browser download
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = "pictoblox_project.sb3";
          document.body.appendChild(a);
          a.click();

          // Cleanup
          setTimeout(() => {
            if (a.parentNode) {
              a.parentNode.removeChild(a);
            }
            window.URL.revokeObjectURL(url);
          }, 1500);

          showToast("Download Complete! Saved as pictoblox_project.sb3");

        } catch (err) {
          console.error("Export failed:", err);
          alert("Failed to export project: " + err.message);
        }
      });
    };

    attachExportHandler(document.getElementById('export-btn'));
    attachExportHandler(document.getElementById('exportSb3Dropdown'));
    attachExportHandler(document.getElementById('exportSb3Btn'));
    attachExportHandler(document.getElementById('exportJsonBtn'));

    document.getElementById('exportInoBtn').addEventListener('click', () => {
      try {
        const exporter = new PictoBloxExporter.Exporter(workspace);
        exporter.exportArduinoIno(editor.getValue(), 'sketch.ino');
        showToast('Download Complete! Arduino .ino sketch saved.');
      } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
      }
    });

    document.getElementById('exportSvgBtn').addEventListener('click', () => {
      try {
        const exporter = new PictoBloxExporter.Exporter(workspace);
        exporter.exportSvg('blocks_diagram.svg');
        showToast('Download Complete! Vector SVG exported.');
      } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
      }
    });

    document.getElementById('copyXmlBtn').addEventListener('click', () => {
      try {
        if (!currentXml) {
          const dom = Blockly.Xml.workspaceToDom(workspace);
          currentXml = Blockly.Xml.domToPrettyText(dom);
        }
        navigator.clipboard.writeText(currentXml);
        showToast('Blockly XML copied to clipboard!');
      } catch (err) {
        showToast('Copy failed: ' + err.message, 'error');
      }
    });

    // Diagnostic Console Toggle
    elements.consoleToggle.addEventListener('click', () => {
      elements.bottomConsole.classList.toggle('collapsed');
      const isCollapsed = elements.bottomConsole.classList.contains('collapsed');
      elements.consoleToggle.innerHTML = isCollapsed
        ? '<i class="fa-solid fa-chevron-up"></i> Show Diagnostics'
        : '<i class="fa-solid fa-chevron-down"></i> Hide Diagnostics';
      setTimeout(() => {
        Blockly.svgResize(workspace);
        editor.refresh();
      }, 200);
    });

    // Diagnostic Console Tabs
    elements.consoleTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.consoleTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-content-panel').forEach(panel => {
          panel.style.display = panel.id === targetId ? 'block' : 'none';
        });
      });
    });
  }

  /**
   * Retrieve generated PictoBlox / Scratch 3.0 project JSON schema
   */
  function getGeneratedProjectJson() {
    if (workspace && typeof PictoBloxExporter !== 'undefined') {
      try {
        const exporter = new PictoBloxExporter.Exporter(workspace);
        return exporter.getProjectJson();
      } catch (err) {
        console.warn('Exporter getProjectJson warning:', err);
      }
    }
    // Safe fallback schema
    return {
      targets: [
        {
          isStage: true,
          name: "Stage",
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: {},
          comments: {},
          currentCostume: 0,
          costumes: [{
            name: "backdrop1",
            dataFormat: "svg",
            assetId: "cd21514d0531fdffb22204e0ec5ed84a",
            md5ext: "cd21514d0531fdffb22204e0ec5ed84a.svg",
            rotationCenterX: 240,
            rotationCenterY: 180
          }],
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
          blocks: {},
          comments: {},
          currentCostume: 0,
          costumes: [{
            name: "arduino",
            dataFormat: "svg",
            assetId: "0fb9be3e8397c772915c9de80f31481f",
            md5ext: "0fb9be3e8397c772915c9de80f31481f.svg",
            rotationCenterX: 48,
            rotationCenterY: 50
          }],
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
      extensions: ["arduinoUno"],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "PictoBlox Web Converter" }
    };
  }

  /**
   * Export PictoBlox Project (.sb3) using JSZip
   * Packages project.json and default costume assets inside a valid ZIP archive structure
   * with MIME type application/x.scratch.sb3 so PictoBlox unzips and reads project.json
   * automatically upon load without hanging on the purple loading screen.
   */
  async function exportPictoBloxSb3(filename = 'my_pictoblox_project.sb3') {
    if (!workspace) {
      throw new Error('Workspace is not initialized');
    }

    // 1. Generate standard PictoBlox / Scratch 3.0 project schema
    const exporter = new PictoBloxExporter.Exporter(workspace);
    const projectData = exporter.getProjectJson();
    const jsonString = JSON.stringify(projectData, null, 2);

    // 2. Resolve JSZip library instance
    const JSZipConstructor = (typeof JSZip !== 'undefined') ? JSZip
      : (typeof window !== 'undefined' && window.JSZip) ? window.JSZip
      : null;

    if (!JSZipConstructor) {
      throw new Error('JSZip library is missing. Please ensure jszip.min.js is included.');
    }

    // 3. Package project.json and standard costume assets inside a valid ZIP archive structure
    const zip = new JSZipConstructor();
    zip.file('project.json', jsonString);

    // Embed default SVG costume assets so PictoBlox never gets stuck on purple loading screen
    if (typeof PictoBloxExporter !== 'undefined' && PictoBloxExporter.ASSETS) {
      zip.file(PictoBloxExporter.ASSETS.backdropMd5, PictoBloxExporter.ASSETS.backdropSvg);
      zip.file(PictoBloxExporter.ASSETS.arduinoMd5, PictoBloxExporter.ASSETS.arduinoSvg);
    } else {
      zip.file('cd21514d0531fdffb22204e0ec5ed84a.svg', '<svg version="1.1" width="480" height="360" viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="360" fill="#ffffff"/></svg>');
      zip.file('0fb9be3e8397c772915c9de80f31481f.svg', '<svg version="1.1" width="96" height="100" viewBox="0 0 96 100" xmlns="http://www.w3.org/2000/svg"><rect width="96" height="100" rx="8" fill="#00979C"/><text x="48" y="55" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">Arduino</text></svg>');
    }

    // 4. Generate the ZIP archive blob with application/x.scratch.sb3 MIME type
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: 'application/x.scratch.sb3'
    });

    // 5. Force download to trigger with .sb3 file extension
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.sb3') ? filename : `${filename}.sb3`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);

    return zipBlob;
  }

  /**
   * Sample Selector
   */
  function initSampleSelector() {
    if (!elements.sampleSelect || typeof CppSamples === 'undefined') return;

    elements.sampleSelect.innerHTML = '';
    for (const [key, sample] of Object.entries(CppSamples.SAMPLES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = sample.name;
      elements.sampleSelect.appendChild(opt);
    }

    elements.sampleSelect.addEventListener('change', (e) => {
      loadSample(e.target.value);
    });
  }

  function loadSample(key) {
    if (typeof CppSamples === 'undefined') return;
    const code = CppSamples.getSample(key);
    if (code && editor) {
      editor.setValue(code);
      runConversion(true);
    }
  }

  /**
   * Format / Beautify C++ code indentation
   */
  function beautifyEditorCode() {
    const code = editor.getValue();
    const lines = code.split('\n');
    let indent = 0;
    const formatted = [];

    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) {
        formatted.push('');
        continue;
      }

      if (trimmed.startsWith('}')) {
        indent = Math.max(0, indent - 1);
      }

      formatted.push('  '.repeat(indent) + trimmed);

      // Check if opens a block
      if (trimmed.endsWith('{')) {
        indent++;
      }
    }

    editor.setValue(formatted.join('\n'));
    showToast('Code beautified');
  }

  /**
   * Core Conversion Pipeline
   */
  function runConversion(showModal = false) {
    const code = editor.getValue();
    if (!code.trim()) {
      workspace.clear();
      clearDiagnostics();
      return;
    }

    if (showModal) {
      showProgressModal();
    }

    updateStep(1, 25, 'Tokenizing C++ Source...');

    setTimeout(() => {
      try {
        // 1. Lexical Tokenization
        const { tokens, diagnostics: tokenDiags } = CppTokenizer.tokenize(code);

        updateStep(2, 50, 'Parsing Abstract Syntax Tree (AST)...');

        // 2. Syntax AST Parsing
        const ast = CppParser.parse(tokens);
        currentAst = ast;

        const allDiags = [...tokenDiags, ...(ast.diagnostics || [])];

        updateStep(3, 75, 'Mapping PictoBlox Schemas & 1-based indexing...');

        // 3. Schema mapping & 0-to-1 index transformation
        const result = AstToBlockly.convertToBlocklyXml(ast);
        currentXml = result.xml;
        conversionStats = result.stats;

        updateStep(4, 90, 'Rendering Visual Workspace Canvas...');

        // 4. Render into Blockly Workspace
        renderToWorkspace(result.xml);

        // Update diagnostic UI
        renderDiagnostics(allDiags, result.warnings, result.stats);
        renderAstTree(ast);
        renderXmlPreview(result.xml);
        renderIndexAudit(result.stats);

        lastConvertedCode = code;

        updateStep(4, 100, 'Conversion Complete! Ready.');

        setTimeout(() => {
          if (showModal) {
            hideProgressModal();
            showToast('Code converted to PictoBlox blocks!');
          }
        }, 300);

      } catch (err) {
        console.error('Conversion error:', err);
        hideProgressModal();
        renderDiagnostics([{
          line: 1,
          column: 1,
          message: 'Conversion failed: ' + err.message,
          severity: 'error'
        }], [], { blocksGenerated: 0 });
        showToast('Error parsing C++ code: ' + err.message, 'error');
      }
    }, showModal ? 120 : 10);
  }

  /**
   * Render Blockly XML into Workspace
   */
  function renderToWorkspace(xmlString) {
    if (!workspace || typeof Blockly === 'undefined') return;

    try {
      const xmlDoc = Blockly.utils.xml.textToDom(xmlString);
      Blockly.Events.disable();
      workspace.clear();
      Blockly.Xml.domToWorkspace(xmlDoc, workspace);
      Blockly.Events.enable();

      Blockly.svgResize(workspace);
      workspace.scrollCenter();

      const count = workspace.getAllBlocks(false).length;
      if (elements.blockCountBadge) {
        elements.blockCountBadge.textContent = `${count} Blocks`;
      }
    } catch (err) {
      console.warn('Blockly DOM load warning:', err);
    }
  }

  /**
   * Diagnostics Console Rendering
   */
  function renderDiagnostics(diagnostics, warnings, stats) {
    elements.diagnosticList.innerHTML = '';
    const totalIssues = (diagnostics ? diagnostics.length : 0) + (warnings ? warnings.length : 0);

    if (elements.diagCountBadge) {
      elements.diagCountBadge.textContent = `${totalIssues} Issues`;
      elements.diagCountBadge.className = totalIssues === 0 ? 'badge badge-success' : 'badge badge-warning';
    }

    if (totalIssues === 0) {
      const okDiv = document.createElement('div');
      okDiv.className = 'diag-item diag-success';
      okDiv.innerHTML = `
        <i class="fa-solid fa-circle-check"></i>
        <div class="diag-content">
          <strong>Syntax Clean:</strong> No syntax warnings. ${stats ? stats.blocksGenerated : 0} visual blocks created.
        </div>
      `;
      elements.diagnosticList.appendChild(okDiv);
      return;
    }

    if (diagnostics) {
      for (const diag of diagnostics) {
        const item = document.createElement('div');
        item.className = `diag-item diag-${diag.severity || 'error'}`;
        item.innerHTML = `
          <i class="fa-solid fa-circle-exclamation"></i>
          <div class="diag-content">
            <span class="diag-line">Line ${diag.line || 1}:${diag.column || 1}</span>
            <span class="diag-msg">${escapeHtml(diag.message)}</span>
          </div>
        `;
        item.addEventListener('click', () => {
          if (diag.line && editor) {
            editor.setCursor({ line: diag.line - 1, ch: (diag.column || 1) - 1 });
            editor.focus();
          }
        });
        elements.diagnosticList.appendChild(item);
      }
    }

    if (warnings) {
      for (const warn of warnings) {
        const item = document.createElement('div');
        item.className = 'diag-item diag-warning';
        item.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div class="diag-content">
            <span class="diag-msg">${escapeHtml(warn)}</span>
          </div>
        `;
        elements.diagnosticList.appendChild(item);
      }
    }
  }

  function clearDiagnostics() {
    elements.diagnosticList.innerHTML = '<div class="diag-empty">No active code to diagnose.</div>';
    if (elements.diagCountBadge) {
      elements.diagCountBadge.textContent = '0 Issues';
      elements.diagCountBadge.className = 'badge badge-neutral';
    }
  }

  function renderAstTree(ast) {
    if (!elements.astTreeContainer) return;
    elements.astTreeContainer.textContent = JSON.stringify(ast, null, 2);
  }

  function renderXmlPreview(xml) {
    if (!elements.xmlPreviewContainer) return;
    elements.xmlPreviewContainer.textContent = xml;
  }

  function renderIndexAudit(stats) {
    if (!elements.indexAuditContainer) return;
    elements.indexAuditContainer.innerHTML = `
      <div class="index-audit-card">
        <h4><i class="fa-solid fa-arrows-split-up-and-left"></i> Indexing Conversion Summary</h4>
        <p>PictoBlox / Scratch lists use <strong>1-based indexing</strong>, whereas standard C++ arrays use <strong>0-based indexing</strong>.</p>
        <div class="audit-stat-row">
          <div class="audit-stat">
            <span class="stat-num">${stats ? stats.indexedConversions : 0}</span>
            <span class="stat-label">Array Accesses Converted</span>
          </div>
          <div class="audit-stat">
            <span class="stat-num">${stats ? stats.variablesRegistered : 0}</span>
            <span class="stat-label">Variables &amp; Lists Registered</span>
          </div>
          <div class="audit-stat">
            <span class="stat-num">${stats ? stats.blocksGenerated : 0}</span>
            <span class="stat-label">Total Blocks Mapped</span>
          </div>
        </div>
        <div class="audit-rules-box">
          <strong>Rule 1:</strong> Literal constant index <code>arr[0]</code> &rarr; PictoBlox list <code>item 1 of arr</code><br/>
          <strong>Rule 2:</strong> Variable index <code>arr[i]</code> &rarr; PictoBlox list <code>item (i + 1) of arr</code><br/>
          <strong>Rule 3:</strong> Assignment <code>arr[i] = x</code> &rarr; PictoBlox list <code>replace item (i + 1) of arr with x</code>
        </div>
      </div>
    `;
  }

  /**
   * Progress Modal Helpers
   */
  function showProgressModal() {
    elements.progressModal.classList.add('visible');
    updateStep(1, 10, 'Initializing conversion engine...');
  }

  function hideProgressModal() {
    elements.progressModal.classList.remove('visible');
  }

  function updateStep(stepNum, percent, label) {
    if (elements.progressBar) {
      elements.progressBar.style.width = `${percent}%`;
    }
    if (elements.progressPercent) {
      elements.progressPercent.textContent = `${percent}%`;
    }
    if (elements.progressStepLabel) {
      elements.progressStepLabel.textContent = label;
    }

    elements.stepItems.forEach((item, idx) => {
      const num = idx + 1;
      item.classList.remove('active', 'completed');
      if (num < stepNum) {
        item.classList.add('completed');
      } else if (num === stepNum) {
        item.classList.add('active');
      }
    });
  }

  /**
   * Toast Banner Notification
   */
  let toastTimer = null;
  function showToast(message, type = 'success') {
    if (!elements.toast) return;
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast-banner toast-${type} visible`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toast.classList.remove('visible');
    }, 3800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
