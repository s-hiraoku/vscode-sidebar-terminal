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
      focus: () => {},
      blur: () => {},
      dispose: () => {},
      open: () => {},
      onData: () => ({ dispose: () => {} }),
      onResize: () => ({ dispose: () => {} }),
      onKey: () => ({ dispose: () => {} }),
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

// Module.prototype.requireをハイジャックしてxterm.jsをモック
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  // xterm関連のすべてのrequireをインターセプト
  if (
    id === '@xterm/xterm' ||
    id === 'xterm' ||
    id === '@xterm/addon-fit' ||
    id === 'xterm-addon-fit' ||
    id === '@xterm/addon-web-links' ||
    id === '@xterm/addon-search' ||
    id === '@xterm/addon-webgl' ||
    id === '@xterm/addon-unicode11' ||
    id === '@xterm/addon-serialize' ||
    id.startsWith('@xterm/') ||
    (id.includes('xterm') && !id.includes('node_modules') && !id.includes('test'))
  ) {
    return xtermMock;
  }

  // package.jsonからの相対パスでxterm.jsを参照する場合も対応
  if (id.includes('node_modules/@xterm') || id.includes('node_modules/xterm')) {
    return xtermMock;
  }

  // その他のモジュールは元のrequireに委譲
  return originalRequire.apply(this, arguments);
};

// Suppress log in test environment
if (process.env.NODE_ENV !== 'test') {
  console.log('✅ xterm.js mock loaded successfully');
}
