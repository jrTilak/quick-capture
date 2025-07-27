import html2canvas from "html2canvas"

let currentElement: HTMLElement | null = null

// Make sure the content script only runs once
if (!(window as any).quickCaptureLoaded) {
  ;(window as any).quickCaptureLoaded = true

  console.log("QuickCapture content script loaded")

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

    // Remove the indicator
    const indicator = document.getElementById("quickcapture-indicator")
    if (indicator) {
      indicator.remove()
    }

    console.log("Selection mode disabled")
  })

  // Add message listener for Chrome API screenshots
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message.type)

    if (message.type === "process-chrome-screenshot") {
      processChromeScreenshot(message.screenshot, message.rect, message.zoom)
        .then(() => {
          console.log("Chrome screenshot processed successfully")
          sendResponse({ success: true })
        })
        .catch((error) => {
          console.error("Chrome screenshot processing failed:", error)
          sendResponse({ success: false, error: error.message })
        })
      return true // Keep message channel open
    }
  })
}

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

  // Get the actual background color that's being rendered
  const actualBackgroundColor = getActualBackgroundColor(element)
  console.log("Detected actual background color:", actualBackgroundColor)

  const options = {
    backgroundColor: actualBackgroundColor,
    scale: 1,
    useCORS: true,
    allowTaint: true,
    logging: true,
    removeContainer: true,
    imageTimeout: 30000,
    x: 0,
    y: 0,
    width: element.offsetWidth,
    height: element.offsetHeight,
    onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
      console.log("Preparing cloned element for capture")
      applyInheritedBackgrounds(element, clonedElement)
      clonedElement.style.position = "static"
      clonedElement.style.visibility = "visible"
      clonedElement.style.opacity = "1"
      clonedElement.style.display = "block"

      const allChildren = clonedElement.querySelectorAll("*")
      allChildren.forEach((child: Element) => {
        const childEl = child as HTMLElement
        childEl.style.visibility = "visible"
        childEl.style.opacity = "1"

        const originalChild = findCorrespondingElement(
          element,
          clonedElement,
          child
        )
        if (originalChild) {
          const childBg = getActualBackgroundColor(originalChild as HTMLElement)
          if (
            childBg &&
            childBg !== "rgba(0, 0, 0, 0)" &&
            childBg !== "transparent"
          ) {
            childEl.style.backgroundColor = childBg
          }
        }
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
  const actualBackground = getActualBackgroundColor(element)

  const options = {
    backgroundColor: actualBackground,
    scale: 1,
    logging: true,
    useCORS: false,
    allowTaint: false,
    width: Math.min(element.offsetWidth, 2000),
    height: Math.min(element.offsetHeight, 2000),
    onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
      clonedElement.style.backgroundColor = actualBackground
      const allElements = clonedElement.querySelectorAll("*")
      allElements.forEach((el: Element) => {
        const htmlEl = el as HTMLElement
        const elStyle = window.getComputedStyle(htmlEl)
        if (
          !elStyle.backgroundColor ||
          elStyle.backgroundColor === "rgba(0, 0, 0, 0)"
        ) {
          htmlEl.style.backgroundColor = "inherit"
        }
      })
    }
  }

  console.log("Trying fallback html2canvas with background:", actualBackground)
  const canvas = await html2canvas(element, options)

  if (isCanvasBlank(canvas)) {
    throw new Error("Fallback canvas is also blank")
  }

  await downloadCanvas(canvas, "html2canvas-fallback")
}

async function captureWithChromeAPI(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const scrollX = window.pageXOffset
  const scrollY = window.pageYOffset

  console.log("Element rect:", rect)

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
        console.log("Chrome API response:", response)
        if (response && response.success) {
          showNotification("Element captured with Chrome API!", "success")
          resolve()
        } else {
          reject(
            new Error(
              `Chrome API capture failed: ${response?.error || "Unknown error"}`
            )
          )
        }
      }
    )
  })
}

async function processChromeScreenshot(
  screenshot: string,
  rect: any,
  zoom: number
) {
  console.log("Processing Chrome screenshot, rect:", rect, "zoom:", zoom)

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Could not get canvas context")
  }

  return new Promise<void>((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      console.log("Screenshot image loaded:", img.width, "x", img.height)

      // Calculate scaled coordinates
      const scale = zoom * window.devicePixelRatio
      const x = rect.x * scale
      const y = rect.y * scale
      const width = rect.width * scale
      const height = rect.height * scale

      console.log("Cropping coordinates:", { x, y, width, height, scale })

      // Set canvas size
      canvas.width = width
      canvas.height = height

      // Draw cropped portion
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height)

      // Download the result
      canvas.toBlob((blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL("image/png", 1.0)
          console.log("Sending download request for Chrome API capture")

          chrome.runtime.sendMessage(
            {
              type: "download-image",
              dataUrl: dataUrl,
              filename: `element-chrome-api-${Date.now()}.png`
            },
            (response) => {
              console.log("Download response:", response)
              if (response && response.success) {
                showNotification("Element captured with Chrome API!", "success")
                resolve()
              } else {
                reject(
                  new Error(
                    `Download failed: ${response?.error || "Unknown error"}`
                  )
                )
              }
            }
          )
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

async function downloadCanvas(canvas: HTMLCanvasElement, method: string) {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const dataUrl = canvas.toDataURL("image/png", 1.0)
        console.log("Sending download request for", method)

        chrome.runtime.sendMessage(
          {
            type: "download-image",
            dataUrl: dataUrl,
            filename: `element-${method}-${Date.now()}.png`
          },
          (response) => {
            console.log("Download response:", response)
            if (response && response.success) {
              showNotification(
                `Element captured successfully with ${method}!`,
                "success"
              )
              console.log(
                `Successfully captured with ${method}: ${canvas.width}x${canvas.height}`
              )
              resolve()
            } else {
              reject(
                new Error(
                  `Download failed: ${response?.error || "Unknown error"}`
                )
              )
            }
          }
        )
      } else {
        reject(new Error(`Failed to create blob from ${method} canvas`))
      }
    }, "image/png")
  })
}

function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d")
  if (!ctx) return true

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (a > 0 && (r !== 255 || g !== 255 || b !== 255)) {
      return false
    }
  }

  console.log("Canvas appears to be blank")
  return true
}

function getActualBackgroundColor(element: HTMLElement): string {
  const computedStyle = window.getComputedStyle(element)
  let backgroundColor = computedStyle.backgroundColor

  console.log(`Element ${element.tagName} background:`, backgroundColor)

  if (
    !backgroundColor ||
    backgroundColor === "rgba(0, 0, 0, 0)" ||
    backgroundColor === "transparent"
  ) {
    let parent = element.parentElement

    while (parent && parent !== document.body) {
      const parentStyle = window.getComputedStyle(parent)
      const parentBg = parentStyle.backgroundColor

      console.log(`Parent ${parent.tagName} background:`, parentBg)

      if (
        parentBg &&
        parentBg !== "rgba(0, 0, 0, 0)" &&
        parentBg !== "transparent"
      ) {
        backgroundColor = parentBg
        break
      }
      parent = parent.parentElement
    }

    if (
      !backgroundColor ||
      backgroundColor === "rgba(0, 0, 0, 0)" ||
      backgroundColor === "transparent"
    ) {
      const bodyStyle = window.getComputedStyle(document.body)
      const htmlStyle = window.getComputedStyle(document.documentElement)

      backgroundColor =
        bodyStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
          ? bodyStyle.backgroundColor
          : htmlStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
            ? htmlStyle.backgroundColor
            : "#ffffff"
    }
  }

  console.log("Final background color:", backgroundColor)
  return backgroundColor || "#ffffff"
}

function applyInheritedBackgrounds(
  originalElement: HTMLElement,
  clonedElement: HTMLElement
) {
  const actualBg = getActualBackgroundColor(originalElement)
  clonedElement.style.backgroundColor = actualBg

  const originalStyle = window.getComputedStyle(originalElement)

  if (
    originalStyle.backgroundImage &&
    originalStyle.backgroundImage !== "none"
  ) {
    clonedElement.style.backgroundImage = originalStyle.backgroundImage
  }

  if (originalStyle.backgroundSize) {
    clonedElement.style.backgroundSize = originalStyle.backgroundSize
  }

  if (originalStyle.backgroundRepeat) {
    clonedElement.style.backgroundRepeat = originalStyle.backgroundRepeat
  }

  if (originalStyle.backgroundPosition) {
    clonedElement.style.backgroundPosition = originalStyle.backgroundPosition
  }

  console.log("Applied backgrounds to cloned element")
}

function findCorrespondingElement(
  originalParent: HTMLElement,
  clonedElement: HTMLElement,
  clonedChild: Element
): Element | null {
  try {
    const originalChildren = Array.from(originalParent.querySelectorAll("*"))
    const clonedChildren = Array.from(clonedElement.querySelectorAll("*"))

    const clonedIndex = clonedChildren.indexOf(clonedChild)
    if (clonedIndex >= 0 && clonedIndex < originalChildren.length) {
      return originalChildren[clonedIndex]
    }
  } catch (error) {
    console.log("Could not find corresponding element:", error)
  }
  return null
}

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
