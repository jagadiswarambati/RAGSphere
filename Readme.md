# 📄 RAGSphere

RAGSphere is a Retrieval-Augmented Generation (RAG) application that allows users to upload PDF and TXT documents and ask questions about their content using a local Large Language Model (LLM) through Ollama. It supports single-document and multi-document querying: users select one or more documents, and retrieval remains restricted to those selected documents. The project combines semantic document retrieval with AI-generated responses to provide grounded answers and retrieved source evidence where supported by the application.

---

# 🛠️ Requirements

Before running the project, make sure the following are installed on your system:

- Python 3.10 or above
- Git
- Ollama
- Docker Desktop
- Internet connection (only for downloading models the first time)

---

# 📦 Required Ollama Models

This project uses two models:

- `llama3.2:3b` → Generation model
- `nomic-embed-text` → Embedding model

---

# 🚀 Project Setup

## Step 1: Clone the Repository

```bash
git clone https://github.com/jagadiswarambati/RAGSphere
cd RAGSphere
```

---

## Step 2: Create a Virtual Environment

### Windows

```bash
python -m venv venv
```

### Activate the Virtual Environment

```bash
venv\Scripts\activate
```

If activated successfully, your terminal should look like:

(venv) C:\Users\YourName\RAGSphere>

---

## Step 3: Install Project Dependencies

```bash
pip install -r requirements.txt
```

---

## Step 4: Verify Python Installation

```bash
python --version
```

Example:
Python 3.13.x

---

## Step 5: Verify Ollama Installation

```bash
ollama --version
```

Example:
ollama version 0.xx.x

---

## Step 6: Download the LLM

```bash
ollama pull llama3.2:3b
```

---

## Step 7: Download the Embedding Model

```bash
ollama pull nomic-embed-text
```

---

## Step 8: Verify Installed Models

```bash
ollama list
```

Expected Output:
NAME
llama3.2:3b
nomic-embed-text

---

## Step 9: Start the Flask Application

```bash
python backend\app.py
```

If everything is configured correctly, you should see:
Running on http://127.0.0.1:5000

---

## Step 10: Open the Application

Open your browser and visit:
http://127.0.0.1:5000




---

# 📚 Document Selection and Querying

RAGSphere supports both single-document and multi-document querying.

### Single Document
Select one document from the document library:
- ✓ document-A.pdf

The question is answered using relevant information retrieved from the selected document.

### Multiple Documents
Select multiple documents:
- ✓ document-A.pdf
- ✓ document-B.pdf
- ✓ document-C.pdf
- ✓ document-D.pdf

RAGSphere retrieves relevant information only from the selected documents and uses that context to generate the answer. This prevents the system from blindly searching across every document in the knowledge base.
Users can query multiple selected documents together while retrieval remains restricted to the selected documents.

---

# 🔎 Semantic Document Retrieval

RAGSphere extracts document text, splits it into chunks, and converts the chunks into vector embeddings using the `nomic-embed-text` model. These embeddings are stored in ChromaDB. When a user asks a question, the question is also converted into an embedding, which is compared against the stored document vectors for semantic/vector retrieval.

Document
   ↓
Text Extraction
   ↓
Chunking
   ↓
Embedding
   ↓
ChromaDB

Question
   ↓
Embedding
   ↓
Semantic Vector Search
   ↓
Relevant Chunks

Relevant chunks from the selected documents are provided to the LLM as context for generating the final answer.

---

# 🔄 RAG Pipeline

RAGSphere follows the following Retrieval-Augmented Generation workflow:

Document Upload
      ↓
PDF / TXT Text Extraction
      ↓
Text Chunking
      ↓
Embedding Generation
      ↓
ChromaDB Vector Storage
      ↓
Question Embedding
      ↓
Semantic Vector Retrieval
      ↓
Selected Document Filtering
      ↓
Relevant Context
      ↓
LLM Generation
      ↓
Grounded Answer + Source Evidence

---

# 📌 Source Evidence

Where supported by the current application, RAGSphere provides source information along with the generated answer. Source information includes:

- Document
- Page
- Chunk
- Relevance
- Snippet

This allows users to identify the retrieved information used to generate the response.

---

# 💾 Persistent Data

RAGSphere stores application data inside the project's data/ directory:

data/
├── uploads/
├── documents.json
└── vector_db/

- `uploads/` contains uploaded PDF and TXT documents.
- `documents.json` stores document information.
- `vector_db/` contains persistent ChromaDB vector data used for document retrieval.

Data persistence allows documents and vector data to remain available when the Docker container is stopped or recreated. When running with Docker Compose, the project's `data/` directory is mounted into the container.

---

# 🐳 Docker Setup

RAGSphere supports Docker and Docker Compose for containerized execution.

Docker Compose configuration:

```yaml
services:
   ragsphere:
      build: .
      ports:
         - "5000:5000"
      extra_hosts:
         - "host.docker.internal:host-gateway"
      environment:
         OLLAMA_URL: "http://host.docker.internal:11434"
```

## Step 1: Verify Docker Installation

```bash
docker --version
```

Example output: Docker version 29.x.x

Verify Docker Compose:

```bash
docker compose version
```

## Step 2: Make Sure Ollama Is Running

Ollama must be running on the host machine with the required models installed.  
Verify the installed models:

```bash
ollama list
```

The following models should be available:
- llama3.2:3b
- nomic-embed-text

## Step 3: Build and Start RAGSphere

From the project root:

```bash
docker compose up --build
```

This builds the RAGSphere Docker image and starts the application container.  
Open the application at http://127.0.0.1:5000.

## Step 4: Start Without Rebuilding

If no source code or Docker configuration has changed:

```bash
docker compose up
```

## Step 5: Stop the Docker Application

Press Ctrl + C or run:

```bash
docker compose down
```

---

# 🔗 Docker → Ollama Connection

When RAGSphere runs inside Docker, the Flask application and RAG pipeline run inside the Docker container while Ollama runs on the host machine.

Browser
   ↓
Port 5000
   ↓
RAGSphere Docker Container
   ↓
Flask Backend
   ↓
RAG Engine
   ↓
ChromaDB
   ↓
host.docker.internal:11434
   ↓
Ollama
   ├── llama3.2:3b
   └── nomic-embed-text

The Docker Compose configuration uses:

OLLAMA_URL: "http://host.docker.internal:11434"

to allow the container to communicate with Ollama running on the host machine.

---

# 📁 Project Structure

RAGSphere/
│
├── backend/
│   ├── app.py
│   └── rag_engine.py
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── data/
│   ├── uploads/
│   ├── documents.json
│   └── vector_db/
│
├── docker/
│   └── Dockerfile
│
├── docker-compose.yml
└── requirements.txt

---

# 🔧 Useful Ollama Commands

- Check Ollama Version:
   ```bash
   ollama --version
   ```
- List Installed Models:
   ```bash
   ollama list
   ```
- Download Llama Model:
   ```bash
   ollama pull llama3.2:3b
   ```
- Download Embedding Model:
   ```bash
   ollama pull nomic-embed-text
   ```
- Run Llama Model:
   ```bash
   ollama run llama3.2:3b
   ```
- Run Embedding Model (Testing):
   ```bash
   ollama run nomic-embed-text
   ```
- Show Running Models:
   ```bash
   ollama ps
   ```
- Stop a Running Model:
   ```bash
   ollama stop llama3.2:3b
   ```
- Remove Llama Model:
   ```bash
   ollama rm llama3.2:3b
   ```
- Remove Embedding Model:
   ```bash
   ollama rm nomic-embed-text
   ```

---

# ⚙️ Local and Docker Execution

RAGSphere can be run directly using Python or through Docker.

### Local Execution

Python → Flask → RAG Engine → ChromaDB → Ollama

Run:
```bash
python backend/app.py
```

### Docker Execution

Docker Container → Flask → RAG Engine → ChromaDB → Host Ollama

Run:
```bash
docker compose up --build
```

Both execution methods use the same RAGSphere application and RAG workflow.

---

# ⚠️ Current Deployment Model

RAGSphere currently uses Ollama for local LLM generation and embedding inference.  
The current Docker configuration is designed for local execution where Ollama is available on the host machine.  
For public deployment, an inference environment capable of running or accessing the required LLM and embedding models is required.

---

# 🚧 Future Improvements

- Public/cloud deployment
- Cloud-based LLM and embedding support
- Improved retrieval and reranking
- Advanced RAG evaluation
- Streaming responses
- Conversation memory
- Additional document formats
- Authentication and multi-user support
- LangChain exploration
- LangGraph exploration
- Advanced agentic workflows

---

# 🎯 Project Goal

RAGSphere was built as a practical implementation of Retrieval-Augmented Generation, with a focus on understanding how the individual components of a RAG system work together.  
The project covers the workflow from document processing and embeddings to vector retrieval, context construction, and LLM-based response generation.

Documents → Embeddings → Vector Database → Semantic Retrieval → Relevant Context → LLM → Grounded Response

---

# 📌 Project Status

RAGSphere is a functional Dockerized local RAG application supporting single-document and multi-document querying with source-grounded responses.

---

# 👨‍💻 Author

Jagadishwar Ambati  
GitHub: https://github.com/jagadiswarambati/RAGSphere
