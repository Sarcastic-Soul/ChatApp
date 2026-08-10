# 💬 ChatApp — Real-Time Encrypted Messaging & WebRTC Platform

A high-performance, full-stack real-time chat application built with **React**, **Express.js**, **Socket.io**, and **WebRTC**. Features AES-256 message encryption, automated profanity filtering, IndexedDB offline caching, and Google Gemini AI smart replies.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-blue?style=for-the-badge&logo=vercel)](https://socket-chat-nine-tau.vercel.app/)
[![Demo Video](https://img.shields.io/badge/YouTube-Demo_Video-red?style=for-the-badge&logo=youtube)](https://youtu.be/9GX83N07K70)
[![Repository](https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github)](https://github.com/Sarcastic-Soul/ChatApp)

---

## 🌐 Live Demo & Credentials

* **Web Application**: [https://socket-chat-nine-tau.vercel.app/](https://socket-chat-nine-tau.vercel.app/)
* **YouTube Video Tour**: [Watch 2-Minute Demo](https://youtu.be/9GX83N07K70)

> **Test Credentials**:  
> **Username**: `alice` | **Password**: `password123`

*Note: The backend is hosted on Render's free tier and may take a moment to wake up if inactive.*

---

## ⚡ Key Engineering Highlights

* **🔒 AES-256 Encryption at Rest**: Messages are encrypted using Node `crypto` CBC ciphering before database persistence and decrypted dynamically upon authorized retrieval.
* **🛡️ Soft-Masking Profanity Filter**: Automated backend profanity shield censors inappropriate language into masked asterisks (`****`) before storage.
* **⚡ Offline-First Caching (IndexedDB)**: Stale-while-revalidate data pipeline powered by `idb` for instant conversation loading.
* **📞 Peer-to-Peer WebRTC Calling**: Direct voice & video calls over native `RTCPeerConnection` with Socket.io signaling.
* **🤖 AI Magic Reply (Google Gemini)**: Intelligent, tone-aware quick reply generation powered by `gemini-2.5-flash`.
* **💬 Rich Messaging Suite**: Support for media attachments (Cloudinary), quoted replies, message editing, deletion for everyone, reactions, read receipts, and typing indicators.

---

## 📸 Preview

![ChatApp Demo](./screenshots/chat_ss.png)

---

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite, Mantine UI (v7), Zustand, Tailwind CSS, Socket.io-client, IndexedDB (`idb`).
* **Backend**: Express.js, Socket.io, MongoDB & Mongoose, JWT (HttpOnly cookies), `leo-profanity`, Cloudinary SDK, `@google/generative-ai`.
* **Tooling & Package Manager**: `pnpm` v11+, ES Modules.

---

## 📂 System Architecture

```text
mern-chat-app/
├── backend/
│   ├── controllers/      # Request logic (auth, message, group, user, cloudinary)
│   ├── models/           # Mongoose schemas (User, Message, Conversation)
│   ├── routes/           # REST API routes
│   ├── socket/           # Real-time WebSocket handlers & WebRTC signaling
│   ├── utils/            # Encryption, profanity filter, JWT helper
│   └── server.js         # Entry point & Express server setup
└── frontend/
    └── src/
        ├── components/   # UI components (messages, sidebar, call modal)
        ├── context/      # React contexts (Auth, Socket, Call)
        ├── hooks/        # Custom data & mutation hooks
        ├── pages/        # Route views (Landing, Login, Home, Profile, etc.)
        ├── utils/        # IndexedDB cache engine & formatters
        └── zustand/      # Global state stores
```

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js** (v18+)
* **pnpm** installed (`npm i -g pnpm`)
* **MongoDB** connection URI

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Sarcastic-Soul/ChatApp.git
cd ChatApp

# Install backend dependencies
cd backend
pnpm install

# Install frontend dependencies
cd ../frontend
pnpm install
```

### 2. Configure Environment Variables

Create `.env` in `backend/`:

```env
PORT=5000
MONGO_DB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_32_byte_aes_key
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Seed Database (Optional)

```bash
cd backend
pnpm run seed
```

### 4. Run the Application

```bash
# Start backend server (Terminal 1)
cd backend
pnpm run dev

# Start frontend client (Terminal 2)
cd frontend
pnpm run dev
```

---

## 📜 License

Distributed under the MIT License.
