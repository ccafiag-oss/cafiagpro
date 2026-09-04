const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { exec } = require('child_process');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');


