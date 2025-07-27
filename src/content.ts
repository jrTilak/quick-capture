// content.ts
import html2canvas from "html2canvas"

let currentElement: HTMLElement | null = null

document.addEventListener("mouseover", (e) => {
  if (!(window as any).selectionMode) return

  const el = e.target as HTMLElement
  console.log("Hovered over:", el)

  if (currentElement && currentElement !== el) {
    currentElement.style.outline = ""
    console.log("Removed outline from previous element")
  }

  currentElement = el
  currentElement.style.outline = "2px solid red"
  console.log("Added outline to current element")
})

document.addEventListener("mouseout", (e) => {
  if (!(window as any).selectionMode) return

  const el = e.target as HTMLElement
  el.style.outline = ""
  console.log("Mouse out from:", el)
})

document.addEventListener("click", async (e) => {
  if (!(window as any).selectionMode || !currentElement) return

  e.preventDefault()
  e.stopPropagation()

  console.log("Clicked element:", currentElement)

  // Show loading indicator
  showNotification("Capturing element...", "info")

  try {
    // Try multiple capture methods
    await captureElementMultiMethod(currentElement)
  } catch (error) {
    console.error("All capture methods failed:", error)
    showNotification("Failed to capture element", "error")
  }

  currentElement.style.outline = ""
  currentElement = null
  ;(window as any).selectionMode = false

  console.log("Selection mode disabled")
})

async function captureElementMultiMethod(element: HTMLElement) {
  console.log(
    "Starting multi-method capture for:",
    element.tagName,
    element.className
  )

  // Method 1: Try html2canvas with optimal settings
  try {
    console.log("Trying Method 1: html2canvas optimized")
    await captureWithHtml2CanvasOptimized(element)
    return
  } catch (error) {
    console.log("Method 1 failed:", error)
  }

  // Method 2: Try html2canvas with fallback settings
  try {
    console.log("Trying Method 2: html2canvas fallback")
    await captureWithHtml2CanvasFallback(element)
    return
  } catch (error) {
    console.log("Method 2 failed:", error)
  }

  // Method 3: Try Chrome's native screenshot API
  try {
    console.log("Trying Method 3: Chrome native screenshot")
    await captureWithChromeAPI(element)
    return
  } catch (error) {
    console.log("Method 3 failed:", error)
  }

  throw new Error("All capture methods failed")
}

async function captureWithHtml2CanvasOptimized(element: HTMLElement) {
  // Remove outline temporarily
  const originalOutline = element.style.outline
  element.style.outline = "none"

  // Wait for any animations/transitions to complete
  await new Promise((resolve) => setTimeout(resolve, 100))

  const options = {
    backgroundColor: null,
    scale: 1, // Lower scale to avoid memory issues
    useCORS: true,
    allowTaint: true,
    logging: true,
    removeContainer: true,
    imageTimeout: 30000,
    // Capture the element with some padding
    x: 0,
    y: 0,
    width: element.offsetWidth,
    height: element.offsetHeight,
    onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
      console.log("Preparing cloned element for capture")

      // Ensure element is visible
      clonedElement.style.position = "static"
      clonedElement.style.visibility = "visible"
      clonedElement.style.opacity = "1"
      clonedElement.style.display = "block"

      // Fix any potential styling issues
      const computedStyle = window.getComputedStyle(element)
      clonedElement.style.backgroundColor =
        computedStyle.backgroundColor || "#ffffff"
      clonedElement.style.color = computedStyle.color || "#000000"

      // Force render all child elements
      const allChildren = clonedElement.querySelectorAll("*")
      allChildren.forEach((child: Element) => {
        const childEl = child as HTMLElement
        childEl.style.visibility = "visible"
        childEl.style.opacity = "1"
      })
    }
  }

  console.log("Starting html2canvas with options:", options)
  const canvas = await html2canvas(element, options)

  // Restore outline
  element.style.outline = originalOutline

  console.log(`Canvas created: ${canvas.width}x${canvas.height}`)

  // Check if canvas is blank
  if (isCanvasBlank(canvas)) {
    throw new Error("Canvas is blank - no content captured")
  }

  await downloadCanvas(canvas, "html2canvas-optimized")
}

async function captureWithHtml2CanvasFallback(element: HTMLElement) {
  // Very simple options
  const options = {
    backgroundColor: "#ffffff",
    scale: 1,
    logging: true,
    useCORS: false,
    allowTaint: false,
    width: Math.min(element.offsetWidth, 2000), // Limit size
    height: Math.min(element.offsetHeight, 2000)
  }

  console.log("Trying fallback html2canvas")
  const canvas = await html2canvas(element, options)

  if (isCanvasBlank(canvas)) {
    throw new Error("Fallback canvas is also blank")
  }

  await downloadCanvas(canvas, "html2canvas-fallback")
}

async function captureWithChromeAPI(element: HTMLElement) {
  // Get element position relative to viewport
  const rect = element.getBoundingClientRect()
  const scrollX = window.pageXOffset
  const scrollY = window.pageYOffset

  console.log("Element rect:", rect)

  // Request screenshot from background script
  return new Promise<void>((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "capture-visible-tab",
        rect: {
          x: rect.left + scrollX,
          y: rect.top + scrollY,
          width: rect.width,
          height: rect.height
        }
      },
      (response) => {
        if (response && response.success) {
          showNotification("Element captured with Chrome API!", "success")
          resolve()
        } else {
          reject(new Error("Chrome API capture failed"))
        }
      }
    )
  })
}

function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d")
  if (!ctx) return true

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  // Check if all pixels are transparent or white
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    // If we find any non-white, non-transparent pixel, canvas is not blank
    if (a > 0 && (r !== 255 || g !== 255 || b !== 255)) {
      return false
    }
  }

  console.log("Canvas appears to be blank")
  return true
}

async function downloadCanvas(canvas: HTMLCanvasElement, method: string) {
  canvas.toBlob((blob) => {
    if (blob) {
      const dataUrl = canvas.toDataURL("image/png", 1.0)

      chrome.runtime.sendMessage({
        type: "download-image",
        dataUrl: dataUrl,
        filename: `element-${method}-${Date.now()}.png`
      })

      showNotification(
        `Element captured successfully with ${method}!`,
        "success"
      )
      console.log(
        `Successfully captured with ${method}: ${canvas.width}x${canvas.height}`
      )
    } else {
      throw new Error(`Failed to create blob from ${method} canvas`)
    }
  }, "image/png")
}

// Add debugging function to inspect element
function debugElement(element: HTMLElement) {
  const computedStyle = window.getComputedStyle(element)
  console.log("Element debug info:", {
    tagName: element.tagName,
    className: element.className,
    id: element.id,
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
    backgroundColor: computedStyle.backgroundColor,
    color: computedStyle.color,
    display: computedStyle.display,
    visibility: computedStyle.visibility,
    opacity: computedStyle.opacity,
    position: computedStyle.position
  })
}

// Add message listener for Chrome API screenshots
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "process-chrome-screenshot") {
    processChromeScreenshot(message.screenshot, message.rect, message.zoom)
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Chrome screenshot processing failed:", error)
        sendResponse({ success: false })
      })
    return true // Keep message channel open
  }
})

async function processChromeScreenshot(
  screenshot: string,
  rect: any,
  zoom: number
) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Could not get canvas context")
  }

  return new Promise<void>((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      // Calculate scaled coordinates
      const scale = zoom * window.devicePixelRatio
      const x = rect.x * scale
      const y = rect.y * scale
      const width = rect.width * scale
      const height = rect.height * scale

      // Set canvas size
      canvas.width = width
      canvas.height = height

      // Draw cropped portion
      ctx.drawImage(
        img,
        x,
        y,
        width,
        height, // Source rectangle
        0,
        0,
        width,
        height // Destination rectangle
      )

      // Download the result
      canvas.toBlob((blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL("image/png", 1.0)

          chrome.runtime.sendMessage({
            type: "download-image",
            dataUrl: dataUrl,
            filename: `element-chrome-api-${Date.now()}.png`
          })

          showNotification("Element captured with Chrome API!", "success")
          resolve()
        } else {
          reject(new Error("Failed to create blob from Chrome API canvas"))
        }
      }, "image/png")
    }

    img.onerror = () =>
      reject(new Error("Failed to load Chrome API screenshot"))
    img.src = screenshot
  })
}

// Utility function to show notifications
function showNotification(
  message: string,
  type: "success" | "error" | "info" = "success"
) {
  const notification = document.createElement("div")
  const bgColor =
    type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
  `

  if (!document.getElementById("quickcapture-styles")) {
    const style = document.createElement("style")
    style.id = "quickcapture-styles"
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }

  notification.textContent = message
  document.body.appendChild(notification)

  const duration = type === "info" ? 5000 : 3000
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-out"
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, duration)
}
