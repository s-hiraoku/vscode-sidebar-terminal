export type TerminalDisplayMode = 'normal' | 'fullscreen' | 'split';

export interface TerminalCreationOverrides {
  displayModeOverride?: TerminalDisplayMode;
}
