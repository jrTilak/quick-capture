// background.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "download-image") {
    chrome.downloads.download({
      url: message.dataUrl,
      filename: message.filename || `element-capture-${Date.now()}.png`,
      saveAs: true
    })
    sendResponse({ success: true })
  }

  if (message.type === "capture-visible-tab") {
    handleVisibleTabCapture(message, sender.tab?.id)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Keep message channel open for async response
  }
})

async function handleVisibleTabCapture(
  message: any,
  tabId: number | undefined
) {
  if (!tabId) {
    throw new Error("No tab ID available")
  }

  try {
    // Capture the visible tab
    const screenshot = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png",
      quality: 100
    })

    // Get zoom level for accurate cropping
    const zoom = await chrome.tabs.getZoom(tabId)

    // Send screenshot back to content script for cropping
    await chrome.tabs.sendMessage(tabId, {
      type: "process-chrome-screenshot",
      screenshot,
      rect: message.rect,
      zoom
    })

    return { success: true }
  } catch (error) {
    console.error("Chrome API screenshot failed:", error)
    throw error
  }
}
