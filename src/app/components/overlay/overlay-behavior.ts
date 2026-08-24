export function shouldPreventOverlayDismiss(dismissible: boolean) {
  return !dismissible;
}

export function handleOverlayOpenChange(open: boolean, dismissible: boolean, onClose: () => void) {
  if (!open && dismissible) onClose();
}

export function shouldRestoreOverlayFocus(isMounted: boolean, isConnected: boolean) {
  return !isMounted && isConnected;
}
