/**
 * Platform detection utilities for WebView context.
 *
 * Uses Navigator.userAgentData (modern) with fallback to Navigator.userAgent (legacy).
 */

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: { platform?: string };
}

/**
 * Detect whether the current platform is macOS.
 */
export function isMacPlatform(): boolean {
  const nav = navigator as NavigatorWithUserAgentData;
  return nav.userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent);
}
