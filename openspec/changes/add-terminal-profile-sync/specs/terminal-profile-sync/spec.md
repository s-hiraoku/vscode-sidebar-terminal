## ADDED Requirements
### Requirement: Default Terminal Profile Sync
Secondary Terminal MUST launch new sessions using the user's default VS Code terminal profile when available.

#### Scenario: Default Profile Applied
- **GIVEN** the user has a default VS Code terminal profile configured
- **WHEN** a new Secondary Terminal session is created
- **THEN** the session MUST start with that profile's shell path and environment
- **AND** no manual profile selection prompt SHOULD appear

#### Scenario: Profile Resolution Fallback
- **GIVEN** the user does not have a default profile or resolution fails
- **WHEN** a new Secondary Terminal session is created
- **THEN** the session MUST fall back to the extension's existing default shell
- **AND** the extension MUST warn the user once per session about the fallback

### Requirement: Manual Profile Sync Command
Secondary Terminal MUST provide a command that refreshes and reapplies the default profile across active sessions.

#### Scenario: Command Refresh Success
- **GIVEN** the command `Secondary Terminal: Sync Default Profile` is executed
- **WHEN** the default profile resolves successfully
- **THEN** active Secondary Terminal sessions SHOULD restart with the resolved profile
- **AND** the webview MUST display a confirmation toast.

#### Scenario: Command Refresh Failure
- **GIVEN** the command `Secondary Terminal: Sync Default Profile` is executed
- **WHEN** the default profile cannot be resolved
- **THEN** active sessions MUST remain on their current shell
- **AND** the extension MUST surface a toast describing the fallback status.
