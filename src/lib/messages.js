export async function sendRuntimeMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, payload });
}
