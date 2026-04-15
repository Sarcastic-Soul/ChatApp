# React + Express Socket.io Chat App 🚀💬

A full-stack real-time chat application built with **React + Vite** and **Express.js**, powered by **Socket.io** for instant communication and **WebRTC** for peer-to-peer calls.

---

## 🌐 Live Demo

* 🔗 [https://socket-chat-nine-tau.vercel.app/](https://socket-chat-nine-tau.vercel.app/)
* ▶️ [Demo Video ](https://youtu.be/9GX83N07K70)

⚠️ **Important Note:** The backend is deployed on Render's free tier, which may sleep on inactivity. When you open the link, please wait for the server to boot up (it may take up to 10 minutes). A cron job has been made to prevent this, but there is no guarantee. Just watch the video DEMO below if necessary.

🧪 Test Credentials:

* Username: `alice`
* Password: `password123`

---

## 📸 DEMO
![Chat](./screenshots/chat_ss.png)

## ▶️ Watch Demo Video on YouTube
[![Watch Demo](https://img.youtube.com/vi/9GX83N07K70/0.jpg)](https://youtu.be/9GX83N07K70)

---

## 🏗️ Architecture

* **Frontend:** React + Vite (UI + state management)
* **Backend:** Express.js + Socket.io (API + real-time events)
* **Database:** MongoDB (encrypted message storage)
* **Media Storage:** Cloudinary
* **Realtime:** WebSockets (Socket.io)
* **Calling:** WebRTC (with Socket.io signaling)
* **Caching:** IndexedDB (stale-while-revalidate)

---

## ⚡ Engineering Highlights

* Stale-while-revalidate caching with IndexedDB for instant chat loads
* Real-time message lifecycle (sent → delivered → read)
* WebRTC-based peer-to-peer video & voice calls
* AES-256 encryption for messages at rest
* Rate limiting & security via Helmet + express-rate-limit

---

## ✨ Features

### 🔐 Authentication & Security

* JWT-based login/signup
* Password hashing with bcrypt
* AES-256 encrypted message storage
* Rate limiting & abuse protection

### 💬 Messaging System

* Real-time 1-on-1 and group chats
* Message reactions and emojis
* Reply to messages (quoted replies)
* Edit messages with `(edited)` indicator
* Delete for everyone
* Message forwarding

### 📊 Message Experience

* Read receipts (✔️ sent / ✔️✔️ read)
* Typing indicators
* Unread message tracking
* In-chat search functionality

### 📁 Media & Files

* Drag & drop image/video uploads
* Upload progress indicators
* Cloudinary media storage

### 📞 Calling Features

* WebRTC 1-on-1 video calls
* Audio-only voice calls
* Call logs (missed/completed)

### 🤖 AI Features

* Magic Reply (Google Gemini API)
* Tone-based smart suggestions

### 👥 Social & Groups

* Create/manage groups
* Admin roles & permissions
* System messages (join/leave updates)

### 👤 User Profiles

* Custom avatars
* Public/Private profile toggle

### ⚡ Performance & UX

* Offline-first chat loading (IndexedDB caching)
* Smooth mobile + desktop experience
* Resizable sidebar layout
* Dark/Light theme + custom colors

### 🧠 State & UI

* Zustand for global state
* Mantine UI for modern design

---

## 📂 Project Structure

```text
mern-chat-app/
├── backend/
│   ├── controllers/
│   ├── db/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   ├── utils/
│   └── server.js
└── frontend/
    ├── public/
    └── src/
        ├── components/
        ├── context/
        ├── hooks/
        ├── pages/
        ├── utils/
        ├── zustand/
        ├── App.jsx
        └── main.jsx
```

---

## 🛠️ Tech Stack

**Frontend:**
React, Mantine UI, Zustand, Socket.io-client, idb, react-router-dom

**Backend:**
Express.js, Socket.io, MongoDB, JWT, bcryptjs, Cloudinary, Gemini API

---

## 🚀 Getting Started

### Prerequisites

* Bun installed
* MongoDB database

### Installation

```bash
cd frontend
bun install

cd ../backend
bun install
```

### Environment Variables (`backend/.env`)

```env
PORT=5000
MONGO_DB_URI=
JWT_SECRET=
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ENCRYPTION_KEY=
GEMINI_API_KEY=
```

---

## 🌱 Seed Database

```bash
cd backend
bun run seed
```

---

## ▶️ Run Locally

```bash
cd backend
bun run dev
```

```bash
cd frontend
bun run dev
```

---

## 🎯 Usage

* Create an account or log in
* Start real-time conversations with users
* Send text, emojis, media, and voice messages
* Track delivery and read status
* Make video or voice calls
* Manage groups and participants
* Use AI-powered reply suggestions
* Search and revisit past messages
* Customize UI (theme, layout, profile)
