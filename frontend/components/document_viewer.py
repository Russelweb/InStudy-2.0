import streamlit as st
import requests
import os
from utils.auth_utils import auth_manager

API_URL = os.getenv("API_URL", "http://localhost:8000")

ANNOTATION_TYPES = {
    "Key Point":   "key_point",
    "Explanation": "explanation",
    "Summary":     "summary",
    "Note":        "note",
    "Question":    "question",
}

ANNOTATION_COLORS = {
    "key_point":   "#FF7F50", # Coral for border
    "explanation": "#818CF8", # Blue for border
    "summary":     "#34D399", # Green for border
    "note":        "#9CA3AF", # Gray for border
    "question":    "#FB7185", # Rose for border
}


def _h():
    return auth_manager.get_auth_headers()


@st.cache_data(ttl=300, show_spinner=False)
def _fetch_documents(course_id):
    try:
        r = requests.get(
            f"{API_URL}/api/documents/list/{course_id}",
            headers=_h(), timeout=10
        )
        if r.status_code == 200:
            return [f for f in r.json().get("documents", [])
                    if not f.endswith(".annotations.json")]
    except Exception:
        pass
    return []


@st.cache_data(ttl=3600, show_spinner=False)
def _fetch_page_image(course_id: str, filename: str, page_num: int, token: str) -> bytes | None:
    """Cached page image fetch — same page+token combo won't re-hit the backend."""
    try:
        r = requests.get(
            f"{API_URL}/api/documents/page/{course_id}/{filename}/{page_num}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20
        )
        return r.content if r.status_code == 200 else None
    except Exception:
        return None


@st.cache_data(ttl=3600, show_spinner=False)
def _fetch_page_count(course_id: str, filename: str, token: str) -> int:
    try:
        r = requests.get(
            f"{API_URL}/api/documents/pagecount/{course_id}/{filename}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        return r.json().get("page_count", 1) if r.status_code == 200 else 1
    except Exception:
        return 1


def _fetch_paragraphs_and_annotations(course_id, filename):
    try:
        r = requests.get(
            f"{API_URL}/api/documents/paragraphs/{course_id}/{filename}",
            headers=_h(), timeout=120  # Increased for large books
        )
        if r.status_code == 200:
            d = r.json()
            return d.get("paragraphs", []), d.get("styles", []), d.get("annotations", [])
    except Exception as e:
        st.error(f"Error loading document: {e}")
    return [], [], []


def _save_annotation(course_id, filename, para_idx, content, ann_type):
    try:
        r = requests.post(
            f"{API_URL}/api/documents/annotations/{course_id}/{filename}",
            json={"paragraph_index": para_idx, "content": content, "annotation_type": ann_type},
            headers=_h(), timeout=10
        )
        return r.status_code == 200
    except Exception:
        return False


def _delete_annotation(course_id, filename, ann_id):
    try:
        r = requests.delete(
            f"{API_URL}/api/documents/annotations/{course_id}/{filename}/{ann_id}",
            headers=_h(), timeout=10
        )
        return r.status_code == 200
    except Exception:
        return False


STYLE_CSS = {
    "heading1":   "font-size:17px;font-weight:700;color:#1a1a2e;margin:14px 0 4px;letter-spacing:0.3px;",
    "heading2":   "font-size:15px;font-weight:600;color:#16213e;margin:10px 0 3px;",
    "heading3":   "font-size:13px;font-weight:600;color:#333;margin:8px 0 2px;",
    "list":       "font-size:13px;color:#333;margin:2px 0 2px 18px;list-style:disc;",
    "page_break": "font-size:10px;color:#bbb;text-align:center;border-top:1px dashed #ddd;margin:10px 0 6px;padding-top:4px;letter-spacing:1px;text-transform:uppercase;",
    "body":       "font-size:13px;color:#222;line-height:1.75;margin:0 0 6px;",
}

ANN_BORDER = {
    "key_point":   "#f0a500",
    "explanation": "#17a2b8",
    "summary":     "#28a745",
    "note":        "#888",
    "question":    "#dc3545",
}


def _build_doc_html(paragraphs, styles, ann_map):
    rows = []
    styles = styles or ["body"] * len(paragraphs)

    for i, (para, style) in enumerate(zip(paragraphs, styles)):
        css = STYLE_CSS.get(style, STYLE_CSS["body"])

        if style == "page_break":
            rows.append(f"<div style='{css}'>{para}</div>")
            continue

        # Paragraph number badge (only for annotatable blocks)
        badge = (
            f"<span style='font-size:9px;color:#ccc;vertical-align:super;"
            f"margin-right:4px;user-select:none;'>P{i+1}</span>"
        )

        if style == "list":
            rows.append(
                f"<div style='display:flex;align-items:baseline;'>"
                f"<span style='margin-right:6px;color:#555;'>•</span>"
                f"<p style='{css};margin:0;flex:1;'>{badge}{para}</p></div>"
            )
        elif style in ("heading1", "heading2", "heading3"):
            tag = {"heading1": "h3", "heading2": "h4", "heading3": "h5"}[style]
            rows.append(f"<{tag} style='{css}'>{badge}{para}</{tag}>")
        else:
            rows.append(f"<p style='{css}'>{badge}{para}</p>")

        # Inline annotations for this paragraph
        for ann in ann_map.get(i, []):
            atype  = ann.get("type", "note")
            label  = atype.replace("_", " ").title()
            color  = ANNOTATION_COLORS.get(atype, "#aaa")
            ts     = ann.get("created_at", "")[:16].replace("T", " ")
            rows.append(
                f"<div style='background:rgba(255,255,255,0.03); border-left:4px solid {color}; "
                f"padding:12px 14px; margin:10px 0 10px 22px; border-radius:12px; "
                f"font-size:12.5px; line-height:1.6; color: #FFFFFF !important; "
                f"box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-top: 1px solid rgba(255,255,255,0.02);'>"
                f"<span style='font-weight:800; color:{color}; letter-spacing:0.5px; margin-bottom:4px; display:inline-block;'>[{label}]</span> "
                f"<span style='color:rgba(255,255,255,0.4); font-size:10px; margin-left:6px;'>{ts}</span><br/>"
                f"{ann['content']}</div>"
            )

        if ann_map.get(i):
            rows.append("<div style='height:4px;'></div>")

    return "<div style='font-family:Georgia,serif;padding:4px 2px;'>" + "".join(rows) + "</div>"


def _render_pdf_pages(course_id: str, filename: str, annotations: list, page_context: str):
    """
    Render PDF as page images using PyMuPDF via backend endpoint.
    Pages are cached client-side; adjacent pages are pre-fetched silently.
    """
    # Consistent keys for state management
    K_PAGE_NUM = f"pdf_slider_{page_context}"
    K_PCOUNT   = f"dv_pcount_{page_context}"
    K_PAGE_IDX = f"dv_page_{page_context}" # Backward compatibility / legacy sync

    token = auth_manager.get_auth_headers().get("Authorization", "").replace("Bearer ", "")

    if st.session_state.get(K_PCOUNT) is None:
        st.session_state[K_PCOUNT] = _fetch_page_count(course_id, filename, token)

    if K_PAGE_NUM not in st.session_state:
        st.session_state[K_PAGE_NUM] = 1 # 1-indexed for the slider

    # Page navigation bar
    nav1, nav2, nav3 = st.columns([1, 3, 1])
    total = st.session_state[K_PCOUNT]
    current_slider_val = st.session_state[K_PAGE_NUM]

    # Handle button clicks BEFORE rendering the slider to avoid Streamlit state errors
    # (Values modified after a widget with the same key is instantiated throw an error)
    prev_clicked = False
    with nav1:
        if st.button("◀ Prev", key=f"pdf_prev_{page_context}", disabled=current_slider_val <= 1, use_container_width=True):
            prev_clicked = True
    
    next_clicked = False
    with nav3:
        if st.button("Next ▶", key=f"pdf_next_{page_context}", disabled=current_slider_val >= total, use_container_width=True):
            next_clicked = True

    if prev_clicked:
        st.session_state[K_PAGE_NUM] = current_slider_val - 1
        st.rerun()
    if next_clicked:
        st.session_state[K_PAGE_NUM] = current_slider_val + 1
        st.rerun()

    with nav2:
        jump = st.slider(
            "page", min_value=1, max_value=max(total, 1), 
            key=K_PAGE_NUM, label_visibility="collapsed"
        )
        st.caption(f"Page {jump} of {total}")

    # Get zero-indexed page for fetching
    current_idx = st.session_state[K_PAGE_NUM] - 1
    
    # Render current page (cached)
    img_bytes = _fetch_page_image(course_id, filename, current_idx, token)
    if img_bytes:
        st.image(img_bytes, use_container_width=True)
    else:
        st.error(f"Could not load page {current_idx + 1}")

    # Silently pre-fetch next and prev pages into cache (no spinner)
    if current_idx + 1 < total:
        _fetch_page_image(course_id, filename, current_idx + 1, token)
    if current_idx - 1 >= 0:
        _fetch_page_image(course_id, filename, current_idx - 1, token)

    # Show all annotations below the page
    if annotations:
        st.markdown(
            "<div style='margin-top:8px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:6px;'>"
            "Annotations</div>",
            unsafe_allow_html=True
        )
        for ann in annotations:
            atype  = ann.get("type", "note")
            label  = atype.replace("_", " ").title()
            color  = ANNOTATION_COLORS.get(atype, "#aaa")
            ts     = ann.get("created_at", "")[:16].replace("T", " ")
            pidx   = ann.get("paragraph_index", -1)
            st.markdown(
                f"<div style='background:rgba(255,255,255,0.03); border-left:4px solid {color}; "
                f"padding:12px; margin:10px 0; border-radius:12px; "
                f"font-size:12.5px; line-height:1.5; color: #FFFFFF !important; "
                f"box-shadow: 0 4px 10px rgba(0,0,0,0.1);'>"
                f"<span style='font-weight:800; color:{color};'>[{label}]</span> "
                f"<span style='color:rgba(255,255,255,0.4); font-size:10px; margin-left:8px;'>P{pidx+1} · {ts}</span><br/>"
                f"<div style='margin-top:4px;'>{ann['content']}</div>"
                f"</div>",
                unsafe_allow_html=True
            )


def show_document_panel(page_context: str = ""):
    """
    Compact two-column document viewer.
    Left: fixed-height scrollable document with inline annotations (pure HTML).
    Right: annotation form + saved annotations list (Streamlit widgets).
    The whole panel has a fixed height so the rest of the page is always reachable.
    """
    if not st.session_state.get("current_course"):
        return

    course_id = st.session_state.current_course

    K_OPEN  = f"dv_open_{page_context}"
    K_FILE  = f"dv_file_{page_context}"
    K_PARAS = f"dv_paras_{page_context}"
    K_STYS  = f"dv_stys_{page_context}"
    K_ANNS  = f"dv_anns_{page_context}"

    for k, d in [(K_OPEN, False), (K_FILE, None), (K_PARAS, None), (K_STYS, []), (K_ANNS, [])]:
        if k not in st.session_state:
            st.session_state[k] = d

    docs = _fetch_documents(course_id)
    if not docs:
        return

    # Collapsed: single open button
    if not st.session_state[K_OPEN]:
        c1, c2, c3 = st.columns([1, 2, 1])
        with c2:
            n = len(docs)
            label = f"Open Study Material ({n} file{'s' if n != 1 else ''})"
            if st.button(label, key=f"dv_openbtn_{page_context}", use_container_width=True):
                st.session_state[K_OPEN] = True
                st.rerun()
        return

    # Expanded viewer
    with st.container(border=True):

        # Top bar: file selector | open | export | close
        c_sel, c_open, c_exp, c_close = st.columns([3, 1, 2, 1])

        with c_sel:
            selected = st.selectbox(
                "doc", docs,
                key=f"dv_sel_{page_context}",
                label_visibility="collapsed"
            )
        with c_open:
            if st.button("Open", key=f"dv_openfile_{page_context}", use_container_width=True):
                with st.spinner("Loading..."):
                    paras, stys, anns = _fetch_paragraphs_and_annotations(course_id, selected)
                st.session_state[K_FILE]  = selected
                st.session_state[K_PARAS] = paras
                st.session_state[K_STYS]  = stys
                st.session_state[K_ANNS]  = anns
                st.rerun()

        with c_exp:
            if st.session_state.get(K_FILE):
                try:
                    exp = requests.get(
                        f"{API_URL}/api/documents/export/{course_id}/{st.session_state[K_FILE]}",
                        headers=_h(), timeout=120  # Increased for large books
                    )
                    if exp.status_code == 200:
                        ename = f"annotated_{os.path.splitext(st.session_state[K_FILE])[0]}.docx"
                        st.download_button(
                            "Download annotated .docx",
                            data=exp.content,
                            file_name=ename,
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key=f"dv_export_{page_context}",
                            use_container_width=True,
                        )
                except Exception:
                    pass

        with c_close:
            if st.button("Close", key=f"dv_close_{page_context}", use_container_width=True):
                st.session_state[K_OPEN]  = False
                st.session_state[K_FILE]  = None
                st.session_state[K_PARAS] = None
                st.session_state[K_STYS]  = []
                st.session_state[K_ANNS]  = []
                st.rerun()

        if not st.session_state[K_FILE] or st.session_state[K_PARAS] is None:
            st.info("Select a document and click Open.")
            return

        filename    = st.session_state[K_FILE]
        paragraphs  = st.session_state[K_PARAS]
        styles      = st.session_state.get(K_STYS, [])
        annotations = st.session_state[K_ANNS]

        ann_map = {}
        for ann in annotations:
            ann_map.setdefault(ann.get("paragraph_index", -1), []).append(ann)

        st.caption(
            f"Viewing: {filename}  |  "
            f"{len(paragraphs)} paragraphs  |  "
            f"{len(annotations)} annotation(s)"
        )

        # Two-column body
        col_doc, col_ann = st.columns([3, 2])

        # LEFT: PDF → page images via PyMuPDF; DOCX/TXT → styled HTML
        with col_doc:
            ext = os.path.splitext(filename)[1].lower()

            if ext == ".pdf":
                _render_pdf_pages(course_id, filename, annotations, page_context)
            else:
                doc_html = _build_doc_html(paragraphs, styles, ann_map)
                st.markdown(
                    "<div style='height:520px;overflow-y:auto;padding:10px 14px;"
                    "border:1px solid #e0e0e0;border-radius:6px;background:#fff;'>"
                    + doc_html +
                    "</div>",
                    unsafe_allow_html=True,
                )

        # RIGHT: annotation form + list
        with col_ann:
            st.markdown("**Add annotation**")

            para_labels = [
                f"P{i+1} - {p[:55]}{'...' if len(p) > 55 else ''}"
                for i, p in enumerate(paragraphs)
            ]
            para_idx = st.selectbox(
                "Attach to paragraph",
                range(len(para_labels)),
                format_func=lambda i: para_labels[i],
                key=f"para_pick_{page_context}",
            )

            atype_label = st.selectbox(
                "Type",
                list(ANNOTATION_TYPES.keys()),
                key=f"atype_{page_context}",
            )

            atext = st.text_area(
                "annotation",
                placeholder="Paste an AI explanation, key point, summary...",
                height=110,
                key=f"atext_{page_context}",
                label_visibility="collapsed",
            )

            if st.button("Save", key=f"asave_{page_context}", use_container_width=True, type="primary"):
                if atext.strip():
                    if _save_annotation(
                        course_id, filename, para_idx,
                        atext.strip(), ANNOTATION_TYPES[atype_label]
                    ):
                        st.success("Saved!")
                        paras, stys, anns = _fetch_paragraphs_and_annotations(course_id, filename)
                        st.session_state[K_PARAS] = paras
                        st.session_state[K_STYS]  = stys
                        st.session_state[K_ANNS]  = anns
                        st.rerun()
                    else:
                        st.error("Failed to save.")
                else:
                    st.warning("Write something first.")

            if annotations:
                st.divider()
                st.caption(f"{len(annotations)} annotation(s) saved")
                for ann in reversed(annotations):
                    atype   = ann.get("type", "note")
                    color   = ANNOTATION_COLORS.get(atype, "#aaa")
                    label   = atype.replace("_", " ").title()
                    ts      = ann.get("created_at", "")[:16].replace("T", " ")
                    pidx    = ann.get("paragraph_index", -1)
                    pref    = f"P{pidx+1}" if pidx >= 0 else "general"
                    preview = ann["content"][:100] + ("..." if len(ann["content"]) > 100 else "")

                    ca, cd = st.columns([5, 1])
                    with ca:
                        st.markdown(
                            f"<div style='background:rgba(255,255,255,0.03); border-left:3px solid {color}; "
                            f"padding:10px; margin:6px 0; border-radius:12px; "
                            f"font-size:11px; color: #FFFFFF !important;'>"
                            f"<b style='color:{color};'>[{label}]</b> {pref} "
                            f"<span style='color:rgba(255,255,255,0.4); font-size:9px;'>{ts}</span><br/>"
                            f"<div style='margin-top:3px;'>{preview}</div></div>",
                            unsafe_allow_html=True,
                        )
                    with cd:
                        if st.button(
                            "X", key=f"del_{ann['id']}_{page_context}",
                            help="Delete this annotation"
                        ):
                            if _delete_annotation(course_id, filename, ann["id"]):
                                paras, stys, anns = _fetch_paragraphs_and_annotations(course_id, filename)
                                st.session_state[K_PARAS] = paras
                                st.session_state[K_STYS]  = stys
                                st.session_state[K_ANNS]  = anns
                                st.rerun()
