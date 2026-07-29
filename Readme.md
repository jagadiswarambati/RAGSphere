# 📄 DocuMind-RAG

DocuMind-RAG is a Retrieval-Augmented Generation (RAG) application that allows users to upload PDF or TXT documents and ask questions about their content using a local Large Language Model (LLM). The project combines document retrieval with AI-generated responses to provide accurate answers based on the uploaded documents.

---

# 🛠️ Requirements

Before running the project, make sure the following are installed on your system:

- Python 3.10 or above
- Git
- Ollama
- Internet connection (only for downloading models the first time)

---

# 📦 Required Ollama Models

This project uses two models:

- **llama3.2:3b** → Generates answers
- **nomic-embed-text** → Creates embeddings for document retrieval

---

# 🚀 Project Setup

## Step 1: Clone the Repository

```bash
git clone https://github.com/jagadiswarambati/documind-rag
cd documind-rag
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

```text
(venv) C:\Users\YourName\documind-rag>
```

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

```text
Python 3.13.x
```

---

## Step 5: Verify Ollama Installation

```bash
ollama --version
```

Example:

```text
ollama version 0.xx.x
```

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

```text
NAME

llama3.2:3b

nomic-embed-text
```

---

## Step 9: Start the Flask Application

```bash
python app.py
```

If everything is configured correctly, you should see:

```text
Running on http://127.0.0.1:5000
```

---

## Step 10: Open the Application

Open your browser and visit:

```
http://127.0.0.1:5000
```

You can now upload PDF or TXT files and ask questions based on their contents.

---

# 🔧 Useful Ollama Commands

Check Ollama Version

```bash
ollama --version
```

List Installed Models

```bash
ollama list
```

Download Llama Model

```bash
ollama pull llama3.2:3b
```

Download Embedding Model

```bash
ollama pull nomic-embed-text
```

Run Llama Model

```bash
ollama run llama3.2:3b
```

Run Embedding Model (Testing)

```bash
ollama run nomic-embed-text
```

Show Running Models

```bash
ollama ps
```

Stop a Running Model

```bash
ollama stop llama3.2:3b
```

Remove a Model

```bash
ollama rm llama3.2:3b
```

Remove Embedding Model

```bash
ollama rm nomic-embed-text
```
