/**
 * AddonLoader Unit Tests
 *
 * Tests for generic addon loading utility with error handling and logging.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Terminal } from '@xterm/xterm';
import { AddonLoader } from '../../../../webview/utils/AddonLoader';
import { terminalLogger } from '../../../../webview/utils/ManagerLogger';

describe('AddonLoader', function () {
  let terminal: Terminal;
  let loadAddonStub: sinon.SinonStub;
  let loggerInfoStub: sinon.SinonStub;
  let loggerErrorStub: sinon.SinonStub;
  let loggerWarnStub: sinon.SinonStub;

  // Mock addon class
  class MockAddon {
    public name = 'MockAddon';
    public dispose() {}
  }

  beforeEach(function () {
    // Create terminal mock
    terminal = {
      loadAddon: sinon.stub(),
      unicode: { activeVersion: '' },
    } as any;

    loadAddonStub = terminal.loadAddon as sinon.SinonStub;

    // Stub logger methods
    loggerInfoStub = sinon.stub(terminalLogger, 'info');
    loggerErrorStub = sinon.stub(terminalLogger, 'error');
    loggerWarnStub = sinon.stub(terminalLogger, 'warn');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('loadAddon()', function () {
    it('should load required addon successfully', async function () {
      const addon = await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon, {
        required: true,
      });

      expect(addon).to.be.instanceOf(MockAddon);
      expect(loadAddonStub.calledOnce).to.be.true;
      expect(loggerInfoStub.calledWith('✅ MockAddon loaded: terminal-1')).to.be.true;
    });

    it('should load optional addon successfully', async function () {
      const addon = await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon, {
        required: false,
      });

      expect(addon).to.be.instanceOf(MockAddon);
      expect(loadAddonStub.calledOnce).to.be.true;
      expect(loggerInfoStub.calledWith('✅ MockAddon loaded: terminal-1')).to.be.true;
    });

    it('should use custom addon name for logging', async function () {
      const addon = await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon, {
        required: true,
        addonName: 'CustomAddonName',
      });

      expect(addon).to.be.instanceOf(MockAddon);
      expect(loggerInfoStub.calledWith('✅ CustomAddonName loaded: terminal-1')).to.be.true;
    });

    it('should execute onLoaded callback after loading', async function () {
      const onLoadedSpy = sinon.spy();

      const addon = await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon, {
        required: true,
        onLoaded: onLoadedSpy,
      });

      expect(addon).to.be.instanceOf(MockAddon);
      expect(onLoadedSpy.calledOnce).to.be.true;
      expect(onLoadedSpy.calledWith(addon, terminal)).to.be.true;
    });

    it('should set unicode.activeVersion in onLoaded callback', async function () {
      const addon = await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon, {
        required: true,
        onLoaded: (_, term) => {
          term.unicode.activeVersion = '11';
        },
      });

      expect(addon).to.be.instanceOf(MockAddon);
      expect(terminal.unicode.activeVersion).to.equal('11');
    });

    it('should throw error for required addon that fails to load', async function () {
      loadAddonStub.throws(new Error('Addon load failed'));

      try {
        await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon, {
          required: true,
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('Addon load failed');
        expect(loggerErrorStub.calledOnce).to.be.true;
      }
    });

    it('should return undefined for optional addon that fails to load', async function () {
      loadAddonStub.throws(new Error('Addon load failed'));

      const addon = await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon, {
        required: false,
      });

      expect(addon).to.be.undefined;
      expect(loggerWarnStub.calledOnce).to.be.true;
    });

    it('should default to required=true if not specified', async function () {
      loadAddonStub.throws(new Error('Addon load failed'));

      try {
        await AddonLoader.loadAddon(terminal, 'terminal-1', MockAddon);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('Addon load failed');
        expect(loggerErrorStub.calledOnce).to.be.true;
      }
    });
  });

  describe('loadAddonWithResult()', function () {
    it('should return success result for successful load', async function () {
      const result = await AddonLoader.loadAddonWithResult(
        terminal,
        'terminal-1',
        MockAddon,
        { required: true }
      );

      expect(result.success).to.be.true;
      expect(result.addon).to.be.instanceOf(MockAddon);
      expect(result.error).to.be.undefined;
    });

    it('should return failure result for failed required addon', async function () {
      loadAddonStub.throws(new Error('Load failed'));

      const result = await AddonLoader.loadAddonWithResult(
        terminal,
        'terminal-1',
        MockAddon,
        { required: true }
      );

      expect(result.success).to.be.false;
      expect(result.addon).to.be.undefined;
      expect(result.error).to.exist;
    });

    it('should return failure result for failed optional addon', async function () {
      loadAddonStub.throws(new Error('Load failed'));

      const result = await AddonLoader.loadAddonWithResult(
        terminal,
        'terminal-1',
        MockAddon,
        { required: false }
      );

      expect(result.success).to.be.false;
      expect(result.addon).to.be.undefined;
      expect(result.error).to.be.undefined; // Optional addon doesn't throw
    });
  });

  describe('loadMultipleAddons()', function () {
    class Addon1 {
      public name = 'Addon1';
    }
    class Addon2 {
      public name = 'Addon2';
    }
    class Addon3 {
      public name = 'Addon3';
    }

    it('should load multiple addons in parallel', async function () {
      const addonMap = await AddonLoader.loadMultipleAddons(terminal, 'terminal-1', [
        { AddonClass: Addon1, options: { required: true } },
        { AddonClass: Addon2, options: { required: true } },
        { AddonClass: Addon3, options: { required: false } },
      ]);

      expect(addonMap.size).to.equal(3);
      expect(addonMap.get('Addon1')).to.be.instanceOf(Addon1);
      expect(addonMap.get('Addon2')).to.be.instanceOf(Addon2);
      expect(addonMap.get('Addon3')).to.be.instanceOf(Addon3);
      expect(loadAddonStub.callCount).to.equal(3);
    });

    it('should skip failed optional addons in result map', async function () {
      loadAddonStub.onCall(1).throws(new Error('Addon2 failed'));

      const addonMap = await AddonLoader.loadMultipleAddons(terminal, 'terminal-1', [
        { AddonClass: Addon1, options: { required: true } },
        { AddonClass: Addon2, options: { required: false } },
        { AddonClass: Addon3, options: { required: true } },
      ]);

      expect(addonMap.size).to.equal(2);
      expect(addonMap.get('Addon1')).to.be.instanceOf(Addon1);
      expect(addonMap.get('Addon2')).to.be.undefined;
      expect(addonMap.get('Addon3')).to.be.instanceOf(Addon3);
    });

    it('should use custom addon names in result map', async function () {
      const addonMap = await AddonLoader.loadMultipleAddons(terminal, 'terminal-1', [
        {
          AddonClass: Addon1,
          options: { required: true, addonName: 'CustomAddon1' },
        },
        {
          AddonClass: Addon2,
          options: { required: true, addonName: 'CustomAddon2' },
        },
      ]);

      expect(addonMap.size).to.equal(2);
      expect(addonMap.get('CustomAddon1')).to.be.instanceOf(Addon1);
      expect(addonMap.get('CustomAddon2')).to.be.instanceOf(Addon2);
    });
  });
});
