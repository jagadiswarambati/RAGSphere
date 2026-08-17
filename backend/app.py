import os
import uuid
import json

from flask import (
    Flask,
    jsonify,
    request,
    send_from_directory
)

from flask_cors import CORS
from werkzeug.utils import secure_filename

from rag_engine import (
    add_document,
    answer_question,
    delete_document,
    clear_vector_database,
    check_ollama
)


# ============================================================
# PATHS AND CONFIGURATION
# ============================================================

BASE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        ".."
    )
)


UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "data",
    "uploads"
)


DOCUMENTS_FILE = os.path.join(
    BASE_DIR,
    "data",
    "documents.json"
)


ALLOWED_EXTENSIONS = {
    "pdf",
    "txt"
}


MAX_FILE_SIZE = (
    20
    * 1024
    * 1024
)


# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(
    __name__,
    static_folder=os.path.join(
        BASE_DIR,
        "frontend"
    ),
    static_url_path=""
)


CORS(app)


app.config[
    "MAX_CONTENT_LENGTH"
] = MAX_FILE_SIZE


os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# ============================================================
# DOCUMENT METADATA PERSISTENCE
# ============================================================

def load_document_metadata():

    if not os.path.exists(
        DOCUMENTS_FILE
    ):

        return {}


    try:

        with open(
            DOCUMENTS_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(
                file
            )


            if isinstance(
                data,
                dict
            ):

                return data


    except (
        json.JSONDecodeError,
        OSError
    ) as error:

        print(
            "Unable to load document metadata:",
            error
        )


    return {}


documents = load_document_metadata()


def save_document_metadata():

    temporary_file = (
        DOCUMENTS_FILE
        + ".tmp"
    )


    with open(
        temporary_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            documents,
            file,
            indent=4,
            ensure_ascii=False
        )


    os.replace(
        temporary_file,
        DOCUMENTS_FILE
    )


# ============================================================
# HELPERS
# ============================================================

def allowed_file(filename):

    return (
        "." in filename
        and filename.rsplit(
            ".",
            1
        )[1].lower()
        in ALLOWED_EXTENSIONS
    )


def remove_uploaded_file(
    document_id
):

    prefix = (
        document_id
        + "_"
    )


    for file_name in os.listdir(
        UPLOAD_FOLDER
    ):

        if file_name.startswith(
            prefix
        ):

            file_path = os.path.join(
                UPLOAD_FOLDER,
                file_name
            )


            if os.path.isfile(
                file_path
            ):

                try:

                    os.remove(
                        file_path
                    )

                except OSError:

                    pass


# ============================================================
# FRONTEND
# ============================================================

@app.route("/")
def home():

    return send_from_directory(
        app.static_folder,
        "index.html"
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    ollama_status = check_ollama()


    return jsonify({

        "status": (
            "healthy"
            if ollama_status
            else "degraded"
        ),

        "ollama": ollama_status,

        "generation_model":
            "llama3.2:3b",

        "embedding_model":
            "nomic-embed-text",

        "documents":
            len(documents)
    })


# ============================================================
# GET DOCUMENT LIBRARY
# ============================================================

@app.route(
    "/api/documents",
    methods=["GET"]
)
def get_documents():

    return jsonify({

        "documents":
            list(
                documents.values()
            )
    })


# ============================================================
# DOCUMENT UPLOAD
# ============================================================

@app.route(
    "/api/upload",
    methods=["POST"]
)
def upload_documents():

    if "files" not in request.files:

        return jsonify({

            "error":
                "No files were provided."

        }), 400


    files = request.files.getlist(
        "files"
    )


    if not files:

        return jsonify({

            "error":
                "No files were selected."

        }), 400


    uploaded = []

    failed = []


    for file in files:

        if not file.filename:

            continue


        if not allowed_file(
            file.filename
        ):

            failed.append({

                "name":
                    file.filename,

                "error":
                    (
                        "Unsupported format. "
                        "Only PDF and TXT files are allowed."
                    )
            })

            continue


        document_id = str(
            uuid.uuid4()
        )


        original_name = secure_filename(
            file.filename
        )


        if not original_name:

            failed.append({

                "name":
                    file.filename,

                "error":
                    "Invalid filename."
            })

            continue


        stored_name = (
            document_id
            + "_"
            + original_name
        )


        file_path = os.path.join(
            UPLOAD_FOLDER,
            stored_name
        )


        try:

            file.save(
                file_path
            )


            result = add_document(
                file_path,
                original_name,
                document_id
            )


            document_info = {

                "id":
                    document_id,

                "name":
                    original_name,

                "pages":
                    result["pages"],

                "chunks":
                    result["chunks"],

                "status":
                    "Ready"
            }


            documents[
                document_id
            ] = document_info


            save_document_metadata()


            uploaded.append(
                document_info
            )


            print(
                f"Indexed document: "
                f"{original_name} | "
                f"{result['pages']} pages | "
                f"{result['chunks']} chunks"
            )


        except Exception as error:

            try:

                delete_document(
                    document_id
                )

            except Exception:

                pass


            if os.path.exists(
                file_path
            ):

                try:

                    os.remove(
                        file_path
                    )

                except OSError:

                    pass


            failed.append({

                "name":
                    original_name,

                "error":
                    str(error)
            })


            print(
                f"Upload failed for "
                f"{original_name}: "
                f"{error}"
            )


    if not uploaded and failed:

        return jsonify({

            "uploaded":
                uploaded,

            "failed":
                failed

        }), 400


    return jsonify({

        "uploaded":
            uploaded,

        "failed":
            failed
    })


# ============================================================
# QUESTION ANSWERING
# ============================================================

@app.route(
    "/api/ask",
    methods=["POST"]
)
def ask_question():

    data = request.get_json(
        silent=True
    ) or {}


    question = data.get(
        "question",
        ""
    )


    # --------------------------------------------------------
    # Selected documents
    # --------------------------------------------------------

    selected_document_ids = data.get(
        "selected_document_ids"
    )


    # Backward compatibility:
    # support the old single-document field too
    if selected_document_ids is None:

        single_document_id = data.get(
            "document_id"
        )

        if single_document_id:
            selected_document_ids = [
                single_document_id
            ]


    # --------------------------------------------------------
    # Validate question
    # --------------------------------------------------------

    if not isinstance(
        question,
        str
    ):

        return jsonify({
            "error":
                "Question must be text."
        }), 400


    question = question.strip()


    # --------------------------------------------------------
    # History
    # --------------------------------------------------------

    history = data.get(
        "history",
        []
    )


    if not isinstance(
        history,
        list
    ):

        history = []


    # --------------------------------------------------------
    # Basic validation
    # --------------------------------------------------------

    if not question:

        return jsonify({
            "error":
                "Question cannot be empty."
        }), 400


    if not documents:

        return jsonify({
            "error":
                (
                    "No documents are available. "
                    "Upload a PDF or TXT file first."
                )
        }), 400


    # --------------------------------------------------------
    # Selected document validation
    # --------------------------------------------------------

    if not isinstance(
        selected_document_ids,
        list
    ):

        return jsonify({
            "error":
                "Selected documents must be provided as a list."
        }), 400


    if not selected_document_ids:

        return jsonify({
            "error":
                "Please select at least one document before asking a question."
        }), 400


    # Remove duplicates while preserving order
    selected_document_ids = list(
        dict.fromkeys(
            selected_document_ids
        )
    )


    # --------------------------------------------------------
    # Make sure every selected document exists
    # --------------------------------------------------------

    missing_documents = [
        document_id
        for document_id in selected_document_ids
        if document_id not in documents
    ]


    if missing_documents:

        return jsonify({
            "error":
                "One or more selected documents were not found."
        }), 404


    # --------------------------------------------------------
    # RAG QUESTION ANSWERING
    # --------------------------------------------------------

    try:

        result = answer_question(
            question,
            selected_document_ids,
            history
        )


        return jsonify(
            result
        )


    except Exception as error:

        print(
            "Question answering error:",
            error
        )


        return jsonify({
            "error":
                str(error)
        }), 500


# ============================================================
# DELETE ONE DOCUMENT
# ============================================================

@app.route(
    "/api/documents/<document_id>",
    methods=["DELETE"]
)
def remove_document(
    document_id
):

    if document_id not in documents:

        return jsonify({

            "error":
                "Document not found."

        }), 404


    document = documents[
        document_id
    ]


    try:

        delete_document(
            document_id
        )


        remove_uploaded_file(
            document_id
        )


        del documents[
            document_id
        ]


        save_document_metadata()


        return jsonify({

            "message":
                (
                    document["name"]
                    + " removed successfully."
                )
        })


    except Exception as error:

        return jsonify({

            "error":
                str(error)

        }), 500


# ============================================================
# CLEAR KNOWLEDGE BASE
# ============================================================

@app.route(
    "/api/clear",
    methods=["DELETE"]
)
def clear_documents():

    try:

        clear_vector_database()


        for file_name in os.listdir(
            UPLOAD_FOLDER
        ):

            file_path = os.path.join(
                UPLOAD_FOLDER,
                file_name
            )


            if os.path.isfile(
                file_path
            ):

                if file_name == ".gitkeep":

                    continue


                try:

                    os.remove(
                        file_path
                    )

                except OSError:

                    pass


        documents.clear()


        save_document_metadata()


        return jsonify({

            "message":
                (
                    "All documents and vector data "
                    "were cleared successfully."
                )
        })


    except Exception as error:

        return jsonify({

            "error":
                str(error)

        }), 500


# ============================================================
# FILE SIZE ERROR
# ============================================================

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({

        "error":
            (
                "Upload is too large. "
                "The maximum request size is 20 MB."
            )

    }), 413


# ============================================================
# GENERAL 404 API RESPONSE
# ============================================================

@app.errorhandler(404)
def not_found(error):

    if request.path.startswith(
        "/api/"
    ):

        return jsonify({

            "error":
                "API endpoint not found."

        }), 404


    return (
        "Page not found",
        404
    )


# ============================================================
# SERVER START
# ============================================================

if __name__ == "__main__":

    print()


    print(
        "=" * 60
    )


    print(
        "RAGSPhere RAG Server"
    )


    print(
        "=" * 60
    )


    print(
        "Generation model : llama3.2:3b"
    )


    print(
        "Embedding model  : nomic-embed-text"
    )


    print(
        f"Saved documents  : {len(documents)}"
    )


    print(
        "Server           : http://127.0.0.1:5000"
    )


    print(
        "=" * 60
    )


    print()


    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )