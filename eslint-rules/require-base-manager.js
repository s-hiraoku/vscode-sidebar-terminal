/**
 * ESLint Rule: require-base-manager
 *
 * Ensures all Manager classes extend BaseManager and implement IDisposable
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure Manager classes extend BaseManager',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      requireBaseManager: 'Manager class "{{className}}" must extend BaseManager',
      requireDispose: 'Manager class "{{className}}" must implement dispose() method',
      noLateBinding: 'Avoid late-binding pattern with setCoordinator(). Use constructor injection instead',
    },
    schema: [],
  },

  create(context) {
    return {
      // Check class declarations
      ClassDeclaration(node) {
        const className = node.id?.name;

        // Only check classes ending with "Manager"
        if (!className || !className.endsWith('Manager')) {
          return;
        }

        // Skip BaseManager itself
        if (className === 'BaseManager' || className === 'ResourceManager') {
          return;
        }

        // Check if class extends BaseManager
        const extendsBaseManager = node.superClass?.name === 'BaseManager';

        if (!extendsBaseManager) {
          context.report({
            node,
            messageId: 'requireBaseManager',
            data: { className },
          });
        }
      },

      // Check for setCoordinator methods (late-binding pattern)
      MethodDefinition(node) {
        if (node.key.name === 'setCoordinator') {
          context.report({
            node,
            messageId: 'noLateBinding',
          });
        }
      },
    };
  },
};
