// popup.tsx
import React from "react"

const Popup = () => {
  const startCapture = async () => {
    console.log("Start capture")

    if (!chrome?.scripting) {
      console.error("chrome.scripting API not available")
      alert("Extension permissions not properly set up")
      return
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab.id) {
        console.error("No active tab found")
        return
      }

      // Inject the content script if it's not already there
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Enable selection mode
          (window as any).selectionMode = true;
          console.log("Selection mode enabled")

          // Add visual indicator that selection mode is active
          const indicator = document.createElement('div')
          indicator.id = 'quickcapture-indicator'
          indicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #2563eb;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            pointer-events: none;
          `
          indicator.textContent = '🖱️ Click on any element to capture it'
          document.body.appendChild(indicator)

          // Remove indicator when selection mode is disabled
          const checkMode = () => {
            if (!(window as any).selectionMode) {
              const existingIndicator = document.getElementById('quickcapture-indicator')
              if (existingIndicator) {
                existingIndicator.remove()
              }
            } else {
              setTimeout(checkMode, 100)
            }
          }
          setTimeout(checkMode, 100)
        }
      })

      // Close popup
      window.close()
    } catch (error) {
      console.error("Error executing script:", error)
    }
  }

  return (
    <div
      style={{
        width: 250,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        background: "#ffffff"
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{
          margin: 0,
          fontSize: 20,
          fontWeight: "600",
          color: "#1f2937",
          marginBottom: 8
        }}>
          📸 QuickCapture
        </h1>
        <p style={{
          margin: 0,
          fontSize: 14,
          color: "#6b7280",
          lineHeight: "1.4"
        }}>
          Capture any element on the page as an image
        </p>
      </div>

      <button
        onClick={startCapture}
        style={{
          padding: "12px 16px",
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 16,
          fontWeight: "500",
          transition: "background-color 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = "#1d4ed8"
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = "#2563eb"
        }}
      >
        Start Capturing
      </button>

      <div style={{
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        lineHeight: "1.4"
      }}>
        Click the button, then hover and click on any element to capture it as an image
      </div>
    </div>
  )
}

export default Popup