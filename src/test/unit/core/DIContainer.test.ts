/**
 * DIContainer Unit Tests
 *
 * Tests for the lightweight dependency injection container.
 */

import { expect } from 'chai';
import {
  DIContainer,
  ServiceLifetime,
  createServiceToken,
  CircularDependencyError,
  ServiceNotRegisteredError,
} from '../../../core/DIContainer';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  describe('Service Registration', () => {
    it('should register a service with singleton lifetime', () => {
      const ILogger = createServiceToken<{ log: (msg: string) => void }>('ILogger');
      const logger = { log: (msg: string) => console.log(msg) };

      container.register(ILogger, () => logger, ServiceLifetime.Singleton);

      expect(container.isRegistered(ILogger)).to.be.true;
    });

    it('should throw error when registering duplicate service', () => {
      const ILogger = createServiceToken<{ log: (msg: string) => void }>('ILogger');

      container.register(ILogger, () => ({ log: () => {} }), ServiceLifetime.Singleton);

      expect(() =>
        container.register(ILogger, () => ({ log: () => {} }), ServiceLifetime.Singleton)
      ).to.throw('Service already registered: ILogger');
    });

    it('should return service count', () => {
      const ILogger = createServiceToken<object>('ILogger');
      const IConfig = createServiceToken<object>('IConfig');

      container.register(ILogger, () => ({}), ServiceLifetime.Singleton);
      container.register(IConfig, () => ({}), ServiceLifetime.Singleton);

      expect(container.serviceCount).to.equal(2);
    });
  });

  describe('Singleton Lifetime', () => {
    it('should return same instance for singleton services', () => {
      const ILogger = createServiceToken<{ id: number }>('ILogger');
      let idCounter = 0;

      container.register(
        ILogger,
        () => ({ id: ++idCounter }),
        ServiceLifetime.Singleton
      );

      const instance1 = container.resolve(ILogger);
      const instance2 = container.resolve(ILogger);

      expect(instance1).to.equal(instance2);
      expect(instance1.id).to.equal(1);
    });
  });

  describe('Transient Lifetime', () => {
    it('should return new instance for transient services', () => {
      const ILogger = createServiceToken<{ id: number }>('ILogger');
      let idCounter = 0;

      container.register(
        ILogger,
        () => ({ id: ++idCounter }),
        ServiceLifetime.Transient
      );

      const instance1 = container.resolve(ILogger);
      const instance2 = container.resolve(ILogger);

      expect(instance1).to.not.equal(instance2);
      expect(instance1.id).to.equal(1);
      expect(instance2.id).to.equal(2);
    });
  });

  describe('Scoped Lifetime', () => {
    it('should return same instance within a scope', () => {
      const ILogger = createServiceToken<{ id: number }>('ILogger');
      let idCounter = 0;

      container.register(
        ILogger,
        () => ({ id: ++idCounter }),
        ServiceLifetime.Scoped
      );

      const scope = container.createScope();
      const instance1 = scope.resolve(ILogger);
      const instance2 = scope.resolve(ILogger);

      expect(instance1).to.equal(instance2);
      expect(instance1.id).to.equal(1);

      scope.dispose();
    });

    it('should return different instances across scopes', () => {
      const ILogger = createServiceToken<{ id: number }>('ILogger');
      let idCounter = 0;

      container.register(
        ILogger,
        () => ({ id: ++idCounter }),
        ServiceLifetime.Scoped
      );

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve(ILogger);
      const instance2 = scope2.resolve(ILogger);

      expect(instance1).to.not.equal(instance2);
      expect(instance1.id).to.equal(1);
      expect(instance2.id).to.equal(2);

      scope1.dispose();
      scope2.dispose();
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies', () => {
      const IServiceA = createServiceToken<object>('IServiceA');
      const IServiceB = createServiceToken<object>('IServiceB');

      container.register(
        IServiceA,
        (c) => ({ b: c.resolve(IServiceB) }),
        ServiceLifetime.Singleton
      );
      container.register(
        IServiceB,
        (c) => ({ a: c.resolve(IServiceA) }),
        ServiceLifetime.Singleton
      );

      expect(() => container.resolve(IServiceA)).to.throw(CircularDependencyError);
    });

    it('should include dependency chain in error', () => {
      const IServiceA = createServiceToken<object>('IServiceA');
      const IServiceB = createServiceToken<object>('IServiceB');

      container.register(
        IServiceA,
        (c) => ({ b: c.resolve(IServiceB) }),
        ServiceLifetime.Singleton
      );
      container.register(
        IServiceB,
        (c) => ({ a: c.resolve(IServiceA) }),
        ServiceLifetime.Singleton
      );

      try {
        container.resolve(IServiceA);
        expect.fail('Should have thrown CircularDependencyError');
      } catch (error) {
        expect(error).to.be.instanceof(CircularDependencyError);
        const circularError = error as CircularDependencyError;
        expect(circularError.dependencyChain).to.include('IServiceA');
        expect(circularError.dependencyChain).to.include('IServiceB');
      }
    });
  });

  describe('Service Resolution', () => {
    it('should throw error when resolving unregistered service', () => {
      const ILogger = createServiceToken<object>('ILogger');

      expect(() => container.resolve(ILogger)).to.throw(
        ServiceNotRegisteredError,
        'Service not registered: ILogger'
      );
    });

    it('should return undefined for tryResolve with unregistered service', () => {
      const ILogger = createServiceToken<object>('ILogger');

      const result = container.tryResolve(ILogger);

      expect(result).to.be.undefined;
    });

    it('should resolve dependencies recursively', () => {
      interface ILogger {
        log: (msg: string) => void;
      }
      interface IService {
        logger: ILogger;
      }

      const ILogger = createServiceToken<ILogger>('ILogger');
      const IService = createServiceToken<IService>('IService');

      container.register(
        ILogger,
        () => ({ log: () => {} }),
        ServiceLifetime.Singleton
      );
      container.register(
        IService,
        (c) => ({ logger: c.resolve(ILogger) }),
        ServiceLifetime.Singleton
      );

      const service = container.resolve(IService);

      expect(service.logger).to.exist;
    });
  });

  describe('Disposal', () => {
    it('should dispose all singletons when container is disposed', () => {
      let disposedCount = 0;

      const IService = createServiceToken<{ dispose: () => void }>('IService');
      container.register(
        IService,
        () => ({
          dispose: () => {
            disposedCount++;
          },
        }),
        ServiceLifetime.Singleton
      );

      // Resolve to create instance
      container.resolve(IService);

      container.dispose();

      expect(disposedCount).to.equal(1);
    });

    it('should dispose singletons in reverse registration order', () => {
      const disposalOrder: number[] = [];

      const IService1 = createServiceToken<{ dispose: () => void }>('IService1');
      const IService2 = createServiceToken<{ dispose: () => void }>('IService2');

      container.register(
        IService1,
        () => ({
          dispose: () => {
            disposalOrder.push(1);
          },
        }),
        ServiceLifetime.Singleton
      );
      container.register(
        IService2,
        () => ({
          dispose: () => {
            disposalOrder.push(2);
          },
        }),
        ServiceLifetime.Singleton
      );

      // Resolve to create instances
      container.resolve(IService1);
      container.resolve(IService2);

      container.dispose();

      expect(disposalOrder).to.deep.equal([2, 1]);
    });

    it('should throw error when using disposed container', () => {
      const IService = createServiceToken<object>('IService');
      container.register(IService, () => ({}), ServiceLifetime.Singleton);

      container.dispose();

      expect(() => container.resolve(IService)).to.throw(
        'Cannot use disposed DIContainer'
      );
    });

    it('should dispose all scopes when container is disposed', () => {
      let scopeDisposedCount = 0;

      const IService = createServiceToken<{ dispose: () => void }>('IService');
      container.register(
        IService,
        () => ({
          dispose: () => {
            scopeDisposedCount++;
          },
        }),
        ServiceLifetime.Scoped
      );

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      scope1.resolve(IService);
      scope2.resolve(IService);

      container.dispose();

      expect(scopeDisposedCount).to.equal(2);
    });
  });

  describe('Parent-Child Containers', () => {
    it('should resolve from parent container when not found in child', () => {
      const ILogger = createServiceToken<{ id: number }>('ILogger');

      container.register(ILogger, () => ({ id: 1 }), ServiceLifetime.Singleton);

      const scope = container.createScope();
      const logger = scope.resolve(ILogger);

      expect(logger.id).to.equal(1);

      scope.dispose();
    });

    it('should check registration in parent container', () => {
      const ILogger = createServiceToken<object>('ILogger');

      container.register(ILogger, () => ({}), ServiceLifetime.Singleton);

      const scope = container.createScope();

      expect(scope.isRegistered(ILogger)).to.be.true;

      scope.dispose();
    });
  });
});
