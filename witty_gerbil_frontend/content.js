/***************************************************
 * content.js - FINAL VERSION with enhanced sendMessage &
 *              validation and automated retry logic
 ***************************************************/
(function() {
    "use strict";

    console.log("LLM Chat Automation Content Script Loaded.");

    // =========================================================================
    // 1. CONFIG & CONSTANTS (Enhanced)
    // =========================================================================

    const BACKEND_API_BASE_URL = "http://localhost:8000/api/v1/chrome_extention_backend_prompter";

    // LocalStorage keys
    const LS_RESULTS_FILE_PATH_KEY = "llm_results_file_path";
    const LS_USER_SELECTOR_KEY = "llm_user_selector";
    const LS_ASSISTANT_SELECTOR_KEY = "llm_assistant_selector";
    const LS_INPUT_SELECTOR_KEY = "llm_input_selector";
    const LS_WAIT_MODE_KEY = "llm_wait_mode"; // new: for time-based vs auto-detect
    const LS_SUBMIT_SELECTOR_KEY = "llm_submit_selector";

    // Stored user preferences
    let resultsFilePath = localStorage.getItem(LS_RESULTS_FILE_PATH_KEY) || "";
    let userMessageSelector = localStorage.getItem(LS_USER_SELECTOR_KEY) || "";
    let assistantMessageSelector = localStorage.getItem(LS_ASSISTANT_SELECTOR_KEY) || "";
    let inputSelector = localStorage.getItem(LS_INPUT_SELECTOR_KEY) || "";
    let submitButtonSelector = localStorage.getItem(LS_SUBMIT_SELECTOR_KEY) || "";

    // "Wait mode" preference
    let waitMode = localStorage.getItem(LS_WAIT_MODE_KEY) || "auto-detect";

    // Common input selectors across different platforms
    const COMMON_INPUT_SELECTORS = [
        "textarea[placeholder*='message' i]",
        "textarea[placeholder*='send' i]",
        "textarea[placeholder*='chat' i]",
        "textarea[aria-label*='chat' i]",
        "textarea[aria-label*='message' i]",
        "textarea.chat-input",
        "div[contenteditable='true']",
        "div[role='textbox']",
        ".chat-input textarea",
        "#prompt-textarea",
        "#chat-input"
    ];

    // Common message container selectors
    const COMMON_MESSAGE_CONTAINERS = [
        "[class*='conversation-']",
        "[class*='chat-']",
        "[class*='messages-']",
        "[role='log']",
        ".chat-container",
        "#chat-container",
        "#messages",
        ".messages"
    ];

    // =========================================================================
    // 2. SELECTOR VALIDATION AND BUILDING
    // =========================================================================

    function isValidSelector(selector) {
        try {
            document.querySelector(selector);
            return true;
        } catch (e) {
            return false;
        }
    }

    function sanitizeClassName(className) {
        return className.replace(/[:\\.]/g, '\\$&');
    }

    function buildSafeSelector(element) {
        const selectors = [];
        const dataAttrs = Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => `[${attr.name}]`);
        if (dataAttrs.length) {
            selectors.push(dataAttrs.join(''));
        }
        const role = element.getAttribute('role');
        if (role) {
            selectors.push(`[role="${role}"]`);
        }
        const uniqueClasses = Array.from(element.classList)
            .filter(cls => {
                const sanitizedClass = sanitizeClassName(cls);
                const testSelector = `.${sanitizedClass}`;
                return isValidSelector(testSelector) &&
                       document.querySelectorAll(testSelector).length < 10;
            })
            .map(cls => sanitizeClassName(cls));
        if (uniqueClasses.length) {
            selectors.push('.' + uniqueClasses.join('.'));
        }
        if (!selectors.length) {
            selectors.push(element.tagName.toLowerCase());
        }
        const finalSelector = selectors.join('');
        return isValidSelector(finalSelector) ? finalSelector : element.tagName.toLowerCase();
    }

    function buildNthChildPath(el) {
        if (!el.parentElement) return el.tagName.toLowerCase();
        const parent = el.parentElement;
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(el) + 1;
        const tag = el.tagName.toLowerCase();
        const segment = `${tag}:nth-child(${index})`;
        if (!parent.parentElement || parent.tagName.toLowerCase() === "body") {
            return segment;
        }
        return buildNthChildPath(parent) + " > " + segment;
    }

    // =========================================================================
    // 3. ELEMENT PICKING LOGIC (with highlight overlay)
    // =========================================================================

    let pickingMode = null; // "user", "assistant", or "input"
    let highlightOverlay = null;

    function createHighlightOverlay() {
        if (highlightOverlay) return;
        highlightOverlay = document.createElement('div');
        highlightOverlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 2px solid #007bff;
            background-color: rgba(0, 123, 255, 0.1);
            z-index: 10000;
            border-radius: 4px;
            transition: all 0.2s ease;
        `;
        document.body.appendChild(highlightOverlay);
    }

    function updateHighlight(element) {
        if (!highlightOverlay || !element) return;
        const rect = element.getBoundingClientRect();
        highlightOverlay.style.top = rect.top + window.scrollY + 'px';
        highlightOverlay.style.left = rect.left + window.scrollX + 'px';
        highlightOverlay.style.width = rect.width + 'px';
        highlightOverlay.style.height = rect.height + 'px';
        highlightOverlay.style.display = 'block';
    }

    function removeHighlight() {
        if (highlightOverlay) {
            highlightOverlay.style.display = 'none';
        }
    }

    function handleElementHover(event) {
        if (!pickingMode) return;
        updateHighlight(event.target);
    }

    function handleElementPick(event) {
        if (!pickingMode) return;
        event.preventDefault();
        event.stopPropagation();
        const element = event.target;
        const selector = buildSafeSelector(element);
        if (!selector) {
            alert("Could not determine a valid selector for this element. Please try another.");
            return;
        }
        let successMessage = "";
        switch (pickingMode) {
            case "user":
                userMessageSelector = selector;
                localStorage.setItem(LS_USER_SELECTOR_KEY, selector);
                successMessage = "User message selector set successfully!";
                break;
            case "assistant":
                assistantMessageSelector = selector;
                localStorage.setItem(LS_ASSISTANT_SELECTOR_KEY, selector);
                successMessage = "Assistant message selector set successfully!";
                break;
            case "input":
                inputSelector = selector;
                localStorage.setItem(LS_INPUT_SELECTOR_KEY, selector);
                successMessage = "Input box selector set successfully!";
                break;
        }
        endPickingMode();
        alert(successMessage);
        try {
            const elements = document.querySelectorAll(selector);
            console.log(`Selected ${elements.length} elements with selector: ${selector}`);
        } catch (e) {
            console.error("Error with selector:", e);
        }
    }

    function startPickingMode(mode) {
        pickingMode = mode;
        createHighlightOverlay();
        document.addEventListener('mouseover', handleElementHover);
        document.addEventListener('click', handleElementPick, true);
        let instructions = "";
        switch (mode) {
            case "user":
                instructions = "Click on a message bubble that contains a user message...";
                break;
            case "assistant":
                instructions = "Click on a message bubble that contains an assistant response...";
                break;
            case "input":
                instructions = "Click on the input box where messages are typed...";
                break;
        }
        alert(instructions);
    }

    function endPickingMode() {
        pickingMode = null;
        removeHighlight();
        document.removeEventListener('mouseover', handleElementHover);
        document.removeEventListener('click', handleElementPick, true);
    }

    // =========================================================================
    // 4. FIND INPUT BOX & MESSAGE CONTAINER
    // =========================================================================

    function isVisible(el) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               rect.width > 0 &&
               rect.height > 0;
    }

    function findInputBox() {
        if (inputSelector) {
            const savedInput = document.querySelector(inputSelector);
            if (savedInput) return savedInput;
        }
        for (const selector of COMMON_INPUT_SELECTORS) {
            const input = document.querySelector(selector);
            if (input) return input;
        }
        const allPossibleInputs = Array.from(
            document.querySelectorAll('textarea, div[contenteditable="true"]')
        ).filter(isVisible);
        return allPossibleInputs[allPossibleInputs.length - 1] || null;
    }

    function findMessageContainer() {
        for (const selector of COMMON_MESSAGE_CONTAINERS) {
            const container = document.querySelector(selector);
            if (container) return container;
        }
        return null;
    }

    // =========================================================================
    // 5. DETECT MESSAGE SELECTORS
    // =========================================================================

    function detectMessageSelectors() {
        if (userMessageSelector && assistantMessageSelector) return;
        const container = findMessageContainer();
        if (!container) return;
        const messages = Array.from(container.children).filter(el => {
            return isVisible(el) && el.innerText.trim().length > 0;
        });
        if (messages.length < 2) return;
        const patterns = messages.map(el => ({
            element: el,
            classes: Array.from(el.classList),
            role: el.getAttribute('role'),
            dataAttrs: Array.from(el.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => attr.name)
        }));
        const groups = patterns.reduce((acc, curr) => {
            const key = JSON.stringify({
                classes: curr.classes,
                role: curr.role,
                dataAttrs: curr.dataAttrs
            });
            if (!acc[key]) acc[key] = [];
            acc[key].push(curr.element);
            return acc;
        }, {});
        const groupKeys = Object.keys(groups);
        if (groupKeys.length === 2) {
            const [group1, group2] = groupKeys;
            const selector1 = buildSafeSelector(groups[group1][0]);
            const selector2 = buildSafeSelector(groups[group2][0]);
            const isGroup1User = groups[group1].some(el =>
                el.innerText.toLowerCase().includes('you:') ||
                el.getAttribute('data-user') === 'true'
            );
            if (isGroup1User) {
                userMessageSelector = selector1;
                assistantMessageSelector = selector2;
            } else {
                userMessageSelector = selector2;
                assistantMessageSelector = selector1;
            }
            localStorage.setItem(LS_USER_SELECTOR_KEY, userMessageSelector);
            localStorage.setItem(LS_ASSISTANT_SELECTOR_KEY, assistantMessageSelector);
        }
    }

    // =========================================================================
    // 6. GATHER CONVERSATION HISTORY
    // =========================================================================

    function getConversationHistory() {
        const history = [];
        if (userMessageSelector) {
            const userEls = document.querySelectorAll(userMessageSelector);
            userEls.forEach(el => {
                const text = el.innerText.trim();
                if (text) history.push({ role: "user", content: text });
            });
        }
        if (assistantMessageSelector) {
            const assistantEls = document.querySelectorAll(assistantMessageSelector);
            assistantEls.forEach(el => {
                const text = el.innerText.trim();
                if (text) history.push({ role: "assistant", content: text });
            });
        }
        console.log("[getConversationHistory] Final conversation:", history);
        return history;
    }

    // =========================================================================
    // 7. PROMPT INSERTION & SENDING
    // =========================================================================

    function insertPromptIntoBox(promptText, shouldSend = false) {
        const inputEl = findInputBox();
        if (!inputEl) {
            console.error("[Error] Chat input box not found.");
            return false;
        }
        inputSelector = buildSafeSelector(inputEl);
        localStorage.setItem(LS_INPUT_SELECTOR_KEY, inputSelector);
        const tag = inputEl.tagName.toLowerCase();
        if (tag === "textarea" || tag === "input") {
            inputEl.value = promptText;
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
            inputEl.innerHTML = promptText;
            inputEl.dispatchEvent(new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: promptText
            }));
        }
        if (shouldSend) {
            const success = sendMessage(inputEl);
            if (!success) {
                console.error("[Error] Failed to send message automatically");
                return false;
            }
        }
        return true;
    }

    // --- Enhanced sendMessage function ---
    function sendMessage(inputEl) {
        console.log("[sendMessage] Attempting to send message...");
        let sent = false;
        // 1. Try Enter key simulation first
        try {
            const enterEvent = new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                shiftKey: false
            });
            inputEl.dispatchEvent(enterEvent);
            sent = true;
        } catch (e) {
            console.warn("[sendMessage] Enter key simulation failed:", e);
        }
        // 2. Try submit button if configured
        if (submitButtonSelector && submitButtonSelector.trim() !== "") {
            try {
                const submitBtn = document.querySelector(submitButtonSelector);
                if (submitBtn) {
                    submitBtn.click();
                    sent = true;
                }
            } catch (e) {
                console.warn("[sendMessage] Submit button click failed:", e);
            }
        }
        // 3. Try form submission if input is in a form
        if (!sent && inputEl.form) {
            try {
                inputEl.form.dispatchEvent(new SubmitEvent("submit", { bubbles: true }));
                sent = true;
            } catch (e) {
                console.warn("[sendMessage] Form submission failed:", e);
            }
        }
        // Verify that the message was sent
        const originalValue = inputEl.value || inputEl.innerHTML;
        setTimeout(() => {
            const currentValue = inputEl.value || inputEl.innerHTML;
            if (currentValue === originalValue) {
                console.warn("[sendMessage] Message may not have been sent - input still contains original text");
                if (inputEl.form) {
                    inputEl.form.submit();
                }
            }
        }, 500);
        return sent;
    }

    // --- New helper to validate that our message made it to the chat ---
    function validateMessageSent(originalPrompt, maxAttempts = 3) {
        return new Promise((resolve) => {
            let attempts = 0;
            const checkInterval = setInterval(() => {
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    resolve(false);
                    return;
                }
                const userMessages = userMessageSelector ? 
                    document.querySelectorAll(userMessageSelector) : [];
                const lastUserMessage = userMessages[userMessages.length - 1];
                if (lastUserMessage && lastUserMessage.innerText.trim() === originalPrompt.trim()) {
                    clearInterval(checkInterval);
                    resolve(true);
                    return;
                }
                attempts++;
            }, 1000);
        });
    }

    // =========================================================================
    // 8. STREAMING DETECTION: TWO MODES
    // =========================================================================

    async function waitForAssistantResponseToFinishAutoDetect(timeoutMs = 60000) {
        return new Promise((resolve) => {
            if (!assistantMessageSelector) {
                console.warn("[Auto-Detect] No assistant selector. Skipping streaming detection.");
                resolve();
                return;
            }
            let lastContent = "";
            let stableTime = 0;
            const interval = 500;
            const startTime = Date.now();
            function check() {
                const assistantEls = document.querySelectorAll(assistantMessageSelector);
                if (!assistantEls.length) {
                    if (Date.now() - startTime > timeoutMs) {
                        console.log("[Auto-Detect] Timeout, no assistant messages found.");
                        resolve();
                        return;
                    }
                    setTimeout(check, interval);
                    return;
                }
                const lastEl = assistantEls[assistantEls.length - 1];
                const currentText = lastEl.innerText.trim();
                if (currentText === lastContent) {
                    stableTime += interval;
                } else {
                    stableTime = 0;
                    lastContent = currentText;
                }
                if (stableTime >= 1500) {
                    console.log("[Auto-Detect] Assistant response stable, proceeding.");
                    resolve();
                } else if (Date.now() - startTime > timeoutMs) {
                    console.log("[Auto-Detect] Timeout waiting for assistant response, proceeding.");
                    resolve();
                } else {
                    setTimeout(check, interval);
                }
            }
            check();
        });
    }

    async function waitForAssistantResponseToFinishTimeBased(timeoutMs = 60000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let lastContent = "";
            let stableCount = 0;
            const requiredStableChecks = 3;
            function getLatestAssistantMessage() {
                if (assistantMessageSelector) {
                    const elements = document.querySelectorAll(assistantMessageSelector);
                    if (elements.length) {
                        return elements[elements.length - 1].innerText.trim();
                    }
                }
                detectMessageSelectors();
                if (assistantMessageSelector) {
                    const elements = document.querySelectorAll(assistantMessageSelector);
                    if (elements.length) {
                        return elements[elements.length - 1].innerText.trim();
                    }
                }
                return "";
            }
            function checkResponse() {
                const currentContent = getLatestAssistantMessage();
                const inputBox = findInputBox();
                const isInputEnabled = inputBox && !inputBox.disabled && !inputBox.readOnly;
                const loadingIndicator = document.querySelector(
                    "[class*='loading'], [class*='spinner'], [class*='typing']"
                );
                if (currentContent === lastContent && isInputEnabled && !loadingIndicator) {
                    stableCount++;
                    if (stableCount >= requiredStableChecks) {
                        resolve();
                        return;
                    }
                } else {
                    stableCount = 0;
                }
                lastContent = currentContent;
                if (Date.now() - startTime > timeoutMs) {
                    console.log("[Time-Based] Timeout waiting for response");
                    resolve();
                    return;
                }
                setTimeout(checkResponse, 500);
            }
            checkResponse();
        });
    }

    async function waitForAssistantResponseToFinish(timeoutMs = 60000) {
        const mode = localStorage.getItem(LS_WAIT_MODE_KEY) || "auto-detect";
        if (mode === "time-based") {
            return waitForAssistantResponseToFinishTimeBased(timeoutMs);
        } else {
            return waitForAssistantResponseToFinishAutoDetect(timeoutMs);
        }
    }

    // =========================================================================
    // 9. DRAG, COLLAPSE, & OVERLAYS
    // =========================================================================

    const LOADING_OVERLAY_ID = "llm-chat-automation-loading-overlay";

    function showOverlay(message) {
        let overlay = document.getElementById(LOADING_OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = LOADING_OVERLAY_ID;
            document.body.appendChild(overlay);
            const overlayStyle = document.createElement("style");
            overlayStyle.innerHTML = `
                #${LOADING_OVERLAY_ID} {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    color: #fff;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 999999999;
                    text-align: center;
                    flex-direction: column;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .llm-spinner {
                    border: 6px solid #f3f3f3;
                    border-top: 6px solid #fff;
                    border-radius: 50%;
                    width: 40px; height: 40px;
                    animation: spin 1s linear infinite;
                }
            `;
            document.head.appendChild(overlayStyle);
        }
        overlay.innerHTML = `
            <div style="margin-bottom: 10px;">${message}</div>
            <div class="llm-spinner"></div>
        `;
        overlay.style.display = "flex";
    }

    function hideOverlay() {
        const overlay = document.getElementById(LOADING_OVERLAY_ID);
        if (overlay) {
            overlay.style.display = "none";
        }
    }

    const UI_CONTAINER_ID = "llm-chat-automation-container";
    const COLLAPSE_BUTTON_ID = "llm-chat-automation-collapse-button";
    const DRAG_HANDLE_ID = "llm-chat-automation-drag-handle";

    let isPanelCollapsed = false;

    function makeElementDraggable(dragHandle, draggableElement) {
        let offsetX = 0, offsetY = 0;
        let isDragging = false;
        dragHandle.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - draggableElement.offsetLeft;
            offsetY = e.clientY - draggableElement.offsetTop;
        });
        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            draggableElement.style.left = x + "px";
            draggableElement.style.top = y + "px";
        });
        document.addEventListener("mouseup", () => {
            isDragging = false;
        });
    }

    function toggleCollapse() {
        const container = document.getElementById(UI_CONTAINER_ID);
        if (!container) return;
        isPanelCollapsed = !isPanelCollapsed;
        const collapsibleElements = container.querySelectorAll(".collapsible-content");
        collapsibleElements.forEach(el => {
            el.style.display = isPanelCollapsed ? "none" : "block";
        });
        const collapseButton = document.getElementById(COLLAPSE_BUTTON_ID);
        if (collapseButton) {
            collapseButton.innerText = isPanelCollapsed ? "Expand ▼" : "Collapse ▲";
        }
    }

    // =========================================================================
    // 10. NETWORK HELPERS
    // =========================================================================

    async function sendPostRequest(url, data, isFormData = false) {
        try {
            const fetchOptions = { method: "POST" };
            if (isFormData) {
                fetchOptions.body = data;
            } else {
                fetchOptions.headers = { "Content-Type": "application/json" };
                fetchOptions.body = JSON.stringify(data);
            }
            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
                throw new Error(`HTTP Error. Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("[sendPostRequest] Error:", error);
            alert("Error communicating with backend API: " + error.message);
            return null;
        }
    }

    async function downloadFile(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "dataset_results.csv";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("[downloadFile] Error:", error);
            alert("Error downloading results: " + error.message);
        }
    }

    // =========================================================================
    // 11. COLLAPSIBLE SECTION CREATOR
    // =========================================================================
    function createCollapsibleSection(titleText, defaultCollapsed = false) {
        const sectionWrapper = document.createElement("div");
        sectionWrapper.classList.add("llm-section");
        const headerDiv = document.createElement("div");
        headerDiv.style.display = "flex";
        headerDiv.style.justifyContent = "space-between";
        headerDiv.style.alignItems = "center";
        headerDiv.style.cursor = "pointer";
        const titleEl = document.createElement("div");
        titleEl.classList.add("llm-section-title");
        titleEl.innerText = titleText;
        const toggleBtn = document.createElement("button");
        toggleBtn.innerText = defaultCollapsed ? "Expand ▼" : "Collapse ▲";
        toggleBtn.classList.add("llm-btn");
        toggleBtn.style.fontSize = "12px";
        toggleBtn.style.padding = "4px 8px";
        toggleBtn.style.margin = "0";
        headerDiv.appendChild(titleEl);
        headerDiv.appendChild(toggleBtn);
        const contentDiv = document.createElement("div");
        contentDiv.style.marginTop = "8px";
        if (defaultCollapsed) {
            contentDiv.style.display = "none";
        }
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = contentDiv.style.display === "none";
            contentDiv.style.display = isHidden ? "block" : "none";
            toggleBtn.innerText = isHidden ? "Collapse ▲" : "Expand ▼";
        });
        sectionWrapper.appendChild(headerDiv);
        sectionWrapper.appendChild(contentDiv);
        return { sectionWrapper, contentDiv };
    }

    // =========================================================================
    // 12. CREATE "CONFIGS" SECTION (Incl. Wait Mode)
    // =========================================================================
    function createConfigsSection() {
        const { sectionWrapper, contentDiv } = createCollapsibleSection("Configs", true);
        const pickButtonsRow = document.createElement("div");
        pickButtonsRow.classList.add("llm-buttons-row");
        const pickUserBtn = document.createElement("button");
        pickUserBtn.innerText = "Pick User Bubble";
        pickUserBtn.classList.add("llm-btn");
        pickUserBtn.addEventListener("click", () => startPickingMode("user"));
        const pickAssistantBtn = document.createElement("button");
        pickAssistantBtn.innerText = "Pick Assistant Bubble";
        pickAssistantBtn.classList.add("llm-btn");
        pickAssistantBtn.addEventListener("click", () => startPickingMode("assistant"));
        const pickInputBtn = document.createElement("button");
        pickInputBtn.innerText = "Pick Input Box";
        pickInputBtn.classList.add("llm-btn");
        pickInputBtn.addEventListener("click", () => startPickingMode("input"));
        const resetSelectorsBtn = document.createElement("button");
        resetSelectorsBtn.innerText = "Reset Selectors";
        resetSelectorsBtn.classList.add("llm-btn", "llm-btn-dark");
        resetSelectorsBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to reset all selectors?")) {
                localStorage.removeItem(LS_USER_SELECTOR_KEY);
                localStorage.removeItem(LS_ASSISTANT_SELECTOR_KEY);
                localStorage.removeItem(LS_INPUT_SELECTOR_KEY);
                localStorage.removeItem(LS_SUBMIT_SELECTOR_KEY);
                userMessageSelector = "";
                assistantMessageSelector = "";
                inputSelector = "";
                submitButtonSelector = "";
                alert("All selectors have been reset.");
            }
        });
        pickButtonsRow.appendChild(pickUserBtn);
        pickButtonsRow.appendChild(pickAssistantBtn);
        pickButtonsRow.appendChild(pickInputBtn);
        pickButtonsRow.appendChild(resetSelectorsBtn);

        function createManualSelectorInput(labelText, getCurrentSelector, setSelectorFn) {
            const container = document.createElement("div");
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.marginBottom = "8px";
            const label = document.createElement("label");
            label.classList.add("llm-label");
            label.innerText = labelText;
            label.style.marginRight = "6px";
            label.style.marginBottom = "0";
            label.style.whiteSpace = "nowrap";
            const input = document.createElement("input");
            input.type = "text";
            input.style.flex = "1";
            input.style.padding = "4px 6px";
            input.style.fontSize = "12px";
            input.value = getCurrentSelector();
            const button = document.createElement("button");
            button.innerText = "Set";
            button.classList.add("llm-btn");
            button.style.marginLeft = "6px";
            button.style.fontSize = "12px";
            button.addEventListener("click", () => {
                const val = input.value.trim();
                if (!val) {
                    alert("Please enter a valid selector string.");
                    return;
                }
                if (!isValidSelector(val)) {
                    alert("That selector appears invalid. Please check your syntax.");
                    return;
                }
                setSelectorFn(val);
                alert(`${labelText} updated to: ${val}`);
            });
            container.appendChild(label);
            container.appendChild(input);
            container.appendChild(button);
            return container;
        }

        const userSelectorInput = createManualSelectorInput(
            "User Selector:",
            () => userMessageSelector,
            (val) => {
                userMessageSelector = val;
                localStorage.setItem(LS_USER_SELECTOR_KEY, val);
            }
        );
        const assistantSelectorInput = createManualSelectorInput(
            "Assistant Selector:",
            () => assistantMessageSelector,
            (val) => {
                assistantMessageSelector = val;
                localStorage.setItem(LS_ASSISTANT_SELECTOR_KEY, val);
            }
        );
        const inputSelectorInput = createManualSelectorInput(
            "Input Selector:",
            () => inputSelector,
            (val) => {
                inputSelector = val;
                localStorage.setItem(LS_INPUT_SELECTOR_KEY, val);
            }
        );
        const submitSelectorInput = createManualSelectorInput(
            "Submit Button Selector:",
            () => submitButtonSelector,
            (val) => {
                submitButtonSelector = val;
                localStorage.setItem(LS_SUBMIT_SELECTOR_KEY, val);
            }
        );

        const waitModeContainer = document.createElement("div");
        waitModeContainer.style.marginTop = "12px";
        const waitModeLabel = document.createElement("label");
        waitModeLabel.classList.add("llm-label");
        waitModeLabel.innerText = "Wait for Assistant Completion:";
        const radioRow = document.createElement("div");
        radioRow.style.display = "flex";
        radioRow.style.gap = "8px";
        radioRow.style.marginTop = "4px";
        const autoDetectLabel = document.createElement("label");
        autoDetectLabel.style.cursor = "pointer";
        const autoDetectRadio = document.createElement("input");
        autoDetectRadio.type = "radio";
        autoDetectRadio.name = "wait-mode";
        autoDetectRadio.value = "auto-detect";
        autoDetectRadio.checked = (waitMode === "auto-detect");
        autoDetectRadio.addEventListener("change", () => {
            localStorage.setItem(LS_WAIT_MODE_KEY, "auto-detect");
            waitMode = "auto-detect";
        });
        autoDetectLabel.appendChild(autoDetectRadio);
        autoDetectLabel.append(" Auto-Detect");
        const timeBasedLabel = document.createElement("label");
        timeBasedLabel.style.cursor = "pointer";
        const timeBasedRadio = document.createElement("input");
        timeBasedRadio.type = "radio";
        timeBasedRadio.name = "wait-mode";
        timeBasedRadio.value = "time-based";
        timeBasedRadio.checked = (waitMode === "time-based");
        timeBasedRadio.addEventListener("change", () => {
            localStorage.setItem(LS_WAIT_MODE_KEY, "time-based");
            waitMode = "time-based";
        });
        timeBasedLabel.appendChild(timeBasedRadio);
        timeBasedLabel.append(" Time-Based");
        radioRow.appendChild(autoDetectLabel);
        radioRow.appendChild(timeBasedLabel);
        waitModeContainer.appendChild(waitModeLabel);
        waitModeContainer.appendChild(radioRow);

        contentDiv.appendChild(pickButtonsRow);
        contentDiv.appendChild(userSelectorInput);
        contentDiv.appendChild(assistantSelectorInput);
        contentDiv.appendChild(inputSelectorInput);
        contentDiv.appendChild(submitSelectorInput);
        contentDiv.appendChild(waitModeContainer);

        const selectorDisplay = document.createElement("div");
        selectorDisplay.style.marginTop = "6px";
        selectorDisplay.style.fontSize = "12px";
        selectorDisplay.style.color = "#888";
        selectorDisplay.innerHTML = `
            <strong>Current Selectors:</strong><br/>
            User: ${userMessageSelector || 'Not set'}<br/>
            Assistant: ${assistantMessageSelector || 'Not set'}<br/>
            Input: ${inputSelector || 'Not set'}<br/>
            Submit: ${submitButtonSelector || 'Not set (using Enter key)'}
        `;
        contentDiv.appendChild(selectorDisplay);
        const observer = new MutationObserver(() => {
            selectorDisplay.innerHTML = `
                <strong>Current Selectors:</strong><br/>
                User: ${userMessageSelector || 'Not set'}<br/>
                Assistant: ${assistantMessageSelector || 'Not set'}<br/>
                Input: ${inputSelector || 'Not set'}<br/>
                Submit: ${submitButtonSelector || 'Not set (using Enter key)'}
            `;
        });
        observer.observe(contentDiv, { subtree: true, childList: true });
        return sectionWrapper;
    }

    // =========================================================================
    // 13. BUILD THE EXTENSION UI
    // =========================================================================

    // --- Additional styles for resize functionality ---
    const additionalStyles = `
        #${UI_CONTAINER_ID} {
            resize: both;
            overflow: auto;
            min-width: 300px;
            min-height: 200px;
            max-width: 800px;
            max-height: 90vh;
        }
        .llm-section {
            width: 100%;
            height: auto;
            overflow-y: auto;
        }
        .collapsible-content {
            width: 100%;
            height: calc(100% - 40px);
            overflow-y: auto;
        }
        .llm-input {
            width: calc(100% - 16px);
            resize: vertical;
            min-height: 24px;
        }
        .llm-buttons-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            width: 100%;
        }
        .llm-btn {
            flex: 1 1 auto;
            min-width: 120px;
            white-space: nowrap;
        }
        .llm-section-title {
            position: sticky;
            top: 0;
            background-color: #2b2b2b;
            padding: 8px 0;
            z-index: 1;
        }
        #${UI_CONTAINER_ID}::after {
            content: '';
            position: absolute;
            bottom: 0;
            right: 0;
            width: 15px;
            height: 15px;
            cursor: se-resize;
            background: linear-gradient(
                135deg,
                transparent 0%,
                transparent 50%,
                #666 50%,
                #666 100%
            );
        }
    `;

    // Existing styles for the UI
    const existingStyles = `
        #${UI_CONTAINER_ID} {
            position: fixed;
            top: 80px;
            left: 10px;
            width: 460px;
            z-index: 99999999;
            background-color: #2b2b2b;
            color: #f0f0f0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            font-family: Arial, sans-serif;
            font-size: 14px;
        }
        #${DRAG_HANDLE_ID} {
            cursor: move;
            background-color: #202020;
            color: #ffffff;
            padding: 8px 12px;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        #${COLLAPSE_BUTTON_ID} {
            background: none;
            border: none;
            color: #ffffff;
            cursor: pointer;
            font-size: 13px;
            padding: 4px 6px;
        }
        .llm-section {
            margin-bottom: 16px;
        }
        .llm-section-title {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            opacity: 0.8;
        }
        .llm-input {
            width: 100%;
            padding: 6px 8px;
            margin-bottom: 8px;
            border: 1px solid #666;
            border-radius: 4px;
            font-size: 13px;
            background-color: #333;
            color: #fff;
        }
        .llm-buttons-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
            margin-bottom: 8px;
        }
        .llm-btn {
            padding: 8px 14px;
            background-color: #444;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s ease;
        }
        .llm-btn:hover {
            background-color: #666;
        }
        .llm-btn-primary {
            background-color: #007bff;
        }
        .llm-btn-primary:hover {
            background-color: #0056c4;
        }
        .llm-btn-success {
            background-color: #28a745;
        }
        .llm-btn-success:hover {
            background-color: #218838;
        }
        .llm-btn-info {
            background-color: #17a2b8;
        }
        .llm-btn-info:hover {
            background-color: #128293;
        }
        .llm-btn-dark {
            background-color: #343a40;
        }
        .llm-btn-dark:hover {
            background-color: #23272b;
        }
        .collapsible-content {
            padding: 12px;
        }
        label.llm-label {
            display: block;
            margin-bottom: 4px;
            font-size: 13px;
            opacity: 0.9;
        }
    `;

    // --- Inject styles ---
    function injectStyles() {
        const existingStyle = document.getElementById('llm-chat-automation-styles');
        if (existingStyle) return;
        const styleTag = document.createElement("style");
        styleTag.id = 'llm-chat-automation-styles';
        styleTag.innerHTML = `${existingStyles}${additionalStyles}`;
        document.head.appendChild(styleTag);
    }

    injectStyles();

    // --- Add resize observer ---
    function addResizeObserver() {
        const container = document.getElementById(UI_CONTAINER_ID);
        if (!container) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                const height = entry.contentRect.height;
                localStorage.setItem('llm_window_width', width);
                localStorage.setItem('llm_window_height', height);
                const buttonsRows = container.querySelectorAll('.llm-buttons-row');
                buttonsRows.forEach(row => {
                    const buttons = row.querySelectorAll('.llm-btn');
                    buttons.forEach(btn => {
                        if (width < 400) {
                            btn.style.width = '100%';
                        } else {
                            btn.style.width = 'auto';
                        }
                    });
                });
                const inputs = container.querySelectorAll('.llm-input');
                inputs.forEach(input => {
                    input.style.width = `calc(100% - 16px)`;
                });
            }
        });
        resizeObserver.observe(container);
    }

    // --- injectUI: restore saved dimensions and add resize observer ---
    function injectUI() {
        if (document.getElementById(UI_CONTAINER_ID)) return;
        const container = document.createElement("div");
        container.id = UI_CONTAINER_ID;
        const dragHandle = document.createElement("div");
        dragHandle.id = DRAG_HANDLE_ID;
        const title = document.createElement("div");
        title.innerText = "LLM Chat Automation";
        title.style.fontWeight = "bold";
        dragHandle.appendChild(title);
        const collapseBtn = document.createElement("button");
        collapseBtn.id = COLLAPSE_BUTTON_ID;
        collapseBtn.innerText = "Collapse ▲";
        collapseBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleCollapse();
        });
        dragHandle.appendChild(collapseBtn);
        container.appendChild(dragHandle);
        const contentWrapper = document.createElement("div");
        contentWrapper.classList.add("collapsible-content");
        // SECTION 1: "Red-Team With Me"
        const { sectionWrapper: redTeamWrapper, contentDiv: redTeamContent } =
            createCollapsibleSection("Red-Team With Me", false);
        const objectiveLabel = document.createElement("label");
        objectiveLabel.classList.add("llm-label");
        objectiveLabel.innerText = "Objective:";
        const objectiveInput = document.createElement("input");
        objectiveInput.type = "text";
        objectiveInput.id = "objective-input";
        objectiveInput.classList.add("llm-input");
        const notesLabel = document.createElement("label");
        notesLabel.classList.add("llm-label");
        notesLabel.innerText = "Special Notes:";
        const notesInput = document.createElement("input");
        notesInput.type = "text";
        notesInput.id = "notes-input";
        notesInput.classList.add("llm-input");
        const maxTurnsLabel = document.createElement("label");
        maxTurnsLabel.classList.add("llm-label");
        maxTurnsLabel.innerText = "Max Turns:";
        const maxTurnsInput = document.createElement("input");
        maxTurnsInput.type = "number";
        maxTurnsInput.id = "max-turns-input";
        maxTurnsInput.value = "1";
        maxTurnsInput.min = "1";
        maxTurnsInput.classList.add("llm-input");
        const buttonsRow1 = document.createElement("div");
        buttonsRow1.classList.add("llm-buttons-row");
        const generateButton = document.createElement("button");
        generateButton.innerText = "Generate Next Prompt";
        generateButton.classList.add("llm-btn", "llm-btn-primary");
        const automateButton = document.createElement("button");
        automateButton.innerText = "Automate Conversation";
        automateButton.classList.add("llm-btn", "llm-btn-success");
        buttonsRow1.appendChild(generateButton);
        buttonsRow1.appendChild(automateButton);
        redTeamContent.appendChild(objectiveLabel);
        redTeamContent.appendChild(objectiveInput);
        redTeamContent.appendChild(notesLabel);
        redTeamContent.appendChild(notesInput);
        redTeamContent.appendChild(maxTurnsLabel);
        redTeamContent.appendChild(maxTurnsInput);
        redTeamContent.appendChild(buttonsRow1);
        contentWrapper.appendChild(redTeamWrapper);
        // SECTION 2: "Benchmarking"
        const { sectionWrapper: benchmarkWrapper, contentDiv: benchmarkContent } =
            createCollapsibleSection("Benchmarking", true);
        const fileLabel = document.createElement("label");
        fileLabel.classList.add("llm-label");
        fileLabel.innerText = "Upload CSV/XLSX:";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "dataset-file-input";
        fileInput.accept = ".csv, .xlsx";
        fileInput.style.marginBottom = "8px";
        fileInput.style.display = "block";
        const br1 = document.createElement("br");
        const colLabel = document.createElement("label");
        colLabel.classList.add("llm-label");
        colLabel.innerText = "Select Prompt Column:";
        const columnSelectDropdown = document.createElement("select");
        columnSelectDropdown.id = "column-select-dropdown";
        columnSelectDropdown.classList.add("llm-input");
        const runDatasetBtn = document.createElement("button");
        runDatasetBtn.innerText = "Run Dataset";
        runDatasetBtn.classList.add("llm-btn", "llm-btn-info");
        const br2 = document.createElement("br");
        const resultsLabel = document.createElement("label");
        resultsLabel.classList.add("llm-label");
        resultsLabel.innerText = "Results File Path (optional):";
        const resultsInput = document.createElement("input");
        resultsInput.type = "text";
        resultsInput.id = "results-file-path-input";
        resultsInput.classList.add("llm-input");
        resultsInput.value = resultsFilePath;
        const downloadResultsBtn = document.createElement("button");
        downloadResultsBtn.innerText = "Download Results";
        downloadResultsBtn.classList.add("llm-btn", "llm-btn-dark");
        const buttonsRow2 = document.createElement("div");
        buttonsRow2.classList.add("llm-buttons-row");
        buttonsRow2.appendChild(downloadResultsBtn);
        benchmarkContent.appendChild(fileLabel);
        benchmarkContent.appendChild(fileInput);
        benchmarkContent.appendChild(br1);
        benchmarkContent.appendChild(colLabel);
        benchmarkContent.appendChild(columnSelectDropdown);
        benchmarkContent.appendChild(runDatasetBtn);
        benchmarkContent.appendChild(br2);
        benchmarkContent.appendChild(resultsLabel);
        benchmarkContent.appendChild(resultsInput);
        benchmarkContent.appendChild(buttonsRow2);
        contentWrapper.appendChild(benchmarkWrapper);
        // SECTION 3: "Configs"
        const configsSection = createConfigsSection();
        contentWrapper.appendChild(configsSection);
        container.appendChild(contentWrapper);
        document.body.appendChild(container);
        // Restore saved dimensions if available
        const savedWidth = localStorage.getItem('llm_window_width');
        const savedHeight = localStorage.getItem('llm_window_height');
        if (savedWidth && savedHeight) {
            container.style.width = `${savedWidth}px`;
            container.style.height = `${savedHeight}px`;
        }
        addResizeObserver();
        makeElementDraggable(dragHandle, container);

        // ---- Red-Team With Me Section Button Handlers ----
        generateButton.addEventListener("click", async () => {
            const objective = objectiveInput.value.trim();
            const specialNotes = notesInput.value.trim();
            const pathInUI = resultsInput.value.trim();
            resultsFilePath = pathInUI;
            localStorage.setItem(LS_RESULTS_FILE_PATH_KEY, resultsFilePath);
            if (!objective) {
                alert("Please enter an Objective.");
                return;
            }
            showOverlay("Generating Next Prompt...");
            const history = getConversationHistory();
            const payload = {
                model: "gpt-4o",
                objective,
                history,
                special_notes: specialNotes,
                max_turns: 1
            };
            const response = await sendPostRequest(`${BACKEND_API_BASE_URL}/generate_prompt`, payload);
            hideOverlay();
            if (response && response.response) {
                insertPromptIntoBox(response.response, false);
            } else {
                console.warn("[GeneratePrompt] No valid 'response' from backend.");
            }
        });

        // ---- Updated Automate Button Handler ----
        automateButton.addEventListener("click", async () => {
            const objective = objectiveInput.value.trim();
            const specialNotes = notesInput.value.trim();
            const maxTurns = parseInt(maxTurnsInput.value.trim(), 10);
            const pathInUI = resultsInput.value.trim();
            resultsFilePath = pathInUI;
            localStorage.setItem(LS_RESULTS_FILE_PATH_KEY, resultsFilePath);
            if (!objective || !maxTurns || maxTurns < 1) {
                alert("Please enter an Objective and a valid Max Turns.");
                return;
            }
            showOverlay(`Automation in progress... (Up to ${maxTurns} turns)`);
            generateButton.disabled = true;
            automateButton.disabled = true;
            runDatasetBtn.disabled = true;
            const pickBtns = contentWrapper.querySelectorAll(".llm-buttons-row button");
            pickBtns.forEach(btn => btn.disabled = true);
            for (let i = 0; i < maxTurns; i++) {
                console.log(`[Automation] Turn ${i + 1} of ${maxTurns}`);
                const history = getConversationHistory();
                const payload = {
                    model: "gpt-4o",
                    objective,
                    history,
                    special_notes: specialNotes,
                    max_turns: 1
                };
                const response = await sendPostRequest(`${BACKEND_API_BASE_URL}/generate_prompt`, payload);
                if (!response || !response.response) {
                    console.warn("[Automation] No valid response from backend. Stopping automation.");
                    break;
                }
                // Try sending the message up to 3 times
                let messageSent = false;
                for (let attempt = 0; attempt < 3 && !messageSent; attempt++) {
                    if (attempt > 0) {
                        console.log(`[Automation] Retry attempt ${attempt + 1} to send message...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    insertPromptIntoBox(response.response, true);
                    const validateSent = await validateMessageSent(response.response);
                    if (validateSent) {
                        messageSent = true;
                        break;
                    }
                }
                if (!messageSent) {
                    console.error("[Automation] Failed to send message after 3 attempts. Stopping automation.");
                    break;
                }
                await waitForAssistantResponseToFinish(60000);
                const assistantEls = assistantMessageSelector ? 
                    document.querySelectorAll(assistantMessageSelector) : [];
                if (!assistantEls.length) {
                    console.error("[Automation] No assistant response found. Stopping automation.");
                    break;
                }
            }
            generateButton.disabled = false;
            automateButton.disabled = false;
            runDatasetBtn.disabled = false;
            pickBtns.forEach(btn => btn.disabled = false);
            hideOverlay();
        });

        // ---- Updated Run Dataset Button Handler ----
        fileInput.addEventListener("change", async () => {
            const file = fileInput.files[0];
            if (!file) return;
            showOverlay("Uploading file and reading columns...");
            const formData = new FormData();
            formData.append("file", file);
            const response = await sendPostRequest(`${BACKEND_API_BASE_URL}/upload_dataset`, formData, true);
            hideOverlay();
            if (response && response.columns) {
                columnSelectDropdown.innerHTML = "";
                response.columns.forEach(col => {
                    const option = document.createElement("option");
                    option.value = col;
                    option.innerText = col;
                    columnSelectDropdown.appendChild(option);
                });
                alert("File uploaded successfully. Columns loaded into the dropdown.");
            } else {
                alert("Failed to parse file or no columns found.");
            }
        });

        runDatasetBtn.addEventListener("click", async () => {
            const selectedColumn = columnSelectDropdown.value;
            if (!selectedColumn) {
                alert("Please select which column should serve as the prompt.");
                return;
            }
            const pathInUI = resultsInput.value.trim();
            resultsFilePath = pathInUI;
            localStorage.setItem(LS_RESULTS_FILE_PATH_KEY, resultsFilePath);
            showOverlay("Fetching dataset rows...");
            const rowsResponse = await sendPostRequest(`${BACKEND_API_BASE_URL}/get_dataset_rows`, {
                column_name: selectedColumn
            });
            hideOverlay();
            if (!rowsResponse || !rowsResponse.rows) {
                alert("No rows returned or error fetching dataset rows.");
                return;
            }
            const datasetRows = rowsResponse.rows;
            if (!confirm(`Found ${datasetRows.length} prompts in column "${selectedColumn}". Proceed?`)) {
                return;
            }
            showOverlay("Clearing old dataset results...");
            await sendPostRequest(`${BACKEND_API_BASE_URL}/clear_dataset_results`, {
                results_file_path: resultsFilePath
            });
            hideOverlay();
            generateButton.disabled = true;
            automateButton.disabled = true;
            runDatasetBtn.disabled = true;
            const pickBtns = contentWrapper.querySelectorAll(".llm-buttons-row button");
            pickBtns.forEach(btn => btn.disabled = true);
            for (let i = 0; i < datasetRows.length; i++) {
                const promptText = datasetRows[i];
                console.log(`[Dataset] Running row ${i+1}/${datasetRows.length}: "${promptText}"`);
                showOverlay(`Running prompt ${i+1} / ${datasetRows.length}...`);
                // Try sending the message up to 3 times
                let messageSent = false;
                for (let attempt = 0; attempt < 3 && !messageSent; attempt++) {
                    if (attempt > 0) {
                        console.log(`[Dataset] Retry attempt ${attempt + 1} to send message...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    insertPromptIntoBox(promptText, true);
                    const validateSent = await validateMessageSent(promptText);
                    if (validateSent) {
                        messageSent = true;
                        break;
                    }
                }
                if (!messageSent) {
                    console.error("[Dataset] Failed to send message after 3 attempts. Skipping to next prompt.");
                    continue;
                }
                await waitForAssistantResponseToFinish(60000);
                let lastAssistantText = "";
                const assistantEls = document.querySelectorAll(assistantMessageSelector);
                if (assistantEls.length) {
                    lastAssistantText = assistantEls[assistantEls.length - 1].innerText.trim();
                    await sendPostRequest(`${BACKEND_API_BASE_URL}/save_dataset_result`, {
                        prompt: promptText,
                        response: lastAssistantText,
                        results_file_path: resultsFilePath
                    });
                } else {
                    console.warn("[Dataset] No assistant response found for prompt:", promptText);
                }
            }
            hideOverlay();
            alert("Dataset run complete. Results saved. Use 'Download Results' if desired.");
            generateButton.disabled = false;
            automateButton.disabled = false;
            runDatasetBtn.disabled = false;
            pickBtns.forEach(btn => btn.disabled = false);
        });

        downloadResultsBtn.addEventListener("click", async () => {
            await downloadFile(
                `${BACKEND_API_BASE_URL}/download_dataset_results?file_path=${encodeURIComponent(resultsFilePath)}`
            );
        });
    }

    // =========================================================================
    // 14. MAIN ENTRY POINT (Focus-based UI injection)
    // =========================================================================

    document.addEventListener("focusin", (e) => {
        const target = e.target;
        if (target && (target.tagName === "TEXTAREA" || target.type === "text")) {
            injectUI();
        }
    });
})();
