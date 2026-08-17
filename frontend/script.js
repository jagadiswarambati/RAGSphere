let documents = [];

let selectedDocumentIds = [];

let conversationHistory = [];

let isProcessing = false;

let pendingConfirmAction = null;


/* =========================================================
   DOM ELEMENTS
========================================================= */

const fileInput =
    document.getElementById("fileInput");

const dropZone =
    document.getElementById("dropZone");

const chatMessages =
    document.getElementById("chatMessages");

const questionInput =
    document.getElementById("questionInput");

const sendButton =
    document.getElementById("sendButton");


/*
 * The HTML may use documentList, document-list,
 * or documents-list depending on the current frontend.
 */
const documentList =
    document.getElementById("documentList") ||
    document.querySelector(".document-list") ||
    document.querySelector(".documents-list");


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        checkHealth();

        loadDocuments();

    }
);


/* =========================================================
   FILE PICKER
========================================================= */

function openFilePicker(event) {

    if (event) {
        event.stopPropagation();
    }

    if (fileInput) {
        fileInput.click();
    }

}


/* =========================================================
   DROP ZONE
========================================================= */

if (dropZone) {

    dropZone.addEventListener(
        "click",
        function (event) {

            if (
                event.target.classList.contains(
                    "browse-button"
                )
            ) {
                return;
            }

            if (fileInput) {
                fileInput.click();
            }

        }
    );


    dropZone.addEventListener(
        "dragover",
        function (event) {

            event.preventDefault();

            dropZone.classList.add(
                "dragging"
            );

        }
    );


    dropZone.addEventListener(
        "dragleave",
        function () {

            dropZone.classList.remove(
                "dragging"
            );

        }
    );


    dropZone.addEventListener(
        "drop",
        function (event) {

            event.preventDefault();

            dropZone.classList.remove(
                "dragging"
            );

            const files =
                event.dataTransfer.files;

            if (files.length > 0) {

                uploadFiles(files);

            }

        }
    );

}


/* =========================================================
   FILE INPUT
========================================================= */

if (fileInput) {

    fileInput.addEventListener(
        "change",
        function () {

            if (fileInput.files.length > 0) {

                uploadFiles(
                    fileInput.files
                );

            }

        }
    );

}


/* =========================================================
   HEALTH CHECK
========================================================= */

async function checkHealth() {

    const statusDot =
        document.getElementById(
            "statusDot"
        );

    const systemStatus =
        document.getElementById(
            "systemStatus"
        );

    const modelName =
        document.getElementById(
            "modelName"
        );


    try {

        const response =
            await fetch(
                "/api/health"
            );


        const data =
            await response.json();


        if (
            data.ollama &&
            data.status === "healthy"
        ) {

            if (statusDot) {

                statusDot.className =
                    "status-dot online";

            }


            if (systemStatus) {

                systemStatus.textContent =
                    "AI System Online";

            }


            if (modelName) {

                modelName.textContent =
                    data.generation_model +
                    " + " +
                    data.embedding_model;

            }

        } else {

            throw new Error(
                "Ollama unavailable"
            );

        }


    } catch (error) {

        if (statusDot) {

            statusDot.className =
                "status-dot offline";

        }


        if (systemStatus) {

            systemStatus.textContent =
                "AI System Offline";

        }


        if (modelName) {

            modelName.textContent =
                "Check Ollama service";

        }

    }

}


/* =========================================================
   LOAD DOCUMENTS
========================================================= */

async function loadDocuments() {

    try {

        const response =
            await fetch(
                "/api/documents"
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unable to load documents."
            );

        }


        documents =
            data.documents || [];


        /*
         * Remove selections that no longer exist.
         */
        const existingIds =
            new Set(
                documents.map(
                    function (document) {
                        return document.id;
                    }
                )
            );


        selectedDocumentIds =
            selectedDocumentIds.filter(
                function (id) {
                    return existingIds.has(id);
                }
            );


        renderDocuments();

        updateSelectedDocumentUI();


    } catch (error) {

        showToast(
            "Unable to load document library.",
            "error"
        );

    }

}


/* =========================================================
   UPLOAD DOCUMENTS
========================================================= */

async function uploadFiles(files) {

    if (isProcessing) {

        return;

    }


    const validFiles =
        Array.from(files).filter(
            function (file) {

                const extension =
                    file.name
                        .split(".")
                        .pop()
                        .toLowerCase();


                return (
                    extension === "pdf" ||
                    extension === "txt"
                );

            }
        );


    if (validFiles.length === 0) {

        showToast(
            "Select PDF or TXT documents.",
            "error"
        );

        return;

    }


    const formData =
        new FormData();


    validFiles.forEach(
        function (file) {

            formData.append(
                "files",
                file
            );

        }
    );


    setProcessing(
        true,
        "Processing documents",
        "Parsing text, creating chunks and generating semantic embeddings..."
    );


    try {

        const response =
            await fetch(
                "/api/upload",
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Upload failed."
            );

        }


        if (
            data.uploaded &&
            data.uploaded.length > 0
        ) {

            /*
             * Add uploaded documents to the
             * current document library.
             */
            documents.push(
                ...data.uploaded
            );


            /*
             * Automatically select ONLY the
             * newly uploaded documents.
             *
             * This is intentional because the
             * user should explicitly select older
             * documents if they want them included.
             */
            selectedDocumentIds =
                data.uploaded.map(
                    function (document) {

                        return document.id;

                    }
                );


            conversationHistory = [];


            renderDocuments();

            updateSelectedDocumentUI();

            resetChat();


            showToast(
                data.uploaded.length +
                " document(s) added to the knowledge base.",
                "success"
            );

        }


        if (
            data.failed &&
            data.failed.length > 0
        ) {

            const failureMessage =
                data.failed
                    .map(
                        function (item) {

                            return (
                                item.name +
                                ": " +
                                item.error
                            );

                        }
                    )
                    .join(" | ");


            showToast(
                failureMessage,
                "error"
            );

        }


    } catch (error) {

        showToast(
            error.message,
            "error"
        );


    } finally {

        setProcessing(false);


        if (fileInput) {

            fileInput.value = "";

        }

    }

}


/* =========================================================
   PROCESSING STATE
========================================================= */

function setProcessing(
    state,
    title = "",
    message = ""
) {

    isProcessing = state;


    const panel =
        document.getElementById(
            "processingPanel"
        );


    if (!panel) {

        return;

    }


    if (state) {

        const titleElement =
            document.getElementById(
                "processingTitle"
            );


        const textElement =
            document.getElementById(
                "processingText"
            );


        if (titleElement) {

            titleElement.textContent =
                title;

        }


        if (textElement) {

            textElement.textContent =
                message;

        }


        panel.classList.remove(
            "hidden"
        );


    } else {

        panel.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   RENDER DOCUMENT LIBRARY
========================================================= */

function renderDocuments() {

    const countElement =
        document.getElementById(
            "documentCount"
        );


    if (countElement) {

        countElement.textContent =
            documents.length;

    }


    if (!documentList) {

        console.error(
            "RAGSphere: document list container not found."
        );

        return;

    }


    if (documents.length === 0) {

        documentList.innerHTML = `

            <div class="empty-documents">

                <div class="empty-icon">
                    +
                </div>

                <p>
                    No documents uploaded
                </p>

                <span>
                    Add PDF or TXT files to begin
                </span>

            </div>

        `;


        updateSelectedDocumentUI();

        return;

    }


    documentList.innerHTML =
        documents
            .map(
                function (document) {

                    const extension =
                        document.name
                            .split(".")
                            .pop()
                            .toUpperCase();


                    const isSelected =
                        selectedDocumentIds.includes(
                            document.id
                        );


                    return `

                        <div
                            class="document-card ${
                                isSelected
                                    ? "selected"
                                    : ""
                            }"
                            onclick="selectDocument('${escapeAttribute(
                                document.id
                            )}')"
                        >

                            <div class="file-type">

                                ${escapeHTML(
                                    extension
                                )}

                            </div>


                            <div class="document-details">

                                <strong
                                    title="${escapeAttribute(
                                        document.name
                                    )}"
                                >

                                    ${escapeHTML(
                                        document.name
                                    )}

                                </strong>


                                <p>

                                    ${escapeHTML(
                                        document.pages
                                    )}

                                    page(s)

                                    ·

                                    ${escapeHTML(
                                        document.chunks
                                    )}

                                    chunks

                                    ·

                                    ${escapeHTML(
                                        document.status
                                    )}

                                </p>

                            </div>


                            ${
                                isSelected
                                    ? `

                                        <span
                                            class="selected-indicator"
                                            title="Selected document"
                                        >
                                            ✓
                                        </span>

                                      `
                                    : ""
                            }


                            <button
                                class="remove-document"
                                onclick="
                                    event.stopPropagation();
                                    confirmRemoveDocument('${escapeAttribute(
                                        document.id
                                    )}')
                                "
                                title="Remove document"
                            >
                                ×
                            </button>


                        </div>

                    `;

                }
            )
            .join("");


    updateSelectedDocumentUI();

}


/* =========================================================
   SELECT / UNSELECT DOCUMENT
========================================================= */

function selectDocument(documentId) {

    const selected =
        documents.find(
            function (document) {

                return (
                    document.id ===
                    documentId
                );

            }
        );


    if (!selected) {

        return;

    }


    /*
     * Toggle selection.
     *
     * Selected:
     *     remove it.
     *
     * Not selected:
     *     add it.
     */
    if (
        selectedDocumentIds.includes(
            documentId
        )
    ) {

        selectedDocumentIds =
            selectedDocumentIds.filter(
                function (id) {

                    return (
                        id !==
                        documentId
                    );

                }
            );

    } else {

        selectedDocumentIds.push(
            documentId
        );

    }


    /*
     * Changing selected documents means
     * the previous conversation context
     * should not be reused.
     */
    conversationHistory = [];


    resetChat();


    renderDocuments();


    updateSelectedDocumentUI();

}


/* =========================================================
   SELECTED DOCUMENT UI
========================================================= */

function updateSelectedDocumentUI() {

    const nameElement =
        document.getElementById(
            "selectedDocumentName"
        );


    if (!nameElement) {

        return;

    }


    if (
        selectedDocumentIds.length === 0
    ) {

        nameElement.textContent =
            "No document selected";

        return;

    }


    const selectedDocuments =
        documents.filter(
            function (document) {

                return selectedDocumentIds.includes(
                    document.id
                );

            }
        );


    /*
     * If selected IDs no longer exist,
     * clean them up.
     */
    if (
        selectedDocuments.length === 0
    ) {

        selectedDocumentIds = [];


        nameElement.textContent =
            "No document selected";


        return;

    }


    if (
        selectedDocuments.length === 1
    ) {

        nameElement.textContent =
            selectedDocuments[0].name;


        return;

    }


    nameElement.textContent =
        selectedDocuments.length +
        " documents selected";

}


/* =========================================================
   ASK QUESTION
========================================================= */

async function askQuestion() {

    if (!questionInput) {

        return;

    }


    const question =
        questionInput.value.trim();


    if (
        !question ||
        isProcessing
    ) {

        return;

    }


    if (
        documents.length === 0
    ) {

        showToast(
            "Upload at least one document before asking questions.",
            "error"
        );

        return;

    }


    /*
     * A question cannot be asked without
     * at least one selected document.
     */
    if (
        selectedDocumentIds.length === 0
    ) {

        showToast(
            "Select at least one document before asking a question.",
            "error"
        );

        return;

    }


    removeWelcome();


    addUserMessage(
        question
    );


    /*
     * Save the user message.
     */
    conversationHistory.push({

        role:
            "user",

        content:
            question

    });


    questionInput.value = "";


    resizeTextarea(
        questionInput
    );


    const thinkingId =
        addThinkingMessage();


    isProcessing = true;


    if (sendButton) {

        sendButton.disabled = true;

    }


    try {

        /*
         * IMPORTANT:
         *
         * selected_document_ids is sent
         * directly to the backend.
         */
        const response =
            await fetch(
                "/api/ask",
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            question:
                                question,

                            selected_document_ids:
                                selectedDocumentIds,

                            history:
                                conversationHistory.slice(
                                    0,
                                    -1
                                )

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unable to generate answer."
            );

        }


        removeThinkingMessage(
            thinkingId
        );


        addAssistantMessage(
            data.answer,
            data.sources || []
        );


        /*
         * Save assistant response.
         */
        conversationHistory.push({

            role:
                "assistant",

            content:
                data.answer

        });


    } catch (error) {

        removeThinkingMessage(
            thinkingId
        );


        addAssistantMessage(

            "An error occurred while generating the answer: " +
            error.message,

            []

        );

    } finally {

        isProcessing = false;


        if (sendButton) {

            sendButton.disabled = false;

        }


        questionInput.focus();

    }

}


/* =========================================================
   USER MESSAGE
========================================================= */

function addUserMessage(text) {

    if (!chatMessages) {

        return;

    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "message user-message";


    wrapper.innerHTML = `

        <div class="user-bubble">

            ${escapeHTML(
                text
            )}

        </div>

    `;


    chatMessages.appendChild(
        wrapper
    );


    scrollChat();

}


/* =========================================================
   ASSISTANT MESSAGE
========================================================= */

function addAssistantMessage(
    answer,
    sources
) {

    if (!chatMessages) {

        return;

    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "message assistant-message";


    const sourceId =
        "sources-" +
        Date.now();


    let sourcesHTML = "";


    if (
        sources &&
        sources.length > 0
    ) {

        const cards =
            sources
                .map(
                    function (source) {

                        return `

                            <div class="source-card">

                                <div class="source-header">

                                    <strong>
                                        ${escapeHTML(
                                            source.document
                                        )}
                                    </strong>


                                    <span>

                                        Page
                                        ${escapeHTML(
                                            source.page
                                        )}

                                        ·

                                        ${escapeHTML(
                                            source.relevance
                                        )}%
                                        relevance

                                    </span>

                                </div>


                                <p>

                                    ${escapeHTML(
                                        source.snippet
                                    )}

                                </p>

                            </div>

                        `;

                    }
                )
                .join("");


        sourcesHTML = `

            <div class="sources-section">

                <button
                    class="sources-toggle"
                    onclick="
                        toggleSources(
                            '${escapeAttribute(
                                sourceId
                            )}',
                            this
                        )
                    "
                >

                    View
                    ${sources.length}
                    retrieved sources

                </button>


                <div
                    id="${escapeAttribute(
                        sourceId
                    )}"
                    class="sources-list hidden"
                >

                    ${cards}

                </div>

            </div>

        `;

    }


    wrapper.innerHTML = `

        <div class="ai-avatar">
            AI
        </div>


        <div class="answer-content">

            <div class="answer-box">

                ${escapeHTML(
                    answer
                )}

            </div>


            ${sourcesHTML}

        </div>

    `;


    chatMessages.appendChild(
        wrapper
    );


    scrollChat();

}


/* =========================================================
   THINKING MESSAGE
========================================================= */

function addThinkingMessage() {

    const id =
        "thinking-" +
        Date.now();


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.id =
        id;


    wrapper.className =
        "message assistant-message";


    wrapper.innerHTML = `

        <div class="ai-avatar">
            AI
        </div>


        <div class="thinking-box">

            <div class="thinking-dots">

                <span></span>
                <span></span>
                <span></span>

            </div>


            Retrieving relevant context
            and generating a grounded answer...

        </div>

    `;


    chatMessages.appendChild(
        wrapper
    );


    scrollChat();


    return id;

}


function removeThinkingMessage(id) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.remove();

    }

}


/* =========================================================
   SOURCE TOGGLE
========================================================= */

function toggleSources(
    sourceId,
    button
) {

    const sources =
        document.getElementById(
            sourceId
        );


    if (!sources) {

        return;

    }


    const isHidden =
        sources.classList.contains(
            "hidden"
        );


    sources.classList.toggle(
        "hidden"
    );


    button.textContent =
        isHidden
            ? "Hide retrieved sources"
            : "View retrieved sources";

}


/* =========================================================
   REMOVE DOCUMENT CONFIRMATION
========================================================= */

function confirmRemoveDocument(
    documentId
) {

    const selectedDocument =
        documents.find(
            function (item) {

                return (
                    item.id ===
                    documentId
                );

            }
        );


    if (!selectedDocument) {

        return;

    }


    openModal(

        "Remove document",

        "Remove \"" +
        selectedDocument.name +
        "\" from the knowledge base? Its vector embeddings will also be deleted.",

        async function () {

            await removeDocument(
                documentId
            );

        }

    );

}


/* =========================================================
   REMOVE DOCUMENT
========================================================= */

async function removeDocument(
    documentId
) {

    try {

        const response =
            await fetch(
                "/api/documents/" +
                encodeURIComponent(
                    documentId
                ),
                {
                    method:
                        "DELETE"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unable to remove document."
            );

        }


        documents =
            documents.filter(
                function (item) {

                    return (
                        item.id !==
                        documentId
                    );

                }
            );


        /*
         * Remove it from the selection.
         */
        selectedDocumentIds =
            selectedDocumentIds.filter(
                function (id) {

                    return (
                        id !==
                        documentId
                    );

                }
            );


        conversationHistory = [];


        resetChat();


        renderDocuments();


        updateSelectedDocumentUI();


        showToast(
            data.message ||
            "Document removed.",
            "success"
        );


    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }

}


/* =========================================================
   CLEAR ALL DOCUMENTS
========================================================= */

function clearDocuments() {

    if (
        documents.length === 0
    ) {

        showToast(
            "The document library is already empty.",
            "error"
        );

        return;

    }


    openModal(

        "Clear knowledge base",

        "This will remove all uploaded documents and their vector embeddings. This action cannot be undone.",

        async function () {

            try {

                const response =
                    await fetch(
                        "/api/clear",
                        {
                            method:
                                "DELETE"
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.error ||
                        "Unable to clear documents."
                    );

                }


                documents = [];


                selectedDocumentIds = [];


                conversationHistory = [];


                renderDocuments();


                updateSelectedDocumentUI();


                resetChat();


                showToast(
                    data.message ||
                    "Knowledge base cleared.",
                    "success"
                );


            } catch (error) {

                showToast(
                    error.message,
                    "error"
                );

            }

        }

    );

}


/* =========================================================
   CLEAR CHAT
========================================================= */

function clearChat() {

    conversationHistory = [];


    resetChat();


    showToast(
        "Conversation cleared.",
        "success"
    );

}


/* =========================================================
   RESET CHAT
========================================================= */

function resetChat() {

    if (!chatMessages) {

        return;

    }


    chatMessages.innerHTML = `

        <div
            id="welcomeMessage"
            class="welcome"
        >

            <div class="welcome-icon">
                AI
            </div>


            <h2>
                Your documents, understood.
            </h2>


            <p>

                RAGSphere uses semantic search and
                retrieval-augmented generation to answer
                questions using only your uploaded documents.

            </p>


            <div class="feature-grid">

                <div class="feature-card">

                    <span>
                        01
                    </span>


                    <div>

                        <strong>
                            Semantic Retrieval
                        </strong>


                        <p>

                            Finds relevant information by meaning,
                            not just keywords.

                        </p>

                    </div>

                </div>


                <div class="feature-card">

                    <span>
                        02
                    </span>


                    <div>

                        <strong>
                            Grounded Answers
                        </strong>


                        <p>

                            Responses are generated from retrieved
                            document context.

                        </p>

                    </div>

                </div>


                <div class="feature-card">

                    <span>
                        03
                    </span>


                    <div>

                        <strong>
                            Source Evidence
                        </strong>


                        <p>

                            Inspect document names, pages and
                            retrieved passages.

                        </p>

                    </div>

                </div>

            </div>

        </div>

    `;

}


/* =========================================================
   REMOVE WELCOME SCREEN
========================================================= */

function removeWelcome() {

    const welcome =
        document.getElementById(
            "welcomeMessage"
        );


    if (welcome) {

        welcome.remove();

    }

}


/* =========================================================
   ENTER KEY
========================================================= */

function handleQuestionKey(event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();


        askQuestion();

    }

}


/* =========================================================
   TEXTAREA RESIZE
========================================================= */

function resizeTextarea(element) {

    if (!element) {

        return;

    }


    element.style.height =
        "auto";


    element.style.height =
        Math.min(
            element.scrollHeight,
            120
        ) +
        "px";

}


/* =========================================================
   SCROLL CHAT
========================================================= */

function scrollChat() {

    if (!chatMessages) {

        return;

    }


    setTimeout(

        function () {

            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        },

        50

    );

}


/* =========================================================
   MODAL
========================================================= */

function openModal(
    title,
    text,
    action
) {

    const titleElement =
        document.getElementById(
            "modalTitle"
        );


    const textElement =
        document.getElementById(
            "modalText"
        );


    const modal =
        document.getElementById(
            "confirmModal"
        );


    const confirmButton =
        document.getElementById(
            "modalConfirm"
        );


    if (!modal) {

        /*
         * Fallback if the modal is not present.
         */
        if (
            typeof action === "function"
        ) {

            action();

        }

        return;

    }


    if (titleElement) {

        titleElement.textContent =
            title;

    }


    if (textElement) {

        textElement.textContent =
            text;

    }


    pendingConfirmAction =
        action;


    modal.classList.remove(
        "hidden"
    );


    if (confirmButton) {

        confirmButton.onclick =
            async function () {

                closeModal();


                if (
                    pendingConfirmAction
                ) {

                    const actionToRun =
                        pendingConfirmAction;


                    pendingConfirmAction =
                        null;


                    await actionToRun();

                }

            };

    }

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeModal() {

    const modal =
        document.getElementById(
            "confirmModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }


    pendingConfirmAction =
        null;

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = ""
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        console.log(
            message
        );

        return;

    }


    toast.textContent =
        message;


    toast.className =
        "toast show " +
        type;


    setTimeout(

        function () {

            toast.className =
                "toast";

        },

        3500

    );

}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ?? ""
        );


    return div.innerHTML;

}


/* =========================================================
   ATTRIBUTE ESCAPING
========================================================= */

function escapeAttribute(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /'/g,
            "&#39;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        );

}