// Serve static files and index.html for frontend
const path = require('path');
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// Minimalist Express server for Safe Vault with MongoDB
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL || 'mongodb+srv://admin:secure1326@cluster1.p0toplm.mongodb.net/safevault?retryWrites=true&w=majority&appName=Cluster1', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const fileSchema = new mongoose.Schema({
  name: String,
  type: String,
  category: String,
  encrypted: Object,
  uploadedAt: { type: Date, default: Date.now }
});
const File = mongoose.model('File', fileSchema);

// Upload file (expects encrypted file data in JSON)
app.post('/api/upload', upload.none(), async (req, res) => {
  try {
    const { name, type, category, encrypted } = JSON.parse(req.body.data);
    const file = new File({ name, type, category, encrypted });
    await file.save();
    res.json({ success: true, id: file._id });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// List files by category
app.get('/api/files/:category', async (req, res) => {
  const files = await File.find({ category: req.params.category });
  res.json(files);
});

// Download file by id
app.get('/api/file/:id', async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  res.json(file);
});

// Delete file by id
app.delete('/api/file/:id', async (req, res) => {
  await File.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Safe Vault server running on port', PORT));
