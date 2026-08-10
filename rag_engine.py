import os
import re
import uuid
import requests
import fitz
import chromadb


OLLAMA_URL = os.environ.get(
    'OLLAMA_URL',
    "http://127.0.0.1:11434"
)


GENERATION_MODEL = "llama3.2:3b"
EMBEDDING_MODEL = "nomic-embed-text"


VECTOR_DB_PATH = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
    "RAGSphere",
    "vector_db"
)


os.makedirs(
    VECTOR_DB_PATH,
    exist_ok=True
)


client = chromadb.PersistentClient(
    path=VECTOR_DB_PATH
)


collection = client.get_or_create_collection(
    name="documind_documents",
    metadata={
        "hnsw:space": "cosine"
    }
)


def clean_text(text):

    text = text.replace("\x00", " ")


    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )


    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )


    return text.strip()


def extract_pdf(file_path):

    pages = []


    document = fitz.open(file_path)


    try:

        for page_number, page in enumerate(
            document,
            start=1
        ):

            text = page.get_text("text")


            text = clean_text(
                text
            )


            if text:

                pages.append({
                    "text": text,
                    "page": page_number
                })


    finally:

        document.close()


    return pages


def extract_txt(file_path):

    with open(
        file_path,
        "r",
        encoding="utf-8",
        errors="ignore"
    ) as file:

        text = clean_text(
            file.read()
        )


    if not text:

        return []


    return [
        {
            "text": text,
            "page": 1
        }
    ]


def extract_document(file_path):

    extension = os.path.splitext(
        file_path
    )[1].lower()


    if extension == ".pdf":

        return extract_pdf(
            file_path
        )


    if extension == ".txt":

        return extract_txt(
            file_path
        )


    raise ValueError(
        "Unsupported document format"
    )


def chunk_text(
    text,
    chunk_size=900,
    overlap=180
):

    chunks = []


    start = 0


    text_length = len(text)


    while start < text_length:

        end = min(
            start + chunk_size,
            text_length
        )


        chunk = text[start:end]


        if end < text_length:

            last_period = chunk.rfind(
                ". "
            )


            last_newline = chunk.rfind(
                "\n"
            )


            split_position = max(
                last_period,
                last_newline
            )


            if split_position > chunk_size // 2:

                end = (
                    start
                    + split_position
                    + 1
                )


                chunk = text[
                    start:end
                ]


        chunk = chunk.strip()


        if chunk:

            chunks.append(
                chunk
            )


        if end >= text_length:

            break


        next_start = (
            end - overlap
        )


        if next_start <= start:

            next_start = end


        start = next_start


    return chunks


def get_embedding(text):

    response = requests.post(
        f"{OLLAMA_URL}/api/embed",
        json={
            "model": EMBEDDING_MODEL,
            "input": text
        },
        timeout=120
    )


    response.raise_for_status()


    data = response.json()


    embeddings = data.get(
        "embeddings"
    )


    if not embeddings:

        raise RuntimeError(
            "Embedding model returned no vector."
        )


    return embeddings[0]


def add_document(
    file_path,
    original_name,
    document_id
):

    pages = extract_document(
        file_path
    )


    if not pages:

        raise ValueError(
            "No readable text was found in the document."
        )


    ids = []
    documents = []
    embeddings = []
    metadatas = []


    chunk_number = 0


    for page_data in pages:

        page_chunks = chunk_text(
            page_data["text"]
        )


        for chunk in page_chunks:

            chunk_number += 1


            embedding = get_embedding(
                chunk
            )


            ids.append(
                str(uuid.uuid4())
            )


            documents.append(
                chunk
            )


            embeddings.append(
                embedding
            )


            metadatas.append({

                "document_id":
                    document_id,

                "source":
                    original_name,

                "page":
                    page_data["page"],

                "chunk":
                    chunk_number
            })


    if not documents:

        raise ValueError(
            "Document produced no searchable chunks."
        )


    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )


    return {
        "pages": len(pages),
        "chunks": len(documents)
    }


def retrieve_context(
    question,
    top_k=5,
    document_id=None
):

    count = collection.count()


    if count == 0:

        return []


    question_embedding = get_embedding(
        question
    )


    # Search only inside the selected document
    if document_id:

        results = collection.query(
            query_embeddings=[
                question_embedding
            ],

            n_results=min(
                top_k,
                count
            ),

            where={
                "document_id":
                    document_id
            },

            include=[
                "documents",
                "metadatas",
                "distances"
            ]
        )


    else:

        # No document selected.
        # This branch is kept for compatibility,
        # but app.py now requires a document
        # to be selected before asking.
        number_of_results = min(
            top_k,
            count
        )


        results = collection.query(
            query_embeddings=[
                question_embedding
            ],

            n_results=number_of_results,

            include=[
                "documents",
                "metadatas",
                "distances"
            ]
        )


    retrieved = []


    documents = results.get(
        "documents",
        [[]]
    )[0]


    metadatas = results.get(
        "metadatas",
        [[]]
    )[0]


    distances = results.get(
        "distances",
        [[]]
    )[0]


    for index in range(
        len(documents)
    ):

        distance = distances[index]


        relevance = max(
            0,
            min(
                100,
                round(
                    (1 - distance) * 100,
                    1
                )
            )
        )


        retrieved.append({

            "text":
                documents[index],

            "source":
                metadatas[index]["source"],

            "page":
                metadatas[index]["page"],

            "chunk":
                metadatas[index]["chunk"],

            "document_id":
                metadatas[index]["document_id"],

            "relevance":
                relevance
        })


    return retrieved


def build_context(retrieved):

    context_parts = []


    for index, item in enumerate(
        retrieved,
        start=1
    ):

        context_parts.append(

            f"""
SOURCE {index}
Document: {item['source']}
Page: {item['page']}
Content:
{item['text']}
""".strip()

        )


    return "\n\n---\n\n".join(
        context_parts
    )


def generate_answer(
    question,
    retrieved,
    history=None
):

    context = build_context(
        retrieved
    )


    history_text = ""


    if history:

        recent_history = history[-6:]


        for item in recent_history:

            role = item.get(
                "role",
                "user"
            )


            content = item.get(
                "content",
                ""
            )


            history_text += (
                f"{role.upper()}: "
                f"{content}\n"
            )


    system_prompt = """

You are RAGSphere, a document question answering assistant.

Answer using ONLY the supplied document context.

Rules:
1. Do not use outside knowledge.
2. If the answer is not supported by the context, say:
   "I couldn't find enough information in the uploaded documents to answer that question."
3. Be accurate and concise.
4. Combine information from multiple sources when necessary.
5. Do not invent facts, names, dates, numbers, or citations.
6. When useful, mention the source document naturally.

""".strip()


    user_prompt = f"""

DOCUMENT CONTEXT:

{context}


RECENT CONVERSATION:

{history_text}


QUESTION:

{question}


Answer the question using only the document context.

""".strip()


    response = requests.post(

        f"{OLLAMA_URL}/api/chat",

        json={

            "model":
                GENERATION_MODEL,

            "stream":
                False,

            "messages": [

                {
                    "role":
                        "system",

                    "content":
                        system_prompt
                },

                {
                    "role":
                        "user",

                    "content":
                        user_prompt
                }

            ],

            "options": {

                "temperature":
                    0.2
            }
        },

        timeout=300
    )


    response.raise_for_status()


    data = response.json()


    return data[
        "message"
    ][
        "content"
    ]


def answer_question(
    question,
    history=None,
    document_id=None
):

    retrieved = retrieve_context(
        question,
        document_id=document_id
    )


    if not retrieved:

        return {

            "answer": (
                "No relevant information was found "
                "in the selected document."
            ),

            "sources": []
        }


    answer = generate_answer(
        question,
        retrieved,
        history
    )


    sources = []


    seen = set()


    for item in retrieved:

        source_key = (
            item["source"],
            item["page"],
            item["chunk"]
        )


        if source_key in seen:

            continue


        seen.add(
            source_key
        )


        snippet = item["text"]


        if len(snippet) > 280:

            snippet = (
                snippet[:280].strip()
                + "..."
            )


        sources.append({

            "document":
                item["source"],

            "page":
                item["page"],

            "chunk":
                item["chunk"],

            "relevance":
                item["relevance"],

            "snippet":
                snippet
        })


    return {

        "answer":
            answer,

        "sources":
            sources
    }


def delete_document(
    document_id
):

    collection.delete(

        where={
            "document_id":
                document_id
        }

    )


def clear_vector_database():

    global collection


    try:

        client.delete_collection(
            name="documind_documents"
        )


    except Exception:

        pass


    collection = client.get_or_create_collection(

        name="documind_documents",

        metadata={
            "hnsw:space":
                "cosine"
        }

    )


def check_ollama():

    try:

        response = requests.get(
            f"{OLLAMA_URL}/api/tags",
            timeout=5
        )


        return response.ok


    except requests.RequestException:

        return False