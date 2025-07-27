chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.type)

  if (message.type === "download-image") {
    console.log("Processing download request")

    try {
      chrome.downloads.download(
        {
          url: message.dataUrl,
          filename: message.filename || `element-capture-${Date.now()}.png`,
          saveAs: false // Changed to false for automatic saving
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error("Download failed:", chrome.runtime.lastError)
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message
            })
          } else {
            console.log("Download started with ID:", downloadId)
            sendResponse({ success: true, downloadId })
          }
        }
      )
    } catch (error) {
      console.error("Download error:", error)
      sendResponse({ success: false, error: error.message })
    }

    return true // Keep message channel open
  }

  if (message.type === "capture-visible-tab") {
    console.log("Processing visible tab capture")

    handleVisibleTabCapture(message, sender.tab?.id)
      .then((result) => {
        console.log("Visible tab capture result:", result)
        sendResponse(result)
      })
      .catch((error) => {
        console.error("Visible tab capture error:", error)
        sendResponse({ success: false, error: error.message })
      })

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
    console.log("Capturing visible tab:", tabId)

    // Capture the visible tab
    const screenshot = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png",
      quality: 100
    })

    console.log("Screenshot captured, length:", screenshot.length)

    // Get zoom level for accurate cropping
    const zoom = await chrome.tabs.getZoom(tabId)
    console.log("Tab zoom level:", zoom)

    // Send screenshot back to content script for cropping
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "process-chrome-screenshot",
      screenshot,
      rect: message.rect,
      zoom
    })

    console.log("Screenshot processing response:", response)

    return { success: true }
  } catch (error) {
    console.error("Chrome API screenshot failed:", error)
    throw error
  }
}
