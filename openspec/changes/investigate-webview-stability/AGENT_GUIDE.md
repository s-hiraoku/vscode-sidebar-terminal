# Agent Usage Guide: WebView Stability Investigation

This guide provides step-by-step instructions for using AI agents to investigate and resolve WebView stability issues in the VS Code Sidebar Terminal extension.

## Quick Start

### Option 1: Use the Meta-Agent (Recommended)

Execute the complete investigation workflow with a single command:

```bash
Task(webview-stability-investigator): "Investigate WebView initialization stability issues"
```

The meta-agent will automatically orchestrate all phases and coordinate multiple specialized agents.

### Option 2: Manual Phase Execution

Execute agents manually for fine-grained control over each investigation phase.

## Investigation Phases

### Phase 1: Research & Discovery

**Objective**: Gather comprehensive information from multiple sources simultaneously.

**Execution**: Run these three agents **in parallel** for maximum efficiency.

#### Agent 1: VS Code Pattern Research

**Agent**: `vscode-terminal-resolver`

**Prompt**:
```
Investigate how VS Code implements WebView initialization in the integrated terminal.

Focus on:
1. WebViewViewProvider initialization patterns
2. DOM ready detection and element availability
3. iframe handling and context switching
4. Script loading timing and execution order
5. Error recovery mechanisms

Specific areas:
- src/vs/workbench/contrib/terminal/browser/terminalView.ts
- src/vs/workbench/contrib/terminal/browser/terminalInstance.ts
- src/vs/platform/webview/common/webview.ts

Provide file:line references for all findings.
```

**Expected Output**:
- VS Code source code references
- Implementation patterns and rationale
- Security and performance considerations
- Common pitfalls and how VS Code avoids them

**Example Usage**:
```bash
Task(vscode-terminal-resolver): "Investigate VS Code WebView initialization patterns for terminal, focusing on DOM ready detection and element availability checks in WebViewViewProvider"
```

#### Agent 2: Codebase Pattern Search

**Agent**: `serena-semantic-search`

**Prompt**:
```
Search our codebase for WebView initialization and terminal lifecycle patterns.

Find implementations related to:
1. WebView initialization (`main.ts` entry point)
2. Terminal manager creation and lifecycle
3. Message passing between Extension and WebView
4. DOM element availability checks
5. Initialization retry mechanisms
6. Error handling and recovery

Analyze patterns for:
- Consistency with project architecture
- Potential race conditions
- Anti-patterns or workarounds
- Areas needing improvement
```

**Expected Output**:
- Current implementation locations (file:line)
- Pattern analysis and architecture assessment
- Identified anti-patterns or workarounds
- Semantic similarities across components

**Example Usage**:
```bash
Task(serena-semantic-search): "Find all WebView initialization patterns and DOM element access patterns in the codebase, analyzing for race conditions and stability issues"
```

#### Agent 3: Xterm.js Best Practices

**Agent**: `xterm-info-analyzer`

**Prompt**:
```
Provide xterm.js best practices for WebView integration.

Cover:
1. Proper terminal-WebView lifecycle management
2. DOM element binding strategies
3. Recommended initialization sequence
4. Performance optimization settings
5. Common integration pitfalls

Focus on official xterm.js documentation for:
- WebView/iframe scenarios
- Element availability requirements
- Asynchronous initialization patterns
```

**Expected Output**:
- Official xterm.js API recommendations
- WebView-specific considerations
- Performance tuning parameters
- Integration patterns and examples

**Example Usage**:
```bash
Task(xterm-info-analyzer): "Get xterm.js best practices for WebView integration, DOM element binding, and initialization sequence in iframe contexts"
```

#### Parallel Execution

Execute all three agents simultaneously:

```bash
# In a single message, call all three Task tools:
Task(vscode-terminal-resolver): "Investigate VS Code WebView initialization..."
Task(serena-semantic-search): "Find all WebView initialization patterns..."
Task(xterm-info-analyzer): "Get xterm.js best practices for WebView integration..."
```

**Time Saved**: ~70% faster than sequential execution

### Phase 2: Analysis & Design

**Objective**: Synthesize research findings and identify refactoring opportunities.

**Prerequisites**: Phase 1 completion

#### Agent 4: Pattern Consolidation

**Agent**: `similarity-based-refactoring`

**Prompt**:
```
Analyze WebView initialization code for duplication and refactoring opportunities.

Focus areas:
1. Initialization retry loops across managers
2. DOM element availability checks
3. Error handling patterns
4. Workaround code that could be consolidated

Files to analyze:
- src/webview/main.ts
- src/services/webview/WebViewHtmlGenerationService.ts
- src/webview/managers/LightweightTerminalWebviewManager.ts
- src/providers/SecondaryTerminalProvider.ts

Provide specific refactoring recommendations with:
- Current duplication locations (file:line)
- Proposed consolidated patterns
- Estimated complexity reduction
```

**Expected Output**:
- Duplicate code identification
- Consolidation strategies
- Refactoring priority recommendations
- Estimated impact analysis

**Example Usage**:
```bash
Task(similarity-based-refactoring): "Analyze WebView initialization code for duplicate patterns, retry loops, and consolidation opportunities across main.ts, WebViewHtmlGenerationService.ts, and related managers"
```

#### Synthesis Step

After agents complete, manually synthesize findings:

1. **Document Current Issues**:
   - List all identified problems from serena-semantic-search
   - Categorize by severity (critical, high, medium, low)

2. **Gap Analysis**:
   - Compare current implementation vs. VS Code patterns
   - Identify specific divergences
   - Assess risk of each gap

3. **Design Stable Solution**:
   - Choose patterns from vscode-terminal-resolver
   - Integrate xterm.js best practices
   - Apply refactoring recommendations
   - Plan incremental migration

4. **Create Implementation Plan**:
   - Break down into small, testable steps
   - Define success criteria for each step
   - Establish rollback points

### Phase 3: Implementation

**Objective**: Implement production-ready code following researched patterns.

**Prerequisites**: Phase 2 synthesis complete

#### Agent 5: Production Implementation

**Agent**: `terminal-implementer`

**Prompt**:
```
Implement stable WebView initialization based on research findings.

Research Input:
[Paste consolidated findings from Phase 1 & 2]

Implementation Requirements:
1. Stable DOM ready detection following VS Code pattern
2. Reliable element availability checks (no retry loops)
3. Graceful degradation for edge cases
4. Clear error messages for diagnostics
5. Integration with existing Manager-Coordinator pattern

Files to Modify:
- src/webview/main.ts (initialization entry point)
- src/services/webview/WebViewHtmlGenerationService.ts (HTML generation)
- src/webview/managers/LightweightTerminalWebviewManager.ts (manager setup)
- src/providers/SecondaryTerminalProvider.ts (provider initialization)

Follow:
- TDD workflow (Red → Green → Refactor)
- Atomic operation patterns
- Existing Manager-Coordinator architecture
- Security best practices (regex validation)

Provide:
- File modifications with line references
- Integration points documentation
- Performance impact assessment
```

**Expected Output**:
- Production-ready implementation
- File changes with exact line references
- Integration documentation
- Test placeholders (for Phase 4)

**Example Usage**:
```bash
Task(terminal-implementer): "Implement stable WebView initialization in main.ts following VS Code patterns from research findings [paste findings], ensuring atomic operations and Manager-Coordinator pattern compliance"
```

#### Implementation Verification

After implementation:
1. Review code changes for pattern compliance
2. Verify atomic operation usage
3. Check dispose handler implementation
4. Validate security patterns (regex not includes())
5. Assess performance impact

### Phase 4: Quality Assurance

**Objective**: Create comprehensive test coverage and validate implementation.

**Prerequisites**: Phase 3 implementation complete

**Execution**: Run these two agents **in parallel**.

#### Agent 6: Unit & Integration Tests

**Agent**: `tdd-quality-engineer`

**Prompt**:
```
Create comprehensive test suite for WebView stability implementation.

Implementation Summary:
[Paste implementation details from Phase 3]

Test Requirements:

1. Unit Tests (Vitest):
   - WebView initialization success scenarios
   - DOM element availability edge cases
   - Initialization timing variations
   - Error recovery mechanisms
   - Manager disposal and cleanup

2. Integration Tests:
   - Extension ↔ WebView message passing
   - Terminal manager lifecycle
   - Multiple terminal creation/deletion
   - Session restoration scenarios

3. Edge Cases:
   - Slow DOM loading
   - Missing elements
   - Rapid initialization/disposal cycles
   - Concurrent operations

Follow TDD principles:
- Red: Write failing tests first
- Green: Verify implementation passes
- Refactor: Optimize test clarity

Files to Create:
- src/test/unit/webview/WebViewInitialization.test.ts
- src/test/integration/webview/TerminalWebViewLifecycle.test.ts

Ensure:
- >80% code coverage
- All edge cases covered
- Clear test descriptions
- Proper setup/teardown
```

**Expected Output**:
- Unit test suite (Vitest)
- Integration test suite
- TDD compliance report
- Coverage metrics

**Example Usage**:
```bash
Task(tdd-quality-engineer): "Create comprehensive TDD test suite for WebView initialization implementation, covering all edge cases, integration scenarios, and ensuring >80% coverage"
```

#### Agent 7: E2E UI Tests

**Agent**: `playwright-test-generator`

**Prompt**:
```
Create E2E tests for WebView UI functionality.

Test Scenarios:

1. Terminal Display:
   - Terminal renders correctly after initialization
   - Terminal body element is accessible
   - Xterm.js instance created successfully

2. User Interactions:
   - Keyboard input works
   - Mouse selection works
   - Copy/paste functionality
   - Alt+Click path opening

3. Layout Changes:
   - Panel resize handling
   - Theme changes apply correctly
   - Multiple terminals switch correctly

4. Stability:
   - No initialization errors in console
   - No retry loops detected
   - Proper cleanup on disposal

Target URL: (WebView runs within VS Code extension host)

Create tests in:
- src/test/e2e/webview/terminal-initialization.spec.ts
- src/test/e2e/webview/terminal-interaction.spec.ts
```

**Expected Output**:
- Playwright E2E test suite
- Visual regression tests
- Performance benchmarks
- Console error monitoring

**Example Usage**:
```bash
Task(playwright-test-generator): "Create E2E tests for WebView terminal initialization, user interactions, and layout changes, including console error monitoring and visual regression tests"
```

#### Parallel Execution

Execute both testing agents simultaneously:

```bash
# In a single message, call both Task tools:
Task(tdd-quality-engineer): "Create comprehensive TDD test suite for WebView..."
Task(playwright-test-generator): "Create E2E tests for WebView terminal..."
```

**Time Saved**: ~60% faster than sequential execution

#### Quality Verification

After tests are created:
1. Run unit tests: `npm run test:unit`
2. Run integration tests: `npm run test`
3. Run E2E tests: (if infrastructure ready)
4. Review coverage report
5. Validate TDD compliance: `npm run tdd:quality-gate`

### Phase 5: Documentation & Deployment

**Objective**: Document changes and deploy safely.

#### Update Documentation

1. **CLAUDE.md**: Update architecture section if patterns changed
2. **CHANGELOG.md**: Add entry for stability improvements
3. **Code Comments**: Add inline documentation referencing VS Code patterns

Example comment format:
```typescript
// Following VS Code pattern from src/vs/workbench/contrib/terminal/browser/terminalInstance.ts:345
// Ensures DOM is ready before accessing elements to prevent race conditions
```

#### Deployment Strategy

1. **Feature Flag** (Recommended):
   ```typescript
   const useStableInitialization = vscode.workspace
     .getConfiguration('sidebarTerminal')
     .get<boolean>('experimental.stableWebViewInit', false);
   ```

2. **Incremental Rollout**:
   - Week 1: Internal testing with feature flag enabled
   - Week 2: Beta testers (10% of users)
   - Week 3: Gradual rollout (50% → 100%)

3. **Monitoring**:
   - Track initialization failures
   - Monitor retry loop occurrences
   - Measure initialization timing
   - Collect user feedback

## Troubleshooting

### Agent Execution Issues

**Problem**: Agent returns incomplete results

**Solution**:
1. Increase agent timeout if available
2. Narrow the scope of the query
3. Run agent again with more specific instructions
4. Split complex queries into smaller parts

**Problem**: Agents return conflicting recommendations

**Solution**:
1. Prioritize VS Code patterns (most authoritative)
2. Evaluate xterm.js official docs next
3. Consider project-specific constraints
4. Make informed decision and document rationale

### Research Gaps

**Problem**: VS Code pattern not directly applicable

**Solution**:
1. Search for similar patterns in VS Code
2. Adapt the pattern to project architecture
3. Document adaptations and reasoning
4. Consider hybrid approach

### Implementation Issues

**Problem**: Tests fail after implementation

**Solution**:
1. Review TDD workflow (Red → Green → Refactor)
2. Check for race conditions (atomic operations)
3. Verify dispose handlers
4. Validate integration with existing managers

## Best Practices

### Agent Usage

1. **Parallel First**: Always run independent agents in parallel
2. **Specific Prompts**: Provide detailed, focused instructions
3. **Context Sharing**: Pass agent outputs to subsequent agents
4. **Validation**: Always verify agent recommendations against project constraints

### Code Quality

1. **Follow Patterns**: Adhere to Manager-Coordinator architecture
2. **Atomic Operations**: Prevent race conditions
3. **Dispose Handlers**: Clean up resources
4. **Security**: Use regex (not includes()) for string matching
5. **TDD Compliance**: Red → Green → Refactor workflow

### Testing

1. **Coverage**: Aim for >80% unit test coverage
2. **Edge Cases**: Test boundary conditions thoroughly
3. **Integration**: Verify component interactions
4. **E2E**: Validate user-facing functionality
5. **Performance**: Benchmark critical paths

## Time Estimates

| Phase | Sequential | Parallel | Time Saved |
|-------|-----------|----------|------------|
| Phase 1: Research | ~45 min | ~15 min | 67% |
| Phase 2: Analysis | ~30 min | ~30 min | 0% |
| Phase 3: Implementation | ~60 min | ~60 min | 0% |
| Phase 4: Testing | ~40 min | ~20 min | 50% |
| **Total** | **~175 min** | **~125 min** | **~29%** |

*Note: Using webview-stability-investigator meta-agent provides additional orchestration efficiency.*

## Success Criteria

Investigation is complete when:

- [ ] All research agents executed successfully
- [ ] VS Code patterns documented with file:line references
- [ ] Current codebase fully analyzed
- [ ] Gap analysis completed
- [ ] Implementation follows VS Code patterns
- [ ] TDD workflow followed (all tests pass)
- [ ] >80% code coverage achieved
- [ ] E2E tests created and passing
- [ ] Integration tested with existing managers
- [ ] Performance impact assessed (<5% regression)
- [ ] Security patterns validated
- [ ] Documentation updated (CLAUDE.md, code comments)
- [ ] Deployment strategy defined
- [ ] Monitoring plan established

## References

- **Proposal**: `openspec/changes/investigate-webview-stability/proposal.md`
- **Meta-Agent**: `.claude/agents/webview-stability-investigator.md`
- **Project Agents**: `openspec/AGENTS.md`
- **Development Guide**: `CLAUDE.md`

## Support

For questions or issues:
1. Review this guide and proposal.md
2. Check existing agent configurations in `.claude/agents/`
3. Consult `CLAUDE.md` for architecture patterns
4. Create GitHub issue if problem persists
