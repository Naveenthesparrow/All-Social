const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { analyzeVideo } = require('../controllers/videoController');

router.post('/', upload.single('video'), analyzeVideo);

module.exports = router;
