const http = require('http');
const app = require('./app');
const { attachVoiceRelay } = require('./voiceRelay');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

// Attach WebSocket voice relay at /voice/ws
attachVoiceRelay(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Voice WebSocket relay available at ws://localhost:${PORT}/voice/ws`);
});
