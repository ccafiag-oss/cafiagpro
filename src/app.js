
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');







// route 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;
