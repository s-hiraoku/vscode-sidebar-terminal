/**
 * xterm.js モックモジュール
 * テスト実行時にxterm.jsのCanvas依存を回避するためのモック
 *
 * このファイルは --require オプションで最初に読み込まれ、
 * 実際のxterm.jsが読み込まれる前にモジュールキャッシュに登録されます
 */

// HTMLCanvasElementのモックを最優先で設定
if (typeof global.HTMLCanvasElement === 'undefined') {
  global.HTMLCanvasElement = class MockHTMLCanvasElement {
    constructor() {
      this.width = 300;
      this.height = 150;
    }

    getContext(contextType) {
      if (contextType === '2d') {
        return {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          fillRect: () => {},
          strokeRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          closePath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          fillText: () => {},
          strokeText: () => {},
          measureText: () => ({ width: 0 }),
          save: () => {},
          restore: () => {},
          scale: () => {},
          rotate: () => {},
          translate: () => {},
          transform: () => {},
          setTransform: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          createPattern: () => null,
          getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
          putImageData: () => {},
          drawImage: () => {},
          canvas: this,
        };
      }
      return null;
    }

    toDataURL() {
      return 'data:,';
    }

    toBlob() {}

    getBoundingClientRect() {
      return {
        width: this.width,
        height: this.height,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: this.width,
        bottom: this.height,
      };
    }
  };
}

// xterm.jsモックオブジェクト
const xtermMock = {
  Terminal: function () {
    return {
      write: () => {},
      writeln: () => {},
      clear: () => {},
      resize: () => {},
      refresh: () => {}, // For triggering re-renders
      reset: () => {},
      scrollToBottom: () => {},
      scrollToTop: () => {},
      scrollLines: () => {},
      scrollPages: () => {},
      scrollToLine: () => {},
      select: () => {},
      selectAll: () => {},
      selectLines: () => {},
      clearSelection: () => {},
      hasSelection: () => false,
      getSelection: () => '',
      getSelectionPosition: () => undefined,
      paste: () => {},
      focus: () => {},
      blur: () => {},
      dispose: () => {},
      open: () => {},
      attachCustomKeyEventHandler: () => {},
      registerLinkMatcher: () => 0,
      deregisterLinkMatcher: () => {},
      registerLinkProvider: () => ({ dispose: () => {} }),
      registerCharacterJoiner: () => 0,
      deregisterCharacterJoiner: () => {},
      registerMarker: () => ({ dispose: () => {}, line: 0, isDisposed: false }),
      registerDecoration: () => ({ dispose: () => {}, marker: { line: 0, isDisposed: false }, element: null, isDisposed: false }),
      onData: () => ({ dispose: () => {} }),
      onBinary: () => ({ dispose: () => {} }),
      onResize: () => ({ dispose: () => {} }),
      onKey: () => ({ dispose: () => {} }),
      onTitleChange: () => ({ dispose: () => {} }),
      onSelectionChange: () => ({ dispose: () => {} }),
      onScroll: () => ({ dispose: () => {} }),
      onRender: () => ({ dispose: () => {} }),
      onLineFeed: () => ({ dispose: () => {} }),
      onBell: () => ({ dispose: () => {} }),
      onCursorMove: () => ({ dispose: () => {} }),
      onWriteParsed: () => ({ dispose: () => {} }),
      loadAddon: () => {},
      options: {},
      rows: 24,
      cols: 80,
      element: null,
      textarea: null,
      buffer: {
        active: {
          length: 100,
          viewportY: 50,
          baseY: 0,
          cursorY: 0,
          cursorX: 0,
          getLine: () => ({ translateToString: () => '' }),
        },
        normal: {
          length: 100,
          viewportY: 50,
          baseY: 0,
          cursorY: 0,
          cursorX: 0,
          getLine: () => ({ translateToString: () => '' }),
        },
      },
      parser: {
        registerCsiHandler: () => ({ dispose: () => {} }),
        registerDcsHandler: () => ({ dispose: () => {} }),
        registerEscHandler: () => ({ dispose: () => {} }),
        registerOscHandler: () => ({ dispose: () => {} }),
      },
      unicode: {
        activeVersion: '11',
      },
      modes: {
        applicationCursorKeysMode: false,
        applicationKeypadMode: false,
      },
    };
  },
  FitAddon: function () {
    return {
      fit: () => {},
      dispose: () => {},
      proposeDimensions: () => ({ cols: 80, rows: 24 }),
    };
  },
  WebLinksAddon: function () {
    return { dispose: () => {} };
  },
  SearchAddon: function () {
    return { dispose: () => {}, findNext: () => {}, findPrevious: () => {} };
  },
  WebglAddon: function () {
    return { dispose: () => {} };
  },
  Unicode11Addon: function () {
    return { dispose: () => {} };
  },
  SerializeAddon: function () {
    return { dispose: () => {}, serialize: () => '' };
  },
};

// xterm.jsモジュールをモックするためにrequire.cacheを直接設定
// (Module.prototype.requireをハイジャックするとnyc coverage instrumentationが壊れるため)
const Module = require('module');
const path = require('path');

// xtermモジュール名のリスト
const xtermModules = [
  '@xterm/xterm',
  'xterm',
  '@xterm/addon-fit',
  'xterm-addon-fit',
  '@xterm/addon-web-links',
  '@xterm/addon-search',
  '@xterm/addon-webgl',
  '@xterm/addon-unicode11',
  '@xterm/addon-serialize',
];

// 各モジュールのキャッシュに直接登録
xtermModules.forEach((moduleName) => {
  try {
    // モジュールパスを解決してキャッシュに登録
    const possiblePaths = [
      moduleName,
      path.join(process.cwd(), 'node_modules', moduleName),
    ];

    possiblePaths.forEach((modulePath) => {
      try {
        const resolvedPath = require.resolve(modulePath);
        require.cache[resolvedPath] = {
          id: resolvedPath,
          filename: resolvedPath,
          loaded: true,
          exports: xtermMock,
        };
      } catch (e) {
        // モジュールが見つからない場合は無視
      }
    });
  } catch (e) {
    // 無視
  }
});

console.log('✅ xterm.js mock loaded successfully');
