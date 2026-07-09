let documents = [];

let conversationHistory = [];

let isProcessing = false;

let pendingConfirmAction = null;


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


document.addEventListener(
    "DOMContentLoaded",
    function () {

        checkHealth();

        loadDocuments();
    }
);


function openFilePicker(event) {

    event.stopPropagation();

    fileInput.click();
}


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

        fileInput.click();
    }
);


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
            await fetch("/api/health");


        const data =
            await response.json();


        if (
            data.ollama &&
            data.status === "healthy"
        ) {

            statusDot.className =
                "status-dot online";

            systemStatus.textContent =
                "AI System Online";

            modelName.textContent =
                data.generation_model +
                " + " +
                data.embedding_model;

        } else {

            throw new Error(
                "Ollama unavailable"
            );
        }

    } catch (error) {

        statusDot.className =
            "status-dot offline";

        systemStatus.textContent =
            "AI System Offline";

        modelName.textContent =
            "Check Ollama service";
    }
}


async function loadDocuments() {

    try {

        const response =
            await fetch("/api/documents");


        const data =
            await response.json();


        documents =
            data.documents || [];


        renderDocuments();

    } catch (error) {

        showToast(
            "Unable to load document library.",
            "error"
        );
    }
}


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

            documents.push(
                ...data.uploaded
            );


            renderDocuments();


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

        fileInput.value = "";
    }
}


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


    if (state) {

        document.getElementById(
            "processingTitle"
        ).textContent = title;


        document.getElementById(
            "processingText"
        ).textContent = message;


        panel.classList.remove(
            "hidden"
        );

    } else {

        panel.classList.add(
            "hidden"
        );
    }
}


function renderDocuments() {

    const list =
        document.getElementById(
            "documentList"
        );


    document.getElementById(
        "documentCount"
    ).textContent =
        documents.length;


    if (documents.length === 0) {

        list.innerHTML = `
            <div class="empty-documents">
                <div class="empty-icon">+</div>
                <p>No documents uploaded</p>
                <span>
                    Add PDF or TXT files to begin
                </span>
            </div>
        `;

        return;
    }


    list.innerHTML =
        documents.map(
            function (document) {

                const extension =
                    document.name
                        .split(".")
                        .pop()
                        .toUpperCase();


                return `
                    <div class="document-card">

                        <div class="file-type">
                            ${escapeHTML(extension)}
                        </div>

                        <div class="document-details">

                            <strong
                                title="${escapeHTML(document.name)}"
                            >
                                ${escapeHTML(document.name)}
                            </strong>

                            <p>
                                ${document.pages} page(s)
                                ·
                                ${document.chunks} chunks
                                ·
                                ${escapeHTML(document.status)}
                            </p>

                        </div>

                        <button
                            class="remove-document"
                            onclick="confirmRemoveDocument(
                                '${document.id}'
                            )"
                            title="Remove document"
                        >
                            ×
                        </button>

                    </div>
                `;
            }
        )
        .join("");
}


async function askQuestion() {

    const question =
        questionInput.value.trim();


    if (!question || isProcessing) {
        return;
    }


    if (documents.length === 0) {

        showToast(
            "Upload at least one document before asking questions.",
            "error"
        );

        return;
    }


    removeWelcome();


    addUserMessage(question);


    conversationHistory.push({
        role: "user",
        content: question
    });


    questionInput.value = "";

    resizeTextarea(questionInput);


    const thinkingId =
        addThinkingMessage();


    isProcessing = true;

    sendButton.disabled = true;


    try {

        const response =
            await fetch(
                "/api/ask",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        question: question,

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


        conversationHistory.push({
            role: "assistant",
            content: data.answer
        });


    } catch (error) {

        removeThinkingMessage(
            thinkingId
        );


        addAssistantMessage(
            "An error occurred while generating the answer: "
            + error.message,
            []
        );

    } finally {

        isProcessing = false;

        sendButton.disabled = false;

        questionInput.focus();
    }
}


function addUserMessage(text) {

    const wrapper =
        document.createElement("div");


    wrapper.className =
        "message user-message";


    wrapper.innerHTML = `
        <div class="user-bubble">
            ${escapeHTML(text)}
        </div>
    `;


    chatMessages.appendChild(
        wrapper
    );


    scrollChat();
}


function addAssistantMessage(
    answer,
    sources
) {

    const wrapper =
        document.createElement("div");


    wrapper.className =
        "message assistant-message";


    const sourceId =
        "sources-" +
        Date.now();


    let sourcesHTML = "";


    if (sources.length > 0) {

        const cards =
            sources.map(
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
                                    Page ${source.page}
                                    ·
                                    ${source.relevance}% relevance
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
                    onclick="toggleSources(
                        '${sourceId}',
                        this
                    )"
                >
                    View ${sources.length} retrieved sources
                </button>

                <div
                    id="${sourceId}"
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
                ${escapeHTML(answer)}
            </div>

            ${sourcesHTML}

        </div>
    `;


    chatMessages.appendChild(
        wrapper
    );


    scrollChat();
}


function addThinkingMessage() {

    const id =
        "thinking-" +
        Date.now();


    const wrapper =
        document.createElement("div");


    wrapper.id = id;

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
        document.getElementById(id);


    if (element) {

        element.remove();
    }
}


function toggleSources(
    sourceId,
    button
) {

    const sources =
        document.getElementById(
            sourceId
        );


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


function confirmRemoveDocument(
    documentId
) {

    const document =
        documents.find(
            function (item) {

                return (
                    item.id ===
                    documentId
                );
            }
        );


    if (!document) {
        return;
    }


    openModal(
        "Remove document",
        "Remove \"" +
        document.name +
        "\" from the knowledge base? Its vector embeddings will also be deleted.",

        async function () {

            await removeDocument(
                documentId
            );
        }
    );
}


async function removeDocument(
    documentId
) {

    try {

        const response =
            await fetch(
                "/api/documents/" +
                documentId,
                {
                    method: "DELETE"
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


        renderDocuments();


        showToast(
            data.message,
            "success"
        );


    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


function clearDocuments() {

    if (documents.length === 0) {

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
                            method: "DELETE"
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

                conversationHistory = [];


                renderDocuments();

                resetChat();


                showToast(
                    data.message,
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


function clearChat() {

    conversationHistory = [];

    resetChat();


    showToast(
        "Conversation cleared.",
        "success"
    );
}


function resetChat() {

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
                DocuMind uses semantic search and
                retrieval-augmented generation to answer
                questions using only your uploaded documents.
            </p>

            <div class="feature-grid">

                <div class="feature-card">

                    <span>01</span>

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

                    <span>02</span>

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

                    <span>03</span>

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


function removeWelcome() {

    const welcome =
        document.getElementById(
            "welcomeMessage"
        );


    if (welcome) {

        welcome.remove();
    }
}


function handleQuestionKey(event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        askQuestion();
    }
}


function resizeTextarea(element) {

    element.style.height =
        "auto";


    element.style.height =
        Math.min(
            element.scrollHeight,
            120
        ) + "px";
}


function scrollChat() {

    setTimeout(
        function () {

            chatMessages.scrollTop =
                chatMessages.scrollHeight;
        },

        50
    );
}


function openModal(
    title,
    text,
    action
) {

    document.getElementById(
        "modalTitle"
    ).textContent = title;


    document.getElementById(
        "modalText"
    ).textContent = text;


    pendingConfirmAction =
        action;


    document.getElementById(
        "confirmModal"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "modalConfirm"
    ).onclick =
        async function () {

            closeModal();

            if (pendingConfirmAction) {

                await pendingConfirmAction();
            }
        };
}


function closeModal() {

    document.getElementById(
        "confirmModal"
    ).classList.add(
        "hidden"
    );
}


function showToast(
    message,
    type = ""
) {

    const toast =
        document.getElementById(
            "toast"
        );


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


function escapeHTML(value) {

    const div =
        document.createElement("div");


    div.textContent =
        String(value);


    return div.innerHTML;
}