# Local AI Chat 🤖

A fully offline-capable AI chatbot that runs entirely in your browser. No server, no data collection, 100% private.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-beta-orange.svg)

[**🔴 Live Demo**](https://local-ai-chat.tomstacy.com/)

## 🌟 Features

- **100% Private:** All AI processing happens locally on your device using WebGPU.
- **Offline Capable:** Works without an internet connection after the initial load.
- **Multi-Model Support:** Choose from various high-performance small language models (SLMs).
- **Model Comparison:** Run two models side-by-side to compare their outputs.
- **Persistent History:** Conversations are saved locally in your browser.
- **Rich UI:** Dark/Light mode, markdown rendering, code highlighting, and more.
- **PWA Ready:** Installable as a desktop or mobile app.
- **Mobile Optimized:** Fully responsive design with touch-friendly interface.
- **Secure:** Implements strict Content Security Policy (CSP) to prevent XSS and unauthorized connections.

## 🚀 Getting Started

### Prerequisites

- A modern browser with WebGPU support (Chrome 113+, Edge 113+).
- ~2-4GB of free RAM for model inference.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/TomStacy/in-browser-chatbot.git
   ```

2. Navigate to the project directory:

   ```bash
   cd in-browser-chatbot
   ```

3. Serve the application:

   **Option 1: Using the provided Python script (Recommended)**

   ```bash
   python serve.py
   ```

   Then open `http://localhost:8001`.

   **Option 2: Manual setup**

   Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

   Then run a static server (e.g., Python):

   ```bash
   python -m http.server 8080
   ```

   Then open `http://localhost:8080`.

   Or with Node.js:

   ```bash
   npx serve .
   ```

   **Option 3: VS Code Live Server**

   If you use Visual Studio Code, you can use the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer).

   1. Install the extension.
   2. Right-click on `frontend/index.html`.
   3. Select "Open with Live Server".

## 🧠 Supported Models

The application currently supports the following ONNX-optimized models:

- **SmolLM2-1.7B-Instruct** (Balanced performance)
- **Granite-3.0-2b-instruct** (High quality instruction following)
- **Phi-3.5-mini-instruct** (Strong reasoning capabilities)

## 🛠️ Technology Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **AI Runtime:** [transformers.js](https://huggingface.co/docs/transformers.js) (WebGPU)
- **Storage:** IndexedDB (via Dexie.js)
- **Offline:** Service Workers & Cache API

## 💻 Development

### Linting

This project uses ESLint for code quality. To run the linter:

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the lint command:

   ```bash
   npm run lint
   ```

### Testing

This project uses Vitest for unit testing. To run the tests:

```bash
npm test
```

To run tests once (without watch mode):

```bash
npm test -- run
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
