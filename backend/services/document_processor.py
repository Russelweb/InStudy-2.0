import os
from typing import List
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.vectorstores import FAISS
from config import settings
from models.global_models import get_embeddings
import docx2txt
import logging

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

    def load_document(self, file_path: str) -> List:
        """Load document based on file type with page tracking"""
        ext = os.path.splitext(file_path)[1].lower()

        try:
            if ext == ".pdf":
                loader = PyPDFLoader(file_path)
                documents = loader.load()
                
                # Enhance metadata with page numbers
                for i, doc in enumerate(documents):
                    doc.metadata['page'] = i + 1  # 1-indexed page numbers
                    doc.metadata['total_pages'] = len(documents)
                
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
                
                # Create a document object manually with page estimation
                from langchain.schema import Document
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

            else:
                raise ValueError(f"Unsupported file type: {ext}")
                
        except Exception as e:
            logger.error(f"Error loading document {file_path}: {e}")
            raise

    def process_document(self, file_path: str, user_id: str, course_id: str, doc_name: str):
        """
        Process document and store in vector database with page tracking.
        Optimized for speed with local embeddings.
        """
        logger.info(f"Processing document: {doc_name}")
        
        # Load document with page information
        documents = self.load_document(file_path)
        
        if not documents or not documents[0].page_content.strip():
            raise ValueError("Document is empty or could not be read")

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

        vector_store_path = os.path.join(
            settings.VECTOR_STORE_DIR,
            f"{user_id}_{course_id}"
        )

        # Create vector store directory if missing
        os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)

        # Load existing store or create new one
        logger.info("Creating embeddings...")
        if os.path.exists(vector_store_path):
            vector_store = FAISS.load_local(
                vector_store_path,
                self.embeddings,
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
        vector_store_path = os.path.join(
            settings.VECTOR_STORE_DIR,
            f"{user_id}_{course_id}"
        )

        if not os.path.exists(vector_store_path):
            return None

        return FAISS.load_local(
            vector_store_path,
            self.embeddings,
        )