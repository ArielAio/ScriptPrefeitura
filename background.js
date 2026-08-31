const HOST = "br.gov.sjduaspontes.scriptprefeitura.ocr";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ocr") return false;

  chrome.runtime.sendNativeMessage(HOST, message.payload, (response) => {
    const error = chrome.runtime.lastError;
    sendResponse(error ? { ok: false, error: error.message } : response);
  });
  return true;
});
