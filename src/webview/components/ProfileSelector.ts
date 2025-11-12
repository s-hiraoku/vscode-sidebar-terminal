/**
 * Terminal Profile Selector Component
 * UI component for selecting terminal profiles
 */

import { ITerminalProfile } from '../../types/profiles';
import { webview as log } from '../../utils/logger';

export class ProfileSelector {
  private _container: HTMLElement;
  private _isVisible = false;
  private _profiles: ITerminalProfile[] = [];
  private _selectedProfileId?: string;
  private _filterText = '';
  private _onProfileSelected?: (profileId: string) => void;
  private _onClosed?: () => void;

  constructor(container: HTMLElement) {
    this._container = container;
    this._createUI();
    this._setupEventListeners();
  }

  /**
   * Show the profile selector
   */
  public show(
    profiles: ITerminalProfile[],
    selectedProfileId?: string,
    onProfileSelected?: (profileId: string) => void,
    onClosed?: () => void
  ): void {
    this._profiles = profiles;
    this._selectedProfileId = selectedProfileId;
    this._onProfileSelected = onProfileSelected;
    this._onClosed = onClosed;

    this._updateProfileList();
    this._container.style.display = 'block';
    this._isVisible = true;

    // Focus the filter input
    const filterInput = this._container.querySelector('.profile-filter') as HTMLInputElement;
    if (filterInput) {
      filterInput.focus();
    }

    log('🎯 [PROFILE-UI] Profile selector shown with', profiles.length, 'profiles');
  }

  /**
   * Hide the profile selector
   */
  public hide(): void {
    this._container.style.display = 'none';
    this._isVisible = false;
    this._filterText = '';

    // Clear filter input
    const filterInput = this._container.querySelector('.profile-filter') as HTMLInputElement;
    if (filterInput) {
      filterInput.value = '';
    }

    if (this._onClosed) {
      this._onClosed();
    }

    log('🎯 [PROFILE-UI] Profile selector hidden');
  }

  /**
   * Check if selector is visible
   */
  public get isVisible(): boolean {
    return this._isVisible;
  }

  /**
   * Update the list of available profiles
   */
  public updateProfiles(profiles: ITerminalProfile[]): void {
    this._profiles = profiles;
    if (this._isVisible) {
      this._updateProfileList();
    }
  }

  private _createUI(): void {
    this._container.innerHTML = `
      <div class="profile-selector-overlay">
        <div class="profile-selector-dialog">
          <div class="profile-selector-header">
            <h3>Select Terminal Profile</h3>
            <button class="profile-selector-close" title="Close">×</button>
          </div>
          
          <div class="profile-selector-search">
            <input 
              type="text" 
              class="profile-filter" 
              placeholder="Type to filter profiles..."
              autocomplete="off"
            >
          </div>
          
          <div class="profile-list-container">
            <ul class="profile-list"></ul>
          </div>
          
          <div class="profile-selector-footer">
            <button class="btn-secondary profile-selector-cancel">Cancel</button>
            <button class="btn-primary profile-selector-confirm" disabled>Select</button>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    this._addStyles();
  }

  private _setupEventListeners(): void {
    // Close button
    const closeBtn = this._container.querySelector('.profile-selector-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Cancel button
    const cancelBtn = this._container.querySelector('.profile-selector-cancel');
    cancelBtn?.addEventListener('click', () => this.hide());

    // Confirm button
    const confirmBtn = this._container.querySelector('.profile-selector-confirm');
    confirmBtn?.addEventListener('click', () => this._confirmSelection());

    // Filter input
    const filterInput = this._container.querySelector('.profile-filter') as HTMLInputElement;
    filterInput?.addEventListener('input', (e) => {
      this._filterText = (e.target as HTMLInputElement).value;
      this._updateProfileList();
    });

    // Keyboard navigation
    this._container.addEventListener('keydown', (e) => this._handleKeydown(e));

    // Overlay click to close
    const overlay = this._container.querySelector('.profile-selector-overlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });
  }

  private _updateProfileList(): void {
    const profileList = this._container.querySelector('.profile-list');
    if (!profileList) return;

    // Filter profiles based on search text
    const filteredProfiles = this._profiles.filter(
      (profile) =>
        profile.name.toLowerCase().includes(this._filterText.toLowerCase()) ||
        (profile.description?.toLowerCase().includes(this._filterText.toLowerCase()) ?? false)
    );

    // Clear existing items
    profileList.textContent = ''; // Safe: clearing content

    // Add profile items
    filteredProfiles.forEach((profile, _index) => {
      const listItem = document.createElement('li');
      listItem.className = 'profile-item';
      listItem.dataset.profileId = profile.id;

      if (profile.id === this._selectedProfileId) {
        listItem.classList.add('selected');
      }

      listItem.innerHTML = `
        <div class="profile-item-icon">
          ${this._getProfileIcon(profile)}
        </div>
        <div class="profile-item-content">
          <div class="profile-item-name">
            ${this._escapeHtml(profile.name)}
            ${profile.isDefault ? '<span class="profile-default-badge">Default</span>' : ''}
          </div>
          <div class="profile-item-description">
            ${this._escapeHtml(profile.description || profile.path)}
          </div>
        </div>
      `;

      // Click handler
      listItem.addEventListener('click', () => {
        this._selectProfile(profile.id);
      });

      // Double-click to confirm
      listItem.addEventListener('dblclick', () => {
        this._selectProfile(profile.id);
        this._confirmSelection();
      });

      profileList.appendChild(listItem);
    });

    // Show "no results" message if needed
    if (filteredProfiles.length === 0) {
      const noResults = document.createElement('li');
      noResults.className = 'profile-no-results';
      noResults.textContent = this._filterText ? 'No profiles found' : 'No profiles available';
      profileList.appendChild(noResults);
    }

    log(`🎯 [PROFILE-UI] Updated profile list: ${filteredProfiles.length} profiles`);
  }

  private _selectProfile(profileId: string): void {
    // Remove previous selection
    const previousSelected = this._container.querySelector('.profile-item.selected');
    previousSelected?.classList.remove('selected');

    // Add selection to new item
    const newSelected = this._container.querySelector(`[data-profile-id="${profileId}"]`);
    newSelected?.classList.add('selected');

    this._selectedProfileId = profileId;

    // Enable confirm button
    const confirmBtn = this._container.querySelector(
      '.profile-selector-confirm'
    ) as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }

    log('🎯 [PROFILE-UI] Selected profile:', profileId);
  }

  private _confirmSelection(): void {
    if (this._selectedProfileId && this._onProfileSelected) {
      this._onProfileSelected(this._selectedProfileId);
    }
    this.hide();
  }

  private _handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;

      case 'Enter':
        e.preventDefault();
        if (this._selectedProfileId) {
          this._confirmSelection();
        }
        break;

      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        this._navigateList(e.key === 'ArrowDown' ? 1 : -1);
        break;
    }
  }

  private _navigateList(direction: 1 | -1): void {
    const profileItems = Array.from(
      this._container.querySelectorAll('.profile-item:not(.profile-no-results)')
    ) as HTMLElement[];
    if (profileItems.length === 0) return;

    const currentIndex = profileItems.findIndex((item) => item.classList.contains('selected'));
    let newIndex = currentIndex + direction;

    // Wrap around
    if (newIndex < 0) {
      newIndex = profileItems.length - 1;
    } else if (newIndex >= profileItems.length) {
      newIndex = 0;
    }

    const newItem = profileItems[newIndex];
    if (newItem?.dataset.profileId) {
      this._selectProfile(newItem.dataset.profileId);

      // Scroll into view
      newItem.scrollIntoView({ block: 'nearest' });
    }
  }

  private _getProfileIcon(profile: ITerminalProfile): string {
    // Map profile icons to symbols or use default
    const iconMap: Record<string, string> = {
      'terminal-cmd': '⚫',
      'terminal-powershell': '🔷',
      'terminal-bash': '🟢',
      terminal: '▶️',
      'terminal-pwsh': '💙',
    };

    return iconMap[profile.icon || 'terminal'] || '▶️';
  }

  private _escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private _addStyles(): void {
    const styleId = 'profile-selector-styles';
    if (document.getElementById(styleId)) {
      return; // Styles already added
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .profile-selector-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .profile-selector-dialog {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        width: 480px;
        max-width: 90vw;
        max-height: 70vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      }

      .profile-selector-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .profile-selector-header h3 {
        margin: 0;
        color: var(--vscode-foreground);
        font-size: 14px;
        font-weight: 600;
      }

      .profile-selector-close {
        background: none;
        border: none;
        color: var(--vscode-foreground);
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        width: 24px;
        height: 24px;
        border-radius: 4px;
      }

      .profile-selector-close:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
      }

      .profile-selector-search {
        padding: 12px 16px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .profile-filter {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: inherit;
        font-size: 13px;
      }

      .profile-filter:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }

      .profile-list-container {
        flex: 1;
        overflow-y: auto;
        max-height: 300px;
      }

      .profile-list {
        list-style: none;
        margin: 0;
        padding: 8px 0;
      }

      .profile-item {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        cursor: pointer;
        border-radius: 0;
      }

      .profile-item:hover {
        background-color: var(--vscode-list-hoverBackground);
      }

      .profile-item.selected {
        background-color: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
      }

      .profile-item-icon {
        margin-right: 12px;
        font-size: 16px;
        width: 20px;
        text-align: center;
      }

      .profile-item-content {
        flex: 1;
      }

      .profile-item-name {
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .profile-item-description {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-top: 2px;
      }

      .profile-default-badge {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 2px 6px;
        border-radius: 9px;
        font-size: 10px;
        font-weight: 600;
      }

      .profile-no-results {
        padding: 16px;
        text-align: center;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }

      .profile-selector-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--vscode-panel-border);
      }

      .btn-secondary, .btn-primary {
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
      }

      .btn-secondary {
        background-color: transparent;
        border: 1px solid var(--vscode-button-border);
        color: var(--vscode-button-secondaryForeground);
      }

      .btn-secondary:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }

      .btn-primary {
        background-color: var(--vscode-button-background);
        border: 1px solid var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }

      .btn-primary:hover:not(:disabled) {
        background-color: var(--vscode-button-hoverBackground);
      }

      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;

    document.head.appendChild(style);
  }

  public dispose(): void {
    this._onProfileSelected = undefined;
    this._onClosed = undefined;
    this._container.textContent = ''; // Safe: clearing content
  }
}
