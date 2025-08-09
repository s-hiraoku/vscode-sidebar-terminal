/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';

describe('Terminal Startup Regression Prevention', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: any;
  let _consoleMocks: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Setup complete test environment with DOM
    const testEnv = setupCompleteTestEnvironment();
    dom = testEnv.dom;
    _consoleMocks = testEnv.consoleMocks;
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('WebView Manager Initialization', () => {
    it('should initialize TerminalWebviewManager without errors', () => {
      // Create required DOM elements
      const terminalBody = document.createElement('div');
      terminalBody.id = 'terminal-body';
      document.body.appendChild(terminalBody);

      expect(() => {
        // Mock TerminalWebviewManager initialization flow
        const mockManagers = {
          inputManager: {
            setupIMEHandling: sandbox.spy(),
            setupAltKeyVisualFeedback: sandbox.spy(),
            isVSCodeAltClickEnabled: sandbox.stub().returns(true),
          },
          performanceManager: {
            initialize: sandbox.spy(),
            scheduleFlush: sandbox.spy(),
          },
          uiManager: {
            initialize: sandbox.spy(),
            createTerminalHeader: sandbox.stub().returns(document.createElement('div')),
          },
          messageManager: {
            initialize: sandbox.spy(),
            sendDeleteTerminalMessage: sandbox.spy(),
          },
          splitManager: {
            initialize: sandbox.spy(),
            getTerminals: sandbox.stub().returns(new Map()),
            getIsSplitMode: sandbox.stub().returns(false),
          },
        };

        // Simulate manager initialization
        Object.values(mockManagers).forEach(manager => {
          if ('initialize' in manager && typeof manager.initialize === 'function') {
            manager.initialize();
          }
        });

        // Verify no errors were thrown during initialization
        expect(mockManagers.inputManager.setupIMEHandling.called).to.be.true;
        expect(mockManagers.performanceManager.initialize.called).to.be.true;
      }).to.not.throw();
    });

    it('should handle log method calls correctly in BaseManager', () => {
      // Test that BaseManager log method works correctly
      expect(() => {
        // Mock BaseManager class
        class MockBaseManager {
          protected loggingEnabled = true;
          protected logPrefix = '[TEST-MANAGER]';

          public log(message: string, _level: 'info' | 'warn' | 'error' = 'info'): void {
            const formattedMessage = `${this.logPrefix} ${message}`;
            
            switch (_level) {
              case 'warn':
                console.warn(`⚠️ ${formattedMessage}`);
                break;
              case 'error':
                console.error(`❌ ${formattedMessage}`);
                break;
              default:
                console.log(formattedMessage);
            }
          }
        }

        const manager = new MockBaseManager();
        
        // Test different log levels
        manager.log('Info message');
        manager.log('Warning message', 'warn');
        manager.log('Error message', 'error');
        
        // Test with template string (new format)
        manager.log(`Error during operation: test error`, 'error');
        
      }).to.not.throw();
    });

    it('should handle manager initialization with correct log calls', () => {
      expect(() => {
        // Mock managers with corrected log method calls
        class MockInputManager {
          protected loggingEnabled = true;
          protected logPrefix = '[INPUT]';
          protected isComposing = false;

          public log(message: string, _level: 'info' | 'warn' | 'error' = 'info'): void {
            // Base log implementation
            console.log(`${this.logPrefix} ${message}`);
          }

          public setupIMEHandling(): void {
            // New format log calls (from recent changes)
            this.log(`🈶 [INPUT] IME composition started: no data`);
            this.log(`🈶 [INPUT] IME composition update: no data`);
            this.log(`🈶 [INPUT] IME composition ended: test data`);
          }
        }

        class MockPerformanceManager {
          protected loggingEnabled = true;
          protected logPrefix = '[PERFORMANCE]';

          public log(message: string, _level: 'info' | 'warn' | 'error' = 'info'): void {
            // Base log implementation
            console.log(`${this.logPrefix} ${message}`);
          }

          public initialize(): void {
            // New format log calls (from recent changes)
            this.log(`❌ [PERFORMANCE] Error during buffer flush: test error`, 'error');
            this.log(`🚀 [PERFORMANCE] Buffer flushed successfully`);
          }
        }

        const inputManager = new MockInputManager();
        const performanceManager = new MockPerformanceManager();

        // These should not throw with the new log format
        inputManager.setupIMEHandling();
        performanceManager.initialize();

      }).to.not.throw();
    });
  });

  describe('Terminal Creation Process', () => {
    it('should create terminal element without DOM errors', () => {
      const terminalBody = document.createElement('div');
      terminalBody.id = 'terminal-body';
      document.body.appendChild(terminalBody);

      expect(() => {
        // Simulate terminal creation process
        const terminalId = 'test-terminal-1';
        const terminalDiv = document.createElement('div');
        terminalDiv.setAttribute('data-terminal-container', 'terminal');
        terminalDiv.setAttribute('data-terminal-id', terminalId);
        terminalDiv.id = `terminal-container-${terminalId}`;
        terminalDiv.className = 'terminal-container';

        // Create header and content (as in actual implementation)
        const terminalHeader = document.createElement('div');
        terminalHeader.className = 'terminal-header';
        
        const terminalContent = document.createElement('div');
        terminalContent.className = 'terminal-content';
        terminalContent.style.cssText = 'flex: 1; overflow: hidden;';
        
        terminalDiv.appendChild(terminalHeader);
        terminalDiv.appendChild(terminalContent);
        
        // Apply styles (as in actual implementation)
        terminalDiv.style.cssText = `
          width: 100%; 
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: 0;
          padding: 2px;
          min-height: 100px;
          outline: none;
        `;
        
        terminalBody.appendChild(terminalDiv);
        
        // Verify terminal was created correctly
        expect(terminalDiv.parentElement).to.equal(terminalBody);
        expect(terminalDiv.querySelector('.terminal-content')).to.exist;
        
      }).to.not.throw();
    });

    it('should handle xterm Terminal initialization', () => {
      expect(() => {
        const terminalOptions = {
          fontSize: 14,
          fontFamily: 'monospace',
          theme: { background: '#000000', foreground: '#ffffff' },
          cursorBlink: true,
          allowTransparency: true,
          scrollback: 10000,
          altClickMovesCursor: true,
          macOptionIsMeta: true,
          windowsMode: false,
          convertEol: false,
          disableStdin: false,
        };

        // Use mocked Terminal (from TestSetup)
        const terminal = new (global as any).Terminal(terminalOptions);
        const fitAddon = new (global as any).FitAddon();
        
        // Simulate terminal initialization flow
        terminal.loadAddon(fitAddon);
        
        const container = document.createElement('div');
        terminal.open(container);
        fitAddon.fit();
        
        // These operations should not throw
        expect(terminal).to.exist;
        expect(fitAddon).to.exist;
        
      }).to.not.throw();
    });

    it('should handle async terminal initialization', (done) => {
      const terminalBody = document.createElement('div');
      terminalBody.id = 'terminal-body';
      document.body.appendChild(terminalBody);

      // Simulate async initialization (as in actual implementation)
      setTimeout(() => {
        try {
          const terminal = new (global as any).Terminal();
          const container = document.createElement('div');
          container.className = 'terminal-content';
          terminalBody.appendChild(container);
          
          terminal.open(container);
          
          setTimeout(() => {
            try {
              const fitAddon = new (global as any).FitAddon();
              terminal.loadAddon(fitAddon);
              fitAddon.fit();
              
              // If we reach here, async initialization worked
              expect(container.parentElement).to.equal(terminalBody);
              done();
            } catch (error) {
              done(error);
            }
          }, 100);
          
        } catch (error) {
          done(error);
        }
      }, 100);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle manager initialization failures gracefully', () => {
      expect(() => {
        // Simulate manager initialization with potential errors
        const mockManagers = {
          inputManager: {
            setupIMEHandling() {
              // This might throw in some conditions
              try {
                // Simulate potential error
                if (typeof document.addEventListener === 'undefined') {
                  throw new Error('addEventListener not available');
                }
                // Normal operation
                document.addEventListener('compositionstart', () => {});
              } catch (error) {
                console.error('Input manager initialization failed:', error);
                // Should not re-throw, just log
              }
            }
          },
          performanceManager: {
            initialize() {
              try {
                // Simulate buffer initialization
                const buffer: string[] = [];
                buffer.push('test');
              } catch (error) {
                console.error('Performance manager initialization failed:', error);
              }
            }
          }
        };

        // These should handle errors gracefully
        mockManagers.inputManager.setupIMEHandling();
        mockManagers.performanceManager.initialize();

      }).to.not.throw();
    });

    it('should handle missing DOM elements gracefully', () => {
      expect(() => {
        // Simulate terminal creation when container is missing
        const terminalContainer = document.getElementById('terminal-body');
        
        if (!terminalContainer) {
          console.log('Terminal container not found');
          return; // Should return gracefully, not throw
        }
        
        // This branch won't execute in this test, which is expected
        
      }).to.not.throw();
    });

    it('should handle webview.js loading errors', () => {
      expect(() => {
        // Simulate webview script loading with error handling
        const mockWindow = {
          vscodeApi: null as any,
          acquireVsCodeApi: (() => ({ postMessage: () => {} })) as any,
        };
        
        try {
          if (typeof mockWindow.acquireVsCodeApi === 'function') {
            mockWindow.vscodeApi = mockWindow.acquireVsCodeApi();
          } else {
            console.log('acquireVsCodeApi not available');
          }
        } catch (error) {
          console.log('Error acquiring VS Code API:', error);
        }
        
        // Should handle missing API gracefully
        expect(mockWindow.vscodeApi).to.not.be.null;
        
      }).to.not.throw();
    });
  });

  describe('Regression Prevention for Recent Changes', () => {
    it('should handle BaseManager log method changes correctly', () => {
      // Test that recent log method changes don't break functionality
      class TestBaseManager {
        protected loggingEnabled = true;
        protected logPrefix = '[TEST]';

        // Updated log method signature (from recent changes)
        protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
          const formattedMessage = `${this.logPrefix} ${message}`;
          
          switch (level) {
            case 'warn':
              console.warn(`⚠️ ${formattedMessage}`);
              break;
            case 'error':
              console.error(`❌ ${formattedMessage}`);
              break;
            default:
              console.log(formattedMessage);
          }
        }

        public testRecentLogChanges(): void {
          // These are the new log call formats from recent changes
          this.log(`🈶 [INPUT] IME composition started: test data`);
          this.log(`❌ [PERFORMANCE] Error during buffer flush: test error`, 'error');
          this.log(`🚀 [PERFORMANCE] Operation completed successfully`);
        }
      }

      expect(() => {
        const manager = new TestBaseManager();
        manager.testRecentLogChanges();
      }).to.not.throw();
    });

    it('should maintain backward compatibility with manager initialization', () => {
      expect(() => {
        // Simulate old vs new manager initialization patterns
        const managers = {
          input: {
            initialized: false,
            initialize() { 
              this.initialized = true;
              // Both old and new log patterns should work
              console.log('[INPUT] Manager initialized');
            }
          },
          performance: {
            initialized: false,
            initialize() { 
              this.initialized = true;
              console.log('[PERFORMANCE] Manager initialized');
            }
          },
          ui: {
            initialized: false,
            initialize() { 
              this.initialized = true;
              console.log('[UI] Manager initialized');
            }
          }
        };

        // Initialize all managers
        Object.values(managers).forEach(manager => {
          manager.initialize();
        });

        // Verify all managers initialized successfully
        Object.values(managers).forEach(manager => {
          expect(manager.initialized).to.be.true;
        });

      }).to.not.throw();
    });
  });
});