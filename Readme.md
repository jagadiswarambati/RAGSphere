# 📄 RAGSphere

RAGSphere is a Retrieval-Augmented Generation (RAG) application that allows users to upload PDF or TXT documents and ask questions about their content using a local Large Language Model (LLM). The project combines document retrieval with AI-generated responses to provide accurate answers based on the uploaded documents.

RAGSphere supports both **single-document and multi-document querying**, allowing users to select one or multiple documents before asking questions.

---

# 🛠️ Requirements

Before running the project, make sure the following are installed on your system:

- Python 3.10 or above
- Git
- Ollama
- Docker Desktop
- Internet connection (only for downloading models and dependencies the first time)

---

# 📦 Required Ollama Models

This project uses two models:

- **llama3.2:3b** → Generates answers
- **nomic-embed-text** → Creates embeddings for document retrieval

---

# 🚀 Project Setup

## Step 1: Clone the Repository

```bash
git clone https://github.com/jagadiswarambati/RAGSphere
cd RAGSphere
