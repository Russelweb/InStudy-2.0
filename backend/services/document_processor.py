import os
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.vectorstores import FAISS
from config import settings
from models.global_models import get_embeddings
import docx2txt
import logging  
import base64
import pandas as pd
from io import BytesIO
from langchain_core.documents import Document

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """
    Handles document processing with local embeddings.
    Uses Sentence Transformers for fast, lightweight embeddings.
    """

    def __init__(self):
        # Use global embeddings instance (loaded once)
        self.embeddings = get_embeddings()
        
        # Optimized text splitter for faster processing
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
        )

    def load_document(self, file_path: str, **kwargs) -> List:
        """Load document based on file type with page tracking"""
        ext = os.path.splitext(file_path)[1].lower()

        try:
            if ext == ".pdf":
                import fitz  # PyMuPDF
                doc = fitz.open(file_path)
                documents = []
                api_key = kwargs.get('api_key')
                
                for i, page in enumerate(doc):
                    text = page.get_text().strip()
                    metadata = {
                        "source": file_path, 
                        "page": i + 1, 
                        "total_pages": len(doc)
                    }
                    
                    # If page is mostly an image or diagram (sparse text)
                    if len(text) < 150 and api_key:
                        logger.info(f"Page {i+1} of {os.path.basename(file_path)} appears to be an image/diagram. Running Vision analysis...")
                        try:
                            # Convert page to image
                            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # High res
                            img_bytes = pix.tobytes("jpg")
                            
                            vision_desc = self._process_image_vision(file_path, api_key, img_bytes=img_bytes)
                            text = f"{text}\n\n[VISUAL CONTENT ANALYSIS]:\n{vision_desc}"
                            metadata["has_vision"] = True
                        except Exception as ve:
                            logger.error(f"Failed vision analysis on PDF page {i+1}: {ve}")
                    
                    documents.append(Document(page_content=text, metadata=metadata))
                
                doc.close()
                return documents

            elif ext == ".txt":
                loader = TextLoader(file_path, encoding="utf-8")
                documents = loader.load()
                
                # For text files, estimate pages (assuming ~500 words per page)
                for doc in documents:
                    word_count = len(doc.page_content.split())
                    estimated_pages = max(1, word_count // 500)
                    doc.metadata['page'] = 1
                    doc.metadata['total_pages'] = estimated_pages
                    doc.metadata['estimated'] = True
                
                return documents

            elif ext == ".docx":
                # Use docx2txt for better DOCX support
                text = docx2txt.process(file_path)
                if not text.strip():
                    raise ValueError("DOCX file is empty")
                
                word_count = len(text.split())
                estimated_pages = max(1, word_count // 500)
                
                return [Document(
                    page_content=text, 
                    metadata={
                        "source": file_path,
                        "page": 1,
                        "total_pages": estimated_pages,
                        "estimated": True
                    }
                )]

            elif ext in [".xlsx", ".xls"]:
                # Process Excel files
                df = pd.read_excel(file_path)
                text = f"Data from Excel file {os.path.basename(file_path)}:\n\n"
                text += df.to_string(index=False)
                
                return [Document(
                    page_content=text,
                    metadata={"source": file_path, "page": 1, "total_pages": 1, "is_data": True}
                )]

            elif ext == ".csv":
                # Process CSV files
                df = pd.read_csv(file_path)
                text = f"Data from CSV file {os.path.basename(file_path)}:\n\n"
                text += df.to_string(index=False)
                
                return [Document(
                    page_content=text,
                    metadata={"source": file_path, "page": 1, "total_pages": 1, "is_data": True}
                )]

            elif ext == ".xml":
                # Process XML files as text for now
                loader = TextLoader(file_path, encoding="utf-8")
                return loader.load()

            elif ext in [".jpg", ".jpeg", ".png"]:
                # Process Images using Vision LLM
                # Note: api_key must be passed via kwargs if called from process_document
                api_key = kwargs.get('api_key')
                description = self._process_image_vision(file_path, api_key)
                
                return [Document(
                    page_content=description,
                    metadata={"source": file_path, "page": 1, "total_pages": 1, "is_image": True}
                )]

            else:
                raise ValueError(f"Unsupported file type: {ext}")
                
        except Exception as e:
            logger.error(f"Error loading document {file_path}: {e}")
            raise

    def process_document(self, file_path: str, user_id: str, course_id: str, doc_name: str, api_key: str = None):
        """
        Process document and store in vector database with page tracking.
        Optimized for speed with local embeddings.
        """
        logger.info(f"Processing document: {doc_name}")
        
        # Load document with page information
        documents = self.load_document(file_path, api_key=api_key)
        
        # Check if we got any valid content across all pages
        if not documents:
            raise ValueError("Document could not be loaded")
            
        full_text = "".join(doc.page_content for doc in documents).strip()
        if not full_text:
            raise ValueError("Document has no readable text. It might be image-only or corrupt.")

        # Attach metadata to all documents
        for doc in documents:
            doc.metadata.update({
                "user_id": user_id,
                "course_id": course_id,
                "document_name": doc_name,
                "source": file_path
            })

        # Split into chunks while preserving page information
        logger.info(f"Splitting document into chunks...")
        all_chunks = []
        
        for doc in documents:
            # Split this page/document into chunks
            chunks = self.text_splitter.split_documents([doc])
            
            # Preserve page metadata for all chunks from this page
            for chunk in chunks:
                chunk.metadata.update({
                    'page': doc.metadata.get('page', 1),
                    'total_pages': doc.metadata.get('total_pages', 1),
                    'estimated': doc.metadata.get('estimated', False)
                })
            
            all_chunks.extend(chunks)
        
        logger.info(f"Created {len(all_chunks)} chunks from {len(documents)} pages")

        from utils.file_utils import get_vector_store_path, get_vector_store_root
        vector_store_path = get_vector_store_path(user_id, course_id)

        # Create vector store directory if missing
        os.makedirs(get_vector_store_root(), exist_ok=True)

        # Load existing store or create new one
        logger.info("Creating embeddings...")
        if os.path.exists(vector_store_path):
            vector_store = FAISS.load_local(
                vector_store_path,
                self.embeddings,
                allow_dangerous_deserialization=True
            )
            vector_store.add_documents(all_chunks)
        else:
            vector_store = FAISS.from_documents(
                all_chunks,
                self.embeddings
            )

        # Save vector database
        logger.info("Saving vector store...")
        vector_store.save_local(vector_store_path)
        logger.info(f"Document processed successfully: {len(all_chunks)} chunks from {len(documents)} pages")

        return len(all_chunks)

    def get_vector_store(self, user_id: str, course_id: str):
        """Retrieve vector store for user and course"""
        from utils.file_utils import get_vector_store_path
        vector_store_path = get_vector_store_path(user_id, course_id)

        if not os.path.exists(vector_store_path):
            return None

        return FAISS.load_local(
            vector_store_path,
            self.embeddings,
            allow_dangerous_deserialization=True
        )

    def extract_text(self, file_path: str) -> str:
        """Extract all text from a document as a single string"""
        try:
            docs = self.load_document(file_path)
            return "".join(d.page_content for d in docs)
        except Exception as e:
            logger.error(f"Failed to extract text from {file_path}: {e}")
            return ""

    def _process_image_vision(self, file_path: str, api_key: str = None, img_bytes: bytes = None) -> str:
        """Use Vision LLM to describe an image/diagram/plan"""
        logger.info(f"--- VISION DEBUG START ---")
        logger.info(f"File: {os.path.basename(file_path)}")
        logger.info(f"Source: {'PDF Page' if img_bytes else 'Direct Image File'}")
        logger.info(f"API Key provided: {bool(api_key)} (Type: {type(api_key)})")
        
        if not api_key:
            logger.warning("❌ No API key provided for Vision processing. Image will not be analyzed.")
            return "[Image analysis failed: No API key provided for Vision processing]"

        try:
            from models.global_models import get_llm
            logger.info("Initializing Llama 4 Scout...")
            vision_llm = get_llm(api_key, model_name="meta-llama/llama-4-scout-17b-16e-instruct")
            
            # Encode image (either from file or bytes)
            if img_bytes:
                encoded_string = base64.b64encode(img_bytes).decode('utf-8')
            else:
                with open(file_path, "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Formulate vision prompt
            prompt = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "TECHNICAL ANALYSIS: Describe this image/diagram/document page in extreme detail for a RAG knowledge base. If it contains diagrams, explain the components and flow. If it is a house plan, list rooms and dimensions. This description MUST be exhaustive so that a text-only AI can answer questions about it later. Respond ONLY with the description."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{encoded_string}",
                            },
                        },
                    ],
                }
            ]
            
            logger.info(f"Sending image to Vision model (Llama 4 Scout)...")
            response = vision_llm.invoke(prompt)
            description = response if isinstance(response, str) else getattr(response, 'content', str(response))
            
            logger.info("=" * 40)
            logger.info(f"✅ VISION INDEXING SUCCESS: {os.path.basename(file_path)}")
            logger.info(f"Description Size: {len(description)} chars")
            logger.info(f"Preview: {description[:150]}...")
            logger.info("=" * 40)
            
            return f"IMAGE CONTENT ANALYSIS ({os.path.basename(file_path)}):\n\n{description}"
            
        except Exception as e:
            logger.error(f"Vision processing failed: {e}")
            return f"[Image Content: {os.path.basename(file_path)} - Vision analysis failed: {str(e)}]"
