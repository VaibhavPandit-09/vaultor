# 📘 Personal Knowledge Base — Version 1 Spec

## 🎯 Goal

Build a **local-first, Dockerized personal knowledge base** that allows users to:

* Create and manage notes
* Upload and attach files
* Export and import their entire workspace
* Secure access using a master password (no recovery in v1)

---

# 🚀 Core Principles

* Local-first (no cloud, no accounts)
* Simple over feature-rich
* Fully portable (export/import)
* Honest security (no fake recovery)

---

# 📦 Features (v1 Scope)

## 📝 Notes

* Create, edit, delete notes
* Markdown content support
* List all notes in sidebar
* View single note

## 📎 File Management

* Upload files (PDF, CSV, XLSX, etc.)
* Store files on disk
* Attach/detach files to/from notes
* Download files

## 📤 Export

* Export entire workspace as ZIP
* Includes:

  * SQLite database file
  * All uploaded files

## 📥 Import

* Import ZIP to restore workspace
* Overwrites existing data

## 🔐 Security (Master Password)

* Set master password on first run
* Required to:

  * Unlock app
  * Perform export/import
* No recovery mechanism (v1)
* If password is lost → data is unrecoverable

## 🐳 Dockerized Setup

* App runs via Docker
* Persistent volume for:

  * Database
  * Files

---

# 🧱 Database Schema (SQLite)

## `notes`

```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

---

## `files`

```sql
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at DATETIME NOT NULL
);
```

---

## `note_files`

```sql
CREATE TABLE note_files (
    note_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    PRIMARY KEY (note_id, file_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
```

---

# 🌐 API Contract

Base URL:

```
/api
```

---

## 📝 Notes API

### Create Note

```
POST /api/notes
```

Request:

```json
{
  "title": "My Note",
  "content": "Hello world"
}
```

---

### Get All Notes

```
GET /api/notes
```

Response:

```json
[
  {
    "id": "uuid",
    "title": "My Note",
    "preview": "Hello world...",
    "updatedAt": "..."
  }
]
```

---

### Get Note by ID

```
GET /api/notes/{id}
```

Response:

```json
{
  "id": "uuid",
  "title": "My Note",
  "content": "Full markdown...",
  "files": [
    {
      "id": "file-id",
      "name": "resume.pdf"
    }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### Update Note

```
PUT /api/notes/{id}
```

Request:

```json
{
  "title": "Updated title",
  "content": "Updated content"
}
```

---

### Delete Note

```
DELETE /api/notes/{id}
```

---

## 📎 File API

### Upload File

```
POST /api/files
Content-Type: multipart/form-data
```

Form:

```
file: <binary>
```

Response:

```json
{
  "id": "file-id",
  "name": "resume.pdf"
}
```

---

### Attach File to Note

```
POST /api/notes/{noteId}/files/{fileId}
```

---

### Remove File from Note

```
DELETE /api/notes/{noteId}/files/{fileId}
```

---

### Download File

```
GET /api/files/{id}/download
```

---

### Delete File

```
DELETE /api/files/{id}
```

---

## 📦 Export / Import

### Export Workspace

```
GET /api/export
```

Response:

* ZIP file

Structure:

```
knowledge-base.zip
├── app.db
├── files/
│   ├── <stored files>
```

---

### Import Workspace

```
POST /api/import
Content-Type: multipart/form-data
```

Form:

```
file: <zip>
```

Behavior:

* Replaces existing database and files

---

# 🔐 Security Design

## Master Password

* Set during first-time setup
* Stored as:

  * Hashed (PBKDF2 / Argon2 / bcrypt)
* Used for:

  * App unlock
  * Export/import authorization

## Rules

* Password is never stored in plain text
* No password recovery in v1
* Incorrect password → access denied

---

# 📁 File Storage

* Files stored on disk:

```
/data/files/
```

* Database stored at:

```
/data/app.db
```

---

# 🐳 Docker Setup (Conceptual)

* Single container (backend + SQLite)
* Volume mount:

```
/data
```

---

# 🧭 Out of Scope (v1)

* Search
* Tags / folders
* Real-time sync
* Multi-user support
* Cloud backup
* Passkey recovery (planned v2)

---

# 🏁 Definition of Done

* User can:

  * Create and edit notes
  * Upload and attach files
  * Export workspace
  * Import workspace
  * Unlock app using master password

* App runs via Docker with persistent data

---

# 🔮 Future (v2 Ideas)

* Passkey-based recovery (WebAuthn)
* Full-text search
* Tagging system
* UI improvements
* Encryption at rest

---

**End of v1 Spec**
