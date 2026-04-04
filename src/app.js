const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Routes will be registered here
app.use('/', require('./routes/payload'));
app.use('/', require('./routes/markers'));
app.use('/scan', require('./routes/scans'));
app.use('/voice', require('./routes/voice'));
app.use('/drone', require('./routes/drone'));

module.exports = app;
