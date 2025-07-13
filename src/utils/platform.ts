import * as vscode from 'vscode';
import { terminal as log } from './logger';

export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
  description: string;
}

export function getPlatformInfo(): PlatformInfo {
  const platform = process.platform;
  const arch = process.arch;

  const info: PlatformInfo = {
    platform,
    arch,
    isWindows: platform === 'win32',
    isMacOS: platform === 'darwin',
    isLinux: platform === 'linux',
    description: `${platform}-${arch}`,
  };

  log('🔍 [PLATFORM] Platform info:', info);
  return info;
}

export function validatePlatformSupport(): { supported: boolean; message?: string } {
  const { platform, arch } = getPlatformInfo();

  // Check for supported platforms
  const supportedPlatforms = ['win32', 'darwin', 'linux'];
  if (!supportedPlatforms.includes(platform)) {
    return {
      supported: false,
      message: `Unsupported platform: ${platform}. Supported platforms: ${supportedPlatforms.join(', ')}`,
    };
  }

  // Check for supported architectures
  const supportedArchs = ['x64', 'arm64', 'armhf'];
  if (!supportedArchs.includes(arch)) {
    return {
      supported: false,
      message: `Unsupported architecture: ${arch}. Supported architectures: ${supportedArchs.join(', ')}`,
    };
  }

  return { supported: true };
}

export function getNodePtyRequirements(): string[] {
  const { isWindows, isMacOS } = getPlatformInfo();
  const requirements: string[] = [];

  if (isWindows) {
    requirements.push(
      'Windows Build Tools (Visual Studio or Build Tools for Visual Studio)',
      'Python 2.7 or 3.x',
      'Windows SDK'
    );
  } else if (isMacOS) {
    requirements.push('Xcode Command Line Tools', 'Python 2.7 or 3.x');
  } else {
    requirements.push('build-essential package', 'Python 2.7 or 3.x', 'make and g++ compiler');
  }

  return requirements;
}

export async function showPlatformDiagnostics(): Promise<void> {
  const platformInfo = getPlatformInfo();
  const platformSupport = validatePlatformSupport();
  const requirements = getNodePtyRequirements();

  const diagnosticsInfo = [
    `Platform: ${platformInfo.description}`,
    `Support Status: ${platformSupport.supported ? '✅ Supported' : '❌ Not Supported'}`,
    platformSupport.message ? `Issue: ${platformSupport.message}` : '',
    '',
    'Required for native module compilation:',
    ...requirements.map((req) => `• ${req}`),
  ].filter(Boolean);

  const message = diagnosticsInfo.join('\n');

  await vscode.window
    .showInformationMessage(
      'Platform Diagnostics',
      { modal: true, detail: message },
      'Copy to Clipboard',
      'Close'
    )
    .then((selection) => {
      if (selection === 'Copy to Clipboard') {
        void vscode.env.clipboard.writeText(message);
        void vscode.window.showInformationMessage('Diagnostics copied to clipboard');
      }
    });
}
