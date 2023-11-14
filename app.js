import bodyParser from 'body-parser';
import express from 'express';
import admin from 'firebase-admin';
import { createRequire } from 'module'; // Bring in the ability to create the 'require' method
const require = createRequire(import.meta.url); // construct the require method
// const serviceAccount = require('./firebase.json');
require('dotenv').config();
import axios from 'axios';
import CryptoJS from 'crypto-js';


const serviceAccount = {
  type: process.env.type,
  project_id: process.env.project_id,
  private_key_id: process.env.private_key_id,
  private_key: process.env.private_key.replace(/\\n/g, '\n'),
  client_email: process.env.client_email,
  client_id: process.env.client_id,
  auth_uri: process.env.auth_uri,
  token_uri: process.env.token_uri,
  auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.client_x509_cert_url,
  universe_domain: process.env.universe_domain,
};

const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
const aesDecryptionSecretKey = process.env.AES_SECRET_KEY;

console.log(`serviceAccount ${JSON.stringify(serviceAccount)}`)

// var serviceAccountJson = JSON.parse(myJsonString);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();

const cors = require('cors');

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    // Check if the origin matches the allowed sources
    const allowedSources = [
      'http://127.0.0.1', 'http://localhost',
      'https://127.0.0.1', 'https://localhost'
    ];
    const pattern = /^https?:\/\/(\w+\.)?authgate\.work$/;

    if (allowedSources.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
      callback(null, true);
    } else if (pattern.test(origin)) {
      callback(null, true);
    } else {
      console.log(`origin ${origin}`)
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.get('/', function (req, res) {
  res.send('Hello World!');
});

const port = process.env.PORT || 3000;

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});

const auth = admin.auth();

app.use(bodyParser.json());

app.post('/createUser', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await auth.createUser({
      password: password,
      email: email,
    });

    await db.collection('users').doc(user.uid).set({
      email: email,
    });

    res.status(200).send('Successfully created new user: ' + user.uid);
  } catch (error) {
    res.status(500).send('Error creating new user: ' + error);
  }
});


// Middleware to authenticate requests
const authenticate = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).send('Unauthorized');

  const [bearer, token] = authorization.split(' ');
  if (bearer !== 'Bearer') return res.status(401).send('Unauthorized');

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log(`token ${token}`)
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).send('Unauthorized');
  }
};

app.get('/hello', authenticate, (req, res) => {
  res.send(`Hello`);
});

const validateRecaptcha = async (data, res) => {
  const recaptchaToken = data.recaptchaToken;

  if (!recaptchaToken) {
    return res.status(400).json({ success: false, message: 'No reCAPTCHA token provided.' });
  }

  try {
    const recaptchaResponse = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, null, {
      params: {
        secret: recaptchaSecretKey,
        response: recaptchaToken
      }
    });

    if (!recaptchaResponse.data.success) {
      res.status(400).json({ success: false, message: 'Invalid reCAPTCHA. Please try again.' });
      return false;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' });
    return false;
  }

  return true;
};

app.post('/pay', async (req, res) => {
  const data = JSON.parse(
    CryptoJS.AES.decrypt(
      req.body.encrypted, aesDecryptionSecretKey)
      .toString(CryptoJS.enc.Utf8));
  
  if (!await validateRecaptcha(data, res)) {
    return;
  }

  await db.collection('payments').add(data);

  res.status(200).send('Payment successful');
});

