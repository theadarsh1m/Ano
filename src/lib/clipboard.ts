/**
 * Reliable copy-to-clipboard helper supporting modern Navigator API with execCommand fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard failed, trying fallback:", err);
  }

  try {
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      
      // Prevent scrolling to bottom of page in MS Edge.
      textarea.style.position = "fixed";
      textarea.style.left = "0";
      textarea.style.top = "0";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      
      // iOS requires these for execCommand('copy') to work
      textarea.contentEditable = 'true';
      textarea.readOnly = false;

      document.body.appendChild(textarea);
      
      // iOS specific selection
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        textarea.setSelectionRange(0, 999999);
      } else {
        textarea.select();
      }

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    }
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }

  return false;
}
