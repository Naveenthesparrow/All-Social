const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const uploadRoute = require('./routes/uploadRoute');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

if (!process.env.GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in .env file. Video analysis will fail.");
}

// Routes
app.use('/api/upload', uploadRoute);

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
