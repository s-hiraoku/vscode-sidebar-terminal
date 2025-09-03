/**
 * Terminal Links Service - VS Code standard link detection and activation
 * Detects and handles URLs, file paths, and other links in terminal output
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { terminal as log } from '../utils/logger';

export interface TerminalLink {
  id: string;
  terminalId: string;
  text: string;
  startIndex: number;
  endIndex: number;
  line: number;
  type: 'url' | 'file' | 'folder' | 'email' | 'custom';
  activationData?: any;
  tooltip?: string;
}

export interface LinkDetectionSettings {
  enabled: boolean;
  allowedSchemes: string[];
  detectFileLinks: boolean;
  detectWebLinks: boolean;
  detectEmailLinks: boolean;
  maxLinksPerLine: number;
}

export class TerminalLinksService {
  private readonly _links = new Map<string, TerminalLink[]>();
  private readonly _linkProviders: vscode.TerminalLinkProvider[] = [];
  private readonly _linkEmitter = new vscode.EventEmitter<{ terminalId: string; links: TerminalLink[] }>();
  private _settings: LinkDetectionSettings;
  private _workspaceRoot: string;

  public readonly onLinksDetected = this._linkEmitter.event;

  constructor() {
    this._settings = this.loadSettings();
    this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    // Monitor configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('secondaryTerminal.links') ||
          e.affectsConfiguration('terminal.integrated.allowedLinkSchemes')) {
        this._settings = this.loadSettings();
        log('🔗 [LINKS] Settings updated:', this._settings);
      }
    });
  }

  /**
   * Load link detection settings from VS Code configuration
   */
  private loadSettings(): LinkDetectionSettings {
    const config = vscode.workspace.getConfiguration();
    
    // Use VS Code standard allowed schemes setting
    const allowedSchemes = config.get<string[]>('terminal.integrated.allowedLinkSchemes', [
      'http', 'https', 'file', 'mailto', 'vscode', 'vscode-insiders'
    ]);
    
    const sidebarConfig = config.get<any>('secondaryTerminal.links', {});
    
    return {
      enabled: sidebarConfig.enabled ?? true,
      allowedSchemes: sidebarConfig.allowedSchemes ?? allowedSchemes,
      detectFileLinks: sidebarConfig.detectFileLinks ?? true,
      detectWebLinks: sidebarConfig.detectWebLinks ?? true,
      detectEmailLinks: sidebarConfig.detectEmailLinks ?? true,
      maxLinksPerLine: sidebarConfig.maxLinksPerLine ?? 10,
    };
  }

  /**
   * Register a custom terminal link provider
   */
  public registerLinkProvider(provider: vscode.TerminalLinkProvider): vscode.Disposable {
    this._linkProviders.push(provider);
    log('🔗 [LINKS] Registered custom link provider');
    
    return {
      dispose: () => {
        const index = this._linkProviders.indexOf(provider);
        if (index >= 0) {
          this._linkProviders.splice(index, 1);
          log('🔗 [LINKS] Disposed custom link provider');
        }
      }
    };
  }

  /**
   * Detect links in terminal line text
   */
  public async detectLinks(terminalId: string, line: number, text: string): Promise<TerminalLink[]> {
    if (!this._settings.enabled || !text.trim()) {
      return [];
    }

    const links: TerminalLink[] = [];
    
    // Built-in link detection
    if (this._settings.detectWebLinks) {
      links.push(...this.detectWebLinks(terminalId, line, text));
    }
    
    if (this._settings.detectFileLinks) {
      links.push(...await this.detectFileLinks(terminalId, line, text));
    }
    
    if (this._settings.detectEmailLinks) {
      links.push(...this.detectEmailLinks(terminalId, line, text));
    }

    // Custom link providers
    for (const provider of this._linkProviders) {
      try {
        if (provider.provideTerminalLinks) {
          const customLinks = await provider.provideTerminalLinks(
            { line: text, terminal: undefined as any } as any, // Mock context
            undefined as any // Mock token
          );
          
          if (customLinks) {
            links.push(...customLinks.map((link, index) => ({
              id: `${terminalId}-${line}-custom-${index}`,
              terminalId,
              text: text.substring(link.startIndex, link.startIndex + link.length),
              startIndex: link.startIndex,
              endIndex: link.startIndex + link.length,
              line,
              type: 'custom' as const,
              activationData: link,
              tooltip: link.tooltip,
            })));
          }
        }
      } catch (error) {
        log(`⚠️ [LINKS] Custom link provider error: ${error}`);
      }
    }

    // Limit links per line for performance
    const limitedLinks = links.slice(0, this._settings.maxLinksPerLine);
    
    if (limitedLinks.length > 0) {
      const terminalLinks = this._links.get(terminalId) || [];
      // Remove existing links for this line
      const filteredLinks = terminalLinks.filter(l => l.line !== line);
      filteredLinks.push(...limitedLinks);
      this._links.set(terminalId, filteredLinks);
      
      this._linkEmitter.fire({
        terminalId,
        links: [...filteredLinks],
      });
    }

    return limitedLinks;
  }

  /**
   * Detect web URLs in text
   */
  private detectWebLinks(terminalId: string, line: number, text: string): TerminalLink[] {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const links: TerminalLink[] = [];
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];
      const scheme = new URL(url).protocol.slice(0, -1);
      
      if (this._settings.allowedSchemes.includes(scheme)) {
        links.push({
          id: `${terminalId}-${line}-url-${match.index}`,
          terminalId,
          text: url,
          startIndex: match.index,
          endIndex: match.index + url.length,
          line,
          type: 'url',
          tooltip: `Open ${url}`,
        });
      }
    }

    return links;
  }

  /**
   * Detect file and folder paths in text
   */
  private async detectFileLinks(terminalId: string, line: number, text: string): Promise<TerminalLink[]> {
    // Match various file path patterns
    const filePatterns = [
      // Absolute paths
      /(?:^|\s)(\/[^\s]+)/g,
      // Relative paths with common extensions
      /(?:^|\s)((?:\.{1,2}\/)?[^\s]*\.(?:js|ts|json|md|txt|py|java|c|cpp|h|hpp|rs|go|rb|php|css|html|xml|yaml|yml|toml|ini|cfg|conf|log))/gi,
      // Quoted paths
      /"([^"]+)"/g,
      /'([^']+)'/g,
    ];

    const links: TerminalLink[] = [];

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const filePath = match[1];
        if (!filePath) continue;
        
        const resolvedPath = path.isAbsolute(filePath) 
          ? filePath 
          : path.resolve(this._workspaceRoot, filePath);

        try {
          const stat = await fs.promises.stat(resolvedPath);
          const isDirectory = stat.isDirectory();
          
          links.push({
            id: `${terminalId}-${line}-file-${match.index}`,
            terminalId,
            text: filePath,
            startIndex: match.index + (match[0].length - filePath.length),
            endIndex: match.index + match[0].length,
            line,
            type: isDirectory ? 'folder' : 'file',
            activationData: { path: resolvedPath },
            tooltip: `${isDirectory ? 'Open folder' : 'Open file'}: ${resolvedPath}`,
          });
        } catch {
          // File doesn't exist, skip
        }
      }
    }

    return links;
  }

  /**
   * Detect email addresses in text
   */
  private detectEmailLinks(terminalId: string, line: number, text: string): TerminalLink[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const links: TerminalLink[] = [];
    let match;

    while ((match = emailRegex.exec(text)) !== null) {
      const email = match[0];
      
      if (this._settings.allowedSchemes.includes('mailto')) {
        links.push({
          id: `${terminalId}-${line}-email-${match.index}`,
          terminalId,
          text: email,
          startIndex: match.index,
          endIndex: match.index + email.length,
          line,
          type: 'email',
          tooltip: `Send email to ${email}`,
        });
      }
    }

    return links;
  }

  /**
   * Activate a terminal link
   */
  public async activateLink(link: TerminalLink): Promise<boolean> {
    try {
      log(`🔗 [LINKS] Activating link: ${link.text} (${link.type})`);
      
      switch (link.type) {
        case 'url':
          return await vscode.env.openExternal(vscode.Uri.parse(link.text));
          
        case 'file':
          if (link.activationData?.path) {
            const document = await vscode.workspace.openTextDocument(link.activationData.path);
            await vscode.window.showTextDocument(document);
            return true;
          }
          break;
          
        case 'folder':
          if (link.activationData?.path) {
            const uri = vscode.Uri.file(link.activationData.path);
            await vscode.commands.executeCommand('revealFileInOS', uri);
            return true;
          }
          break;
          
        case 'email':
          return await vscode.env.openExternal(vscode.Uri.parse(`mailto:${link.text}`));
          
        case 'custom':
          if (link.activationData && this._linkProviders.length > 0) {
            // Find the provider that created this link and handle it
            for (const provider of this._linkProviders) {
              if (provider.handleTerminalLink) {
                try {
                  await provider.handleTerminalLink(link.activationData);
                  return true;
                } catch (error) {
                  log(`⚠️ [LINKS] Custom link activation error: ${error}`);
                }
              }
            }
          }
          break;
      }
      
      return false;
    } catch (error) {
      log(`❌ [LINKS] Link activation failed: ${error}`);
      return false;
    }
  }

  /**
   * Get links for a terminal
   */
  public getLinks(terminalId: string): TerminalLink[] {
    return this._links.get(terminalId) || [];
  }

  /**
   * Clear links for a terminal
   */
  public clearLinks(terminalId: string): void {
    this._links.delete(terminalId);
    this._linkEmitter.fire({
      terminalId,
      links: [],
    });
    log(`🔗 [LINKS] Cleared links for terminal ${terminalId}`);
  }

  /**
   * Get current link detection settings
   */
  public getSettings(): LinkDetectionSettings {
    return { ...this._settings };
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._linkEmitter.dispose();
    this._links.clear();
    this._linkProviders.length = 0;
    log('🧹 [LINKS] Service disposed');
  }
}