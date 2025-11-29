# WebView Layout Capability Specification

## Overview

This specification defines how the WebView manages DOM elements and layout operations to ensure reliable, predictable terminal display across different panel positions (bottom panel vs sidebar).

## ADDED Requirements

### Requirement: Element Reference Storage
The TerminalLifecycleManager MUST store DOM element references in TypeScript properties (`_terminalsWrapper`, `_terminalBody`) at element creation time, NOT through `getElementById()` lookups.

#### Scenario: Element created and stored
- **WHEN** `initializeSimpleTerminal()` creates the terminals-wrapper element
- **THEN** the element reference is stored in `this._terminalsWrapper` property
- **AND** subsequent operations use the stored reference
- **AND** no `getElementById()` calls are made after initialization

#### Scenario: Element accessed by other managers
- **WHEN** TerminalContainerManager needs to access terminals-wrapper
- **THEN** it gets the reference through TerminalLifecycleManager property
- **AND** the reference is guaranteed to be available if initialized

### Requirement: Layout Initialization Control
The TerminalLifecycleManager MUST use a LayoutController instance to prevent layout operations before full initialization is complete.

#### Scenario: Layout called before initialization
- **WHEN** `layout()` is called during initialization phase
- **THEN** LayoutController's `isLayoutEnabled` flag is false
- **AND** layout operations are skipped without error

#### Scenario: Layout enabled after initialization
- **WHEN** initialization completes and `layoutController.enableLayout()` is called
- **THEN** subsequent `layout()` calls execute normally
- **AND** flexDirection is applied to terminals-wrapper

### Requirement: Panel Position from Extension
Panel position ('panel' | 'sidebar') MUST be detected and communicated by the Extension, NOT the WebView.

#### Scenario: Initial panel position sent on startup
- **WHEN** SecondaryTerminalProvider creates the WebView
- **THEN** it detects the current panel position using VS Code API
- **AND** sends `panelLocationUpdate` message with the detected location
- **AND** WebView receives the message before first layout

#### Scenario: Panel position change detected
- **WHEN** user moves panel from bottom to sidebar (or vice versa)
- **THEN** Extension detects the change through listener
- **AND** sends updated `panelLocationUpdate` message
- **AND** WebView applies new layout direction

### Requirement: ResizeObserver Removal
WebView MUST NOT use ResizeObserver for panel position detection or layout triggering.

#### Scenario: Panel position without ResizeObserver
- **WHEN** panel position needs to be determined
- **THEN** Extension provides the value explicitly
- **AND** no aspect ratio calculation occurs in WebView
- **AND** no ResizeObserver instances exist in main.ts

### Requirement: Priority-Based DOM Scheduling
DOM operations MUST be scheduled using DOMManager's priority-based system when timing is critical for preventing layout thrashing.

#### Scenario: Read operation scheduled
- **WHEN** code needs to measure DOM elements
- **THEN** it calls `DOMManager.scheduleRead(callback)`
- **AND** callback receives priority 10000
- **AND** executes before Write operations in same frame

#### Scenario: Write operation scheduled
- **WHEN** code needs to modify DOM elements
- **THEN** it calls `DOMManager.scheduleWrite(callback)`
- **AND** callback receives priority -10000
- **AND** executes after Read operations in same frame

#### Scenario: Multiple operations in one frame
- **WHEN** both Read and Write operations are scheduled
- **THEN** DOMManager sorts by priority (Read first)
- **AND** all callbacks execute in next animation frame
- **AND** layout thrashing is prevented

### Requirement: Explicit Layout Triggering
Layout MUST be triggered explicitly through method calls, NOT automatically by observers.

#### Scenario: Window resize triggers layout
- **WHEN** browser window is resized
- **THEN** resize event listener calls `layout()` method
- **AND** layout executes if enabled
- **AND** flexDirection is reapplied as needed

#### Scenario: Terminal creation triggers layout
- **WHEN** new terminal is created
- **THEN** TerminalLifecycleManager calls `layout()`
- **AND** container dimensions are recalculated

#### Scenario: Panel position change triggers layout
- **WHEN** `panelLocationUpdate` message received
- **THEN** `onPanelLocationChange()` updates stored location
- **AND** calls `layout()` to apply new direction

### Requirement: Memory Cleanup
The TerminalLifecycleManager MUST clear all element references in its `dispose()` method to prevent memory leaks.

#### Scenario: Dispose called on shutdown
- **WHEN** WebView is closing and `dispose()` is called
- **THEN** `this._terminalsWrapper` is set to undefined
- **AND** `this._terminalBody` is set to undefined
- **AND** all event listeners are removed
- **AND** LayoutController is reset

### Requirement: Error Handling in Scheduled Callbacks
DOMManager MUST catch and log errors in scheduled callbacks without crashing other callbacks.

#### Scenario: Callback throws error
- **WHEN** a scheduled callback throws an error during execution
- **THEN** DOMManager catches the error
- **AND** logs it to console with [DOMManager] prefix
- **AND** continues executing remaining callbacks
- **AND** other callbacks are not affected

### Requirement: Panel Position Validation
Panel position messages from Extension MUST be validated to only accept 'panel' | 'sidebar' values.

#### Scenario: Valid panel position received
- **WHEN** `panelLocationUpdate` message contains location: 'panel'
- **THEN** the value is accepted and stored
- **AND** layout is updated accordingly

#### Scenario: Invalid panel position received
- **WHEN** `panelLocationUpdate` message contains invalid location value
- **THEN** a fallback value of 'panel' is used
- **AND** a warning is logged to console

## REMOVED Requirements

### Requirement: getElementById() for DOM Access
**Reason**: getElementById() lookups are timing-dependent and unreliable during initialization.

**Migration**: Replace all `getElementById('terminals-wrapper')` calls with element references stored in TerminalLifecycleManager properties.

#### Scenario: Previous getElementById usage
- **WHEN** code needed terminals-wrapper reference
- **THEN** it called `getElementById('terminals-wrapper')`
- **AND** relied on timing for element availability

### Requirement: ResizeObserver Panel Detection
**Reason**: ResizeObserver timing is unpredictable and causes race conditions with DOM rendering pipeline.

**Migration**: Extension now detects panel position through VS Code API and sends explicit notification to WebView.

#### Scenario: Previous ResizeObserver usage
- **WHEN** terminals-wrapper dimensions changed
- **THEN** ResizeObserver callback calculated aspect ratio
- **AND** compared to ASPECT_RATIO_THRESHOLD
- **AND** inferred 'panel' or 'sidebar' from ratio

### Requirement: Automatic Layout on Observation
**Reason**: Automatic layout leads to competing updates and timing issues.

**Migration**: Layout is now triggered explicitly through `layout()` method calls at appropriate lifecycle points.

#### Scenario: Previous automatic layout
- **WHEN** ResizeObserver detected dimension change
- **THEN** layout was automatically applied
- **AND** could conflict with other layout operations

### Requirement: setTimeout Retry Logic
**Reason**: Retry logic is a symptom of timing issues, not a proper solution.

**Migration**: Element references and LayoutController eliminate the need for retries.

#### Scenario: Previous retry pattern
- **WHEN** `getElementById()` returned null
- **THEN** code scheduled 100ms setTimeout retry
- **AND** hoped element would be available later

## Notes

This is a foundational capability for WebView DOM management and layout control. It replaces the previous ResizeObserver-based approach with VS Code's proven patterns for element reference management and explicit layout control.

Key files implementing this specification:
- `/src/webview/utils/DOMManager.ts` - Priority-based DOM scheduling
- `/src/webview/utils/LayoutController.ts` - Layout initialization state
- `/src/webview/managers/TerminalLifecycleManager.ts` - Element reference storage and layout method
- `/src/providers/SecondaryTerminalProvider.ts` - Panel position detection
