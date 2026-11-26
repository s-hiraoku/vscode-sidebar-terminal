import { GpuAccelerationMode } from '../types/shared';

const GPU_ACCELERATION_MODES: readonly GpuAccelerationMode[] = ['auto', 'on', 'off'];

const toGpuAccelerationMode = (value: unknown): GpuAccelerationMode =>
  GPU_ACCELERATION_MODES.includes(value as GpuAccelerationMode)
    ? (value as GpuAccelerationMode)
    : 'auto';

/**
 * Resolve the effective GPU acceleration mode for the WebView terminal.
 *
 * secondaryTerminal.gpuAcceleration wins when it is 'on' or 'off'; with 'auto'
 * it follows VS Code's terminal.integrated.gpuAcceleration, so users who had to
 * turn GPU rendering off for the built-in terminal get the same here (Issue #702).
 * Unknown values (e.g. the removed 'canvas') are treated as 'auto'.
 */
export function resolveGpuAcceleration(
  extensionValue: unknown,
  vscodeValue: unknown
): GpuAccelerationMode {
  const extensionMode = toGpuAccelerationMode(extensionValue);
  if (extensionMode !== 'auto') {
    return extensionMode;
  }
  return toGpuAccelerationMode(vscodeValue);
}
